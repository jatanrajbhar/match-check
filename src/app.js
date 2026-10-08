/* UI for the Match Check prototype. Plain DOM, no framework, no build step. */
(function () {
  "use strict";

  const E = window.MatchEngine;
  const D = window.MatchData;
  const C = window.ClaudeParser;

  const profilesById = Object.fromEntries(D.profiles.map((p) => [p.id, p]));
  const STATUS_LABEL = { clear: "Clear to send", review: "Review", block: "Blocked" };
  const SOURCE_LABEL = { stated: "Stated preference", "deal-breaker": "Deal-breaker", learned: "Learned", missing: "Missing data" };
  const EXAMPLES = [
    "He smokes, and I said no smokers. Please read my preferences.",
    "Seems lovely but lives too far away, I'd rather someone in my city.",
    "Honestly not sure, the photos didn't really do it for me.",
  ];

  const storage = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? sessionStorage.setItem(k, v) : sessionStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  const freshLog = () =>
    D.feedback.map((f) => ({ ...f, parsed: f.decision === "rejected" ? E.parseFeedbackOffline(f.text) : null }));

  const state = {
    clientId: D.clients[0].id,
    log: freshLog(),
    filter: "all",
    parser: storage.get("mc-parser") || "offline",
    apiKey: storage.get("mc-key") || "",
    draft: emptyDraft(),
  };

  function emptyDraft(candidateId = "") {
    return { candidateId, decision: "rejected", text: "", result: null, error: "", busy: false };
  }

  // --- tiny DOM helper --------------------------------------------------------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const pct = (x) => `${Math.round(x * 100)}%`;
  const client = () => D.clients.find((c) => c.id === state.clientId);
  const label = (cat) => (E.CATEGORIES[cat] ? E.CATEGORIES[cat].label : cat);

  // --- derived data -----------------------------------------------------------
  function shortlist(cl) {
    const shared = new Set(state.log.filter((f) => f.clientId === cl.id).map((f) => f.candidateId));
    const order = { clear: 0, review: 1, block: 2 };
    return D.profiles
      .filter((p) => p.id.startsWith("p") && p.gender === cl.seeking && !shared.has(p.id))
      .map((p) => ({ profile: p, check: E.checkCandidate(cl, p, state.log, profilesById) }))
      .sort((a, b) => order[a.check.status] - order[b.check.status] || a.check.issues.length - b.check.issues.length);
  }

  function profileLine(p) {
    const height = p.heightCm ? `${E.cmToFeet(p.heightCm)}` : "height ?";
    return [
      `${p.age}`, height, `${p.city}${p.willingToRelocate ? " (will relocate)" : ""}`, p.religion, p.education,
      p.maritalStatus, p.diet, `Smokes: ${p.smoking}`, `Drinks: ${p.drinking}`, `Kids: ${p.wantsChildren}`,
    ].join(" · ");
  }

  // --- render: parser settings ------------------------------------------------
  function renderParser() {
    const box = document.getElementById("parser-settings");
    box.replaceChildren(...[
      h("span", { class: "parser-title" }, "Feedback parser"),
      h("label", {},
        h("input", { type: "radio", name: "parser", value: "offline", checked: state.parser === "offline", onchange: () => setParser("offline") }),
        " Offline keyword rules"),
      h("label", {},
        h("input", { type: "radio", name: "parser", value: "claude", checked: state.parser === "claude", onchange: () => setParser("claude") }),
        ` Claude (${C.MODEL})`),
      state.parser === "claude"
        ? h("input", {
            type: "password", class: "key", placeholder: "Anthropic API key (kept in this tab only)",
            value: state.apiKey, autocomplete: "off",
            oninput: (e) => { state.apiKey = e.target.value.trim(); storage.set("mc-key", state.apiKey); },
          })
        : null,
    ].filter(Boolean));
  }
  function setParser(p) {
    state.parser = p;
    storage.set("mc-parser", p);
    renderParser();
  }

  // --- render: team metrics -----------------------------------------------------
  function renderMetrics() {
    const m = E.teamMetrics(D.clients, state.log, profilesById);
    const tile = (value, name, note) =>
      h("div", { class: "tile" }, h("div", { class: "tile-value" }, value), h("div", { class: "tile-name" }, name), note ? h("div", { class: "tile-note" }, note) : null);
    const rows = Object.entries(m.byMatchmaker).sort().map(([mm, b]) =>
      h("tr", {},
        h("td", {}, `Matchmaker ${mm}`), h("td", { class: "num" }, b.shared), h("td", { class: "num" }, b.accepted),
        h("td", { class: "num" }, pct(b.acceptanceRate)), h("td", { class: "num" }, `${b.avoidable} (${pct(b.avoidableRate)})`)));
    document.getElementById("metrics").replaceChildren(
      tile(m.all.shared, "Profiles shared", "last 30 days"),
      tile(pct(m.all.acceptanceRate), "Acceptance rate", `${m.all.accepted} accepted`),
      tile(pct(m.all.avoidableRate), "Avoidable rejection rate",
        `${m.all.avoidable} of ${m.all.shared} shared profiles were rejected for a reason the client had already stated (${pct(m.all.avoidableShareOfRejections)} of rejections)`),
      h("div", { class: "tile tile-table" },
        h("table", {},
          h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", { class: "num" }, "Shared"), h("th", { class: "num" }, "Accepted"), h("th", { class: "num" }, "Rate"), h("th", { class: "num" }, "Avoidable"))),
          h("tbody", {}, rows)))
    );
  }

  // --- render: client list ----------------------------------------------------
  function renderClients() {
    const nav = document.getElementById("client-list");
    nav.replaceChildren(
      h("h2", { class: "section-title" }, "Clients"),
      ...D.clients.map((cl) => {
        const mine = state.log.filter((f) => f.clientId === cl.id);
        const acc = mine.filter((f) => f.decision === "accepted").length;
        return h("button", {
          class: `client-btn${cl.id === state.clientId ? " active" : ""}`,
          onclick: () => { state.clientId = cl.id; state.filter = "all"; state.draft = emptyDraft(); render(); },
        },
          h("strong", {}, cl.name),
          h("span", {}, `${cl.age} · ${cl.city} · Matchmaker ${cl.matchmaker}`),
          h("span", { class: "muted" }, `${acc}/${mine.length} profiles accepted`));
      }),
      h("button", { class: "link-btn", onclick: () => { state.log = freshLog(); state.draft = emptyDraft(); render(); } }, "Reset demo data")
    );
  }

  // --- render: client view ----------------------------------------------------
  function prefsCard(cl) {
    const p = cl.prefs, d = cl.dealBreakers;
    const any = (arr) => (arr && arr.length ? arr.join(", ") : "Any");
    const items = [
      ["Age", `${p.age[0]}–${p.age[1]}`],
      ["Height", p.heightCm ? `${E.cmToFeet(p.heightCm[0])}+ (${p.heightCm[0]} cm)` : "Not stated"],
      ["Location", `${any(p.cities)} (or willing to relocate)`],
      ["Religion", any(p.religions)],
      ["Education", p.minEducation ? `${p.minEducation} or higher` : "Any"],
      ["Marital status", any(p.maritalStatus)],
      ["Diet", any(p.diet)],
    ];
    const breakers = [
      ["Smoking", d.smoking ? `up to "${d.smoking}"` : "Any"],
      ["Drinking", d.drinking ? `up to "${d.drinking}"` : "Any"],
      ["Wants children", d.wantsChildren || "Open"],
    ];
    const dl = (pairs) => h("dl", { class: "kv" }, pairs.map(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
    return h("div", { class: "card" },
      h("h3", {}, "Stated preferences"), dl(items),
      h("h3", {}, "Deal-breakers"), dl(breakers));
  }

  function learnedCard(cl) {
    const signals = E.learnedSignals(cl, state.log, profilesById);
    const themes = {};
    for (const f of state.log) {
      if (f.clientId !== cl.id || !f.parsed) continue;
      for (const r of f.parsed.reasons) if (!E.CATEGORIES[r.category] || !E.CATEGORIES[r.category].field) themes[r.category] = (themes[r.category] || 0) + 1;
    }
    return h("div", { class: "card" },
      h("h3", {}, "Learned from feedback"),
      h("p", { class: "muted small" }, "Rejections on things the stated preferences don't cover. These only ever flag a profile for review, never block it."),
      signals.length
        ? h("ul", { class: "signals" }, signals.map((s) =>
            h("li", {},
              h("span", { class: `pill ${s.accepted ? "pill-mixed" : s.consistent ? "pill-strong" : "pill-weak"}` },
                s.accepted ? "Mixed signal" : s.consistent ? "Consistent" : "Single data point"),
              h("strong", {}, ` ${s.label}: `), `${s.range}. Rejected ${s.rejected}, accepted ${s.accepted} similar.`,
              h("div", { class: "quotes" }, s.quotes.map((q) => h("q", {}, q))))))
        : h("p", { class: "muted" }, "Nothing yet."),
      Object.keys(themes).length
        ? [h("h3", {}, "Other themes (can't be checked automatically)"),
           h("p", {}, Object.entries(themes).map(([k, n]) => h("span", { class: "chip" }, `${label(k)} × ${n}`)))]
        : null);
  }

  function candidateCard(item) {
    const { profile: p, check } = item;
    return h("article", { class: `cand cand-${check.status}` },
      h("div", { class: "cand-head" },
        h("span", { class: `status status-${check.status}` }, STATUS_LABEL[check.status]),
        h("strong", {}, p.name), h("span", { class: "muted" }, ` · ${p.profession}`)),
      h("div", { class: "cand-line" }, profileLine(p)),
      check.issues.length
        ? h("ul", { class: "issues" }, check.issues.map((i) =>
            h("li", { class: `issue issue-${i.level}` },
              h("span", { class: "src" }, SOURCE_LABEL[i.source]), " ", i.message)))
        : h("p", { class: "ok" }, "Meets every stated preference and deal-breaker."),
      h("button", {
        class: "small-btn",
        onclick: () => {
          state.draft = emptyDraft(p.id);
          render();
          document.getElementById("feedback-form").scrollIntoView({ behavior: "smooth" });
        },
      }, "Log client reply"));
  }

  function shortlistSection(cl) {
    const list = shortlist(cl);
    const count = (s) => list.filter((x) => x.check.status === s).length;
    const tabs = [["all", `All ${list.length}`], ["clear", `Clear ${count("clear")}`], ["review", `Review ${count("review")}`], ["block", `Blocked ${count("block")}`]];
    const shown = state.filter === "all" ? list : list.filter((x) => x.check.status === state.filter);
    return h("section", { class: "block" },
      h("div", { class: "row-between" },
        h("h2", { class: "section-title" }, `Pre-send check · ${list.length} profiles in the pool`),
        h("div", { class: "tabs", role: "tablist" }, tabs.map(([k, t]) =>
          h("button", { class: `tab${state.filter === k ? " active" : ""}`, role: "tab", "aria-selected": state.filter === k ? "true" : "false", onclick: () => { state.filter = k; render(); } }, t)))),
      shown.length ? h("div", { class: "cands" }, shown.map(candidateCard)) : h("p", { class: "muted" }, "No profiles in this view."));
  }

  function feedbackForm(cl) {
    const pool = shortlist(cl).map((x) => x.profile);
    const dr = state.draft;
    if (dr.candidateId && !pool.some((p) => p.id === dr.candidateId)) dr.candidateId = "";
    const candidate = profilesById[dr.candidateId];

    const result = dr.result
      ? (() => {
          const avoid = dr.decision === "rejected" && candidate && E.isAvoidable(cl, candidate, dr.result.reasons);
          const broken = candidate ? E.statedIssues(cl, candidate).filter((i) => i.level === "block") : [];
          return h("div", { class: "result" },
            h("div", { class: "row-between" },
              h("h3", {}, "Structured reasons"),
              h("span", { class: "muted small" }, dr.result.source === "claude" ? `via ${dr.result.model}` : "via offline keyword rules")),
            dr.result.summary ? h("p", {}, dr.result.summary) : null,
            h("table", { class: "reasons" },
              h("thead", {}, h("tr", {}, h("th", {}, "Reason"), h("th", {}, "Client said"), h("th", {}, "Firmness"), h("th", {}, "Direction"))),
              h("tbody", {}, dr.result.reasons.map((r) =>
                h("tr", {}, h("td", {}, label(r.category)), h("td", {}, h("q", {}, r.quote)), h("td", {}, r.firmness), h("td", {}, r.direction === "not_applicable" ? "–" : r.direction.replace("_", " ")))))),
            dr.decision === "rejected"
              ? h("p", { class: avoid ? "verdict verdict-bad" : "verdict verdict-new" },
                  avoid
                    ? `Avoidable rejection: the profile broke a stated preference (${broken.map((i) => label(i.category)).join(", ")}). The pre-send check would have blocked it.`
                    : "Not avoidable from stated preferences. Checkable reasons become learned signals for this client.")
              : null,
            h("button", { class: "primary", onclick: saveDraft }, "Save to history"));
        })()
      : null;

    return h("section", { class: "block card", id: "feedback-form" },
      h("h2", { class: "section-title" }, "Log a client reply"),
      h("div", { class: "form-row" },
        h("label", {}, "Profile ",
          h("select", { onchange: (e) => { dr.candidateId = e.target.value; dr.result = null; render(); } },
            h("option", { value: "" }, "Choose a profile…"),
            pool.map((p) => h("option", { value: p.id, selected: p.id === dr.candidateId }, `${p.name} (${p.age}, ${p.city})`)))),
        h("label", {}, h("input", { type: "radio", name: "decision", checked: dr.decision === "rejected", onchange: () => { dr.decision = "rejected"; render(); } }), " Rejected"),
        h("label", {}, h("input", { type: "radio", name: "decision", checked: dr.decision === "accepted", onchange: () => { dr.decision = "accepted"; render(); } }), " Accepted")),
      h("textarea", {
        rows: "3", placeholder: "Paste the client's reply as written…",
        oninput: (e) => {
          dr.text = e.target.value;
          document.getElementById("structure-btn").disabled = dr.busy || !dr.candidateId || !dr.text.trim();
        },
      }, dr.text),
      h("div", { class: "examples" }, h("span", { class: "muted small" }, "Try: "),
        EXAMPLES.map((ex) => h("button", { class: "chip chip-btn", onclick: () => { dr.text = ex; dr.result = null; render(); } }, ex))),
      h("div", { class: "form-row" },
        h("button", { class: "primary", id: "structure-btn", disabled: dr.busy || !dr.candidateId || !dr.text.trim(), onclick: structure },
          dr.busy ? "Structuring…" : "Structure feedback"),
        !dr.candidateId ? h("span", { class: "muted small" }, "Pick a profile first.") : null),
      dr.error ? h("p", { class: "error" }, dr.error) : null,
      result);
  }

  async function structure() {
    const dr = state.draft;
    const candidate = profilesById[dr.candidateId];
    dr.error = "";
    dr.result = null;
    if (state.parser === "claude") {
      if (!state.apiKey) { dr.error = "Add an Anthropic API key, or switch to the offline parser."; render(); return; }
      dr.busy = true; render();
      try {
        dr.result = await C.parseFeedbackWithClaude({ apiKey: state.apiKey, text: dr.text, candidate, cmToFeet: E.cmToFeet });
      } catch (err) {
        dr.error = `${err.message} Falling back to the offline parser.`;
        dr.result = E.parseFeedbackOffline(dr.text);
      } finally {
        dr.busy = false;
      }
    } else {
      dr.result = E.parseFeedbackOffline(dr.text);
    }
    render();
  }

  function saveDraft() {
    const dr = state.draft;
    state.log.push({
      id: `f${state.log.length + 1}`, clientId: state.clientId, candidateId: dr.candidateId,
      date: new Date().toISOString().slice(0, 10), decision: dr.decision, text: dr.text,
      parsed: dr.decision === "rejected" ? dr.result : null,
    });
    state.draft = emptyDraft();
    render();
  }

  function historySection(cl) {
    const mine = state.log.filter((f) => f.clientId === cl.id).slice().reverse();
    return h("section", { class: "block" },
      h("h2", { class: "section-title" }, `Feedback history · ${mine.length} profiles shared`),
      h("div", { class: "table-wrap" },
        h("table", { class: "history" },
          h("thead", {}, h("tr", {}, ["Date", "Profile", "Reply", "Client said", "Reasons", ""].map((t) => h("th", {}, t)))),
          h("tbody", {}, mine.map((f) => {
            const p = profilesById[f.candidateId];
            const avoid = f.parsed && E.isAvoidable(cl, p, f.parsed.reasons);
            return h("tr", {},
              h("td", { class: "nowrap" }, f.date),
              h("td", {}, h("strong", {}, p.name), h("div", { class: "muted small" }, `${p.age} · ${p.heightCm ? E.cmToFeet(p.heightCm) : "?"} · ${p.city}`)),
              h("td", {}, h("span", { class: `pill ${f.decision === "accepted" ? "pill-ok" : "pill-no"}` }, f.decision)),
              h("td", {}, h("q", {}, f.text)),
              h("td", {}, f.parsed ? f.parsed.reasons.map((r) => h("span", { class: "chip" }, `${label(r.category)}${r.firmness === "firm" ? " · firm" : r.firmness === "soft" ? " · soft" : ""}`)) : "–"),
              h("td", {}, avoid ? h("span", { class: "pill pill-bad" }, "Avoidable") : ""));
          })))));
  }

  function renderClientView() {
    const cl = client();
    document.getElementById("client-view").replaceChildren(
      h("div", { class: "client-head" },
        h("h2", {}, cl.name),
        h("span", { class: "muted" }, `${cl.age} · ${cl.gender} seeking a ${cl.seeking.toLowerCase()} · ${cl.city} · Matchmaker ${cl.matchmaker}`)),
      h("div", { class: "two-col" }, prefsCard(cl), learnedCard(cl)),
      shortlistSection(cl),
      feedbackForm(cl),
      historySection(cl));
  }

  function render() {
    renderMetrics();
    renderClients();
    renderClientView();
  }

  // Deep links for demos: ?client=c2  or  ?client=c1&profile=p2&reply=He+smokes...&decision=rejected
  const params = new URLSearchParams(location.search);
  if (D.clients.some((c) => c.id === params.get("client"))) state.clientId = params.get("client");
  if (params.get("profile")) {
    state.draft = emptyDraft(params.get("profile"));
    state.draft.text = params.get("reply") || "";
    if (params.get("decision") === "accepted") state.draft.decision = "accepted";
  }

  renderParser();
  render();
  if (state.draft.candidateId && state.draft.text) structure();
})();
