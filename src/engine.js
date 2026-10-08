/*
 * Match Check engine: pure functions, no DOM, no network.
 *
 *   checkCandidate()      pre-send check against stated preferences + deal-breakers
 *   parseFeedbackOffline() keyword fallback that turns free text into reasons
 *   isAvoidable()          was this rejection for a reason the client already told us?
 *   learnedSignals()       patterns in rejections the stated preferences don't cover
 *   teamMetrics()          avoidable-rejection rate and acceptance rate per matchmaker
 *
 * Works as a browser global (window.MatchEngine) and as a CommonJS module (tests).
 */
(function (root) {
  "use strict";

  // Reason taxonomy. `field` = profile attribute we can check automatically.
  const CATEGORIES = {
    age: { label: "Age", field: "age" },
    height: { label: "Height", field: "heightCm" },
    location: { label: "Location", field: "city" },
    religion: { label: "Religion / community", field: "religion" },
    education: { label: "Education", field: "education" },
    marital_status: { label: "Marital status", field: "maritalStatus" },
    diet: { label: "Diet", field: "diet" },
    smoking: { label: "Smoking", field: "smoking" },
    drinking: { label: "Drinking", field: "drinking" },
    children: { label: "Wants children", field: "wantsChildren" },
    family: { label: "Family setup", field: null },
    lifestyle: { label: "Lifestyle", field: null },
    career: { label: "Career / ambition", field: null },
    attraction: { label: "Photos / attraction", field: null },
    personality: { label: "Personality / bio", field: null },
    other: { label: "Other", field: null },
  };

  const EDUCATION_LEVEL = { Bachelors: 1, Masters: 2, Doctorate: 3 };
  const HABIT_LEVEL = { Never: 0, Occasionally: 1, Socially: 1, Regularly: 2 };
  const NUMERIC_FIELDS = new Set(["age", "heightCm"]);

  const cmToFeet = (cm) => {
    const inches = Math.round(cm / 2.54);
    return `${Math.floor(inches / 12)}'${inches % 12}"`;
  };

  // ---------------------------------------------------------------------------
  // 1. Stated-preference check (deterministic; this is what blocks a send)
  // ---------------------------------------------------------------------------

  function statedIssues(client, c) {
    const p = client.prefs || {};
    const d = client.dealBreakers || {};
    const issues = [];
    const add = (category, level, source, message) =>
      issues.push({ category, level, source, message });
    const missing = (category, what) =>
      add(category, "review", "missing", `${what} not on profile, can't verify`);

    if (p.age) {
      if (c.age == null) missing("age", "Age");
      else if (c.age < p.age[0] || c.age > p.age[1])
        add("age", "block", "stated", `Age ${c.age} is outside ${p.age[0]}–${p.age[1]}`);
    }
    if (p.heightCm) {
      const [min, max] = p.heightCm;
      if (c.heightCm == null) missing("height", "Height");
      else if ((min && c.heightCm < min) || (max && c.heightCm > max))
        add("height", "block", "stated",
          `Height ${cmToFeet(c.heightCm)} (${c.heightCm} cm) is outside the stated range`);
    }
    if (p.cities && p.cities.length) {
      if (!c.city) missing("location", "City");
      else if (!p.cities.includes(c.city) && !c.willingToRelocate)
        add("location", "block", "stated",
          `Lives in ${c.city}, not willing to relocate (client wants ${p.cities.join(" / ")})`);
    }
    if (p.religions && p.religions.length) {
      if (!c.religion) missing("religion", "Religion");
      else if (!p.religions.includes(c.religion))
        add("religion", "block", "stated", `Religion ${c.religion} not in ${p.religions.join(" / ")}`);
    }
    if (p.minEducation) {
      if (!c.education) missing("education", "Education");
      else if (EDUCATION_LEVEL[c.education] < EDUCATION_LEVEL[p.minEducation])
        add("education", "block", "stated", `${c.education} is below the minimum (${p.minEducation})`);
    }
    if (p.maritalStatus && p.maritalStatus.length) {
      if (!c.maritalStatus) missing("marital_status", "Marital status");
      else if (!p.maritalStatus.includes(c.maritalStatus))
        add("marital_status", "block", "stated", `${c.maritalStatus}; client wants ${p.maritalStatus.join(" / ")}`);
    }
    if (p.diet && p.diet.length) {
      if (!c.diet) missing("diet", "Diet");
      else if (!p.diet.includes(c.diet))
        add("diet", "block", "stated", `${c.diet}; client wants ${p.diet.join(" / ")}`);
    }
    for (const habit of ["smoking", "drinking"]) {
      const maxOk = d[habit];
      if (!maxOk) continue;
      if (!c[habit]) missing(habit, habit[0].toUpperCase() + habit.slice(1));
      else if (HABIT_LEVEL[c[habit]] > HABIT_LEVEL[maxOk])
        add(habit, "block", "deal-breaker", `${habit[0].toUpperCase() + habit.slice(1)}: ${c[habit]} (client accepts up to "${maxOk}")`);
    }
    if (d.wantsChildren) {
      const want = d.wantsChildren;
      if (!c.wantsChildren) missing("children", "Children plans");
      else if ((want === "Yes" && c.wantsChildren === "No") || (want === "No" && c.wantsChildren === "Yes"))
        add("children", "block", "deal-breaker", `Wants children: ${c.wantsChildren}; client: ${want}`);
      else if (c.wantsChildren === "Open" && want !== "Open")
        add("children", "review", "deal-breaker", `Undecided on children; client is a firm "${want}"`);
    }
    return issues;
  }

  /**
   * Full pre-send check.
   * @returns {{status: "block"|"review"|"clear", issues: Array}}
   */
  function checkCandidate(client, candidate, feedbackLog, profilesById) {
    const issues = statedIssues(client, candidate);
    if (feedbackLog && profilesById) {
      for (const s of learnedSignals(client, feedbackLog, profilesById)) {
        if (s.matches(candidate)) {
          issues.push({
            category: s.category,
            level: "review",
            source: "learned",
            message: s.describe(),
            mixed: s.accepted > 0,
          });
        }
      }
    }
    const status = issues.some((i) => i.level === "block")
      ? "block"
      : issues.length ? "review" : "clear";
    return { status, issues };
  }

  // ---------------------------------------------------------------------------
  // 2. Offline feedback parser (keyword rules). The prototype uses Claude when an
  //    API key is provided; this fallback keeps the demo usable without one.
  // ---------------------------------------------------------------------------

  const KEYWORDS = [
    ["smoking", /\bsmok\w*|cigarette/i],
    ["drinking", /\bdrinks?\b|\bdrinking\b|alcohol|booze/i],
    ["children", /\bkids?\b|\bchild(ren)?\b|\bbab(y|ies)\b/i],
    ["marital_status", /divorc\w*|married before|previously married|widow\w*|separated/i],
    ["diet", /\bnon[- ]?veg\w*|\bvegetarian|\bvegan\b|\bmeat\b|\beggs?\b/i],
    ["height", /\btall(er)?\b|\bshort(er)?\b|\bheight\b|\d\s?'\s?\d{1,2}|\bcm\b/i],
    ["age", /\b(too )?(old|young)(er)?\b|\bage\b|\bmature\b|\b\d{2}\s?(yrs|years) old\b|\bhe'?s \d{2}\b|\bshe'?s \d{2}\b/i],
    ["location", /\bfar\b|\blives? in\b|relocat\w*|\bmove\b|\bmoving\b|\bcommute\b|\bdistance\b|\bcity\b/i],
    ["religion", /religio\w*|\bcaste\b|\bcommunity\b|\bfaith\b/i],
    ["education", /educat\w*|\bdegree\b|\bgraduate\b|\bmasters\b|\bmba\b|\bphd\b|qualifi\w*/i],
    ["family", /joint family|\bin-?laws\b|\bparents\b/i],
    ["lifestyle", /\bpart(y|ying)\b|homebody|lifestyle|night shifts?|work-life|long hours/i],
    ["career", /ambiti\w*|\bcareer\b|\bsame job\b|\bsalary\b|\bincome\b|\bearn\w*/i],
    ["attraction", /\bphotos?\b|\bpictures?\b|\blooks\b|attract\w*|\bmy type\b/i],
    ["personality", /\bbio\b|personality|connection|\bspark\b|\bvibe\b|boring|generic|in common/i],
  ];
  const FIRM = /\bnever\b|no way|deal[- ]?breaker|absolutely|\bclear(ly)?\b|\bmentioned\b|\bi said\b|told you|non[- ]negotiable|\bdefinitely\b|\bonly\b/i;
  const SOFT = /\bprefer\w*|would like|i'?d like|\brather\b|\ba bit\b|slightly|\bmaybe\b|\bhonestly\b|\bnot sure\b/i;

  function directionFor(category, text) {
    if (category === "height") {
      if (/too tall/i.test(text)) return "wants_lower";
      if (/taller|too short|\bshort\b/i.test(text)) return "wants_higher";
    }
    if (category === "age") {
      if (/too old|way older|much older|older than (i|what)/i.test(text)) return "wants_lower";
      if (/too young|more mature|someone older/i.test(text)) return "wants_higher";
    }
    return "not_applicable";
  }

  function sentenceContaining(text, regex) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    return (sentences.find((s) => regex.test(s)) || text).trim();
  }

  function parseFeedbackOffline(text) {
    const reasons = [];
    for (const [category, regex] of KEYWORDS) {
      if (!regex.test(text)) continue;
      // "joint family" is about family setup, not children
      if (category === "children" && /joint family/i.test(text) && !/\bkids?\b|child/i.test(text)) continue;
      const quote = sentenceContaining(text, regex);
      // Firmness from the reason's own sentence, else from the whole message
      const scope = FIRM.test(quote) || SOFT.test(quote) ? quote : text;
      reasons.push({
        category,
        quote,
        firmness: FIRM.test(scope) ? "firm" : SOFT.test(scope) ? "soft" : "unclear",
        direction: directionFor(category, text),
      });
    }
    if (!reasons.length) {
      reasons.push({ category: "other", quote: text.trim(), firmness: "unclear", direction: "not_applicable" });
    }
    return { reasons, source: "offline" };
  }

  // ---------------------------------------------------------------------------
  // 3. Avoidable rejections and learned signals
  // ---------------------------------------------------------------------------

  /** A rejection is avoidable if a cited reason maps to a stated preference the candidate broke. */
  function isAvoidable(client, candidate, reasons) {
    const broken = new Set(
      statedIssues(client, candidate).filter((i) => i.level === "block").map((i) => i.category)
    );
    return reasons.some((r) => broken.has(r.category));
  }

  /**
   * Rejections that cite a checkable field the candidate did NOT break are evidence that the
   * stated preferences are incomplete. Group them per category, and count accepted profiles in
   * the same range as counter-evidence (clients sometimes reject, then accept, similar profiles).
   * Learned signals only ever produce "review", never "block".
   */
  function learnedSignals(client, feedbackLog, profilesById) {
    const mine = feedbackLog.filter((f) => f.clientId === client.id);
    const groups = {};
    for (const f of mine) {
      if (f.decision !== "rejected" || !f.parsed) continue;
      const candidate = profilesById[f.candidateId];
      if (!candidate || isAvoidable(client, candidate, f.parsed.reasons)) continue;
      for (const r of f.parsed.reasons) {
        const field = CATEGORIES[r.category] && CATEGORIES[r.category].field;
        if (!field || candidate[field] == null) continue;
        const g = (groups[r.category] = groups[r.category] || { field, values: [], directions: [], quotes: [] });
        g.values.push(candidate[field]);
        g.directions.push(r.direction);
        g.quotes.push(r.quote);
      }
    }

    return Object.entries(groups).map(([category, g]) => {
      const numeric = NUMERIC_FIELDS.has(g.field);
      const direction = g.directions.find((d) => d !== "not_applicable") || "not_applicable";
      let matches;
      let range;
      if (numeric && direction === "wants_higher") {
        const bound = Math.max(...g.values);
        matches = (c) => c[g.field] != null && c[g.field] <= bound;
        range = g.field === "heightCm" ? `${cmToFeet(bound)} or shorter` : `${bound} or younger`;
      } else if (numeric && direction === "wants_lower") {
        const bound = Math.min(...g.values);
        matches = (c) => c[g.field] != null && c[g.field] >= bound;
        range = g.field === "heightCm" ? `${cmToFeet(bound)} or taller` : `${bound} or older`;
      } else if (numeric) {
        const lo = Math.min(...g.values) - 2;
        const hi = Math.max(...g.values) + 2;
        matches = (c) => c[g.field] != null && c[g.field] >= lo && c[g.field] <= hi;
        range = `${lo}–${hi}`;
      } else {
        const values = new Set(g.values);
        matches = (c) => values.has(c[g.field]);
        range = [...values].join(" / ");
      }

      const rejected = g.values.length;
      const accepted = mine.filter(
        (f) => f.decision === "accepted" && profilesById[f.candidateId] && matches(profilesById[f.candidateId])
      ).length;
      const label = CATEGORIES[category].label;
      const consistent = rejected >= 2 && accepted === 0;

      return {
        category,
        label,
        range,
        rejected,
        accepted,
        quotes: g.quotes,
        consistent,
        matches,
        describe() {
          const base = `Rejected ${rejected} of ${rejected + accepted} similar profiles on ${label.toLowerCase()} (${range})`;
          if (accepted > 0) return `${base}. Mixed signal: client has also accepted ${accepted}, so treat as a soft preference`;
          if (consistent) return `${base}. Consistent: confirm with client and add to stated preferences`;
          return `${base}. Single data point, keep an eye on it`;
        },
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Team metrics
  // ---------------------------------------------------------------------------

  function teamMetrics(clients, feedbackLog, profilesById) {
    const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
    const blank = () => ({ shared: 0, accepted: 0, rejected: 0, avoidable: 0 });
    const out = { all: blank(), byMatchmaker: {} };
    for (const f of feedbackLog) {
      const client = clientById[f.clientId];
      const candidate = profilesById[f.candidateId];
      if (!client || !candidate) continue;
      const mm = (out.byMatchmaker[client.matchmaker] = out.byMatchmaker[client.matchmaker] || blank());
      for (const bucket of [out.all, mm]) {
        bucket.shared += 1;
        if (f.decision === "accepted") bucket.accepted += 1;
        else {
          bucket.rejected += 1;
          if (f.parsed && isAvoidable(client, candidate, f.parsed.reasons)) bucket.avoidable += 1;
        }
      }
    }
    const rates = (b) => ({
      ...b,
      acceptanceRate: b.shared ? b.accepted / b.shared : 0,
      avoidableRate: b.shared ? b.avoidable / b.shared : 0,
      avoidableShareOfRejections: b.rejected ? b.avoidable / b.rejected : 0,
    });
    out.all = rates(out.all);
    for (const k of Object.keys(out.byMatchmaker)) out.byMatchmaker[k] = rates(out.byMatchmaker[k]);
    return out;
  }

  const api = {
    CATEGORIES,
    cmToFeet,
    checkCandidate,
    statedIssues,
    parseFeedbackOffline,
    isAvoidable,
    learnedSignals,
    teamMetrics,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MatchEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
