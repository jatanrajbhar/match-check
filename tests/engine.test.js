// Run: node --test   (Node 18+; no dependencies)
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../src/engine.js");
const D = require("../src/data.js");

const profilesById = Object.fromEntries(D.profiles.map((p) => [p.id, p]));
const clientById = Object.fromEntries(D.clients.map((c) => [c.id, c]));
const log = D.feedback.map((f) => ({
  ...f,
  parsed: f.decision === "rejected" ? E.parseFeedbackOffline(f.text) : null,
}));
const categoriesOf = (id) => log.find((f) => f.id === id).parsed.reasons.map((r) => r.category).sort();

test("offline parser maps each historical rejection to the intended reason", () => {
  const expected = {
    f1: ["age"], f2: ["smoking"], f3: ["location"], f5: ["attraction"], f6: ["career"],
    f8: ["drinking"], f9: ["marital_status"], f10: ["height"], f11: ["height"], f12: ["family"],
    f13: ["personality"], f16: ["diet"], f18: ["lifestyle"], f20: ["personality"],
    f22: ["children"], f23: ["location"], f24: ["lifestyle"],
  };
  for (const [id, cats] of Object.entries(expected)) assert.deepEqual(categoriesOf(id), cats, id);
});

test("offline parser reads firmness and direction", () => {
  const r = E.parseFeedbackOffline("He's 5'5, I'd like someone taller.").reasons[0];
  assert.equal(r.direction, "wants_higher");
  assert.equal(r.firmness, "soft");
  const smoke = E.parseFeedbackOffline("I was very clear about no smoking.").reasons[0];
  assert.equal(smoke.firmness, "firm");
  assert.equal(E.parseFeedbackOffline("Hmm, not sure.").reasons[0].category, "other");
});

test("team metrics mirror the brief: ~35% of rejections avoidable, A ~2x B", () => {
  const m = E.teamMetrics(D.clients, log, profilesById);
  assert.deepEqual(
    [m.all.shared, m.all.accepted, m.all.rejected, m.all.avoidable],
    [25, 8, 17, 6]
  );
  assert.equal(m.byMatchmaker.A.accepted, 5);
  assert.equal(m.byMatchmaker.A.shared, 11);
  assert.equal(m.byMatchmaker.B.accepted, 3);
  assert.equal(m.byMatchmaker.B.shared, 14);
  assert.ok(Math.abs(m.all.avoidableShareOfRejections - 0.35) < 0.01);
});

test("a rejection is avoidable only if the cited reason broke a stated preference", () => {
  const priya = clientById.c1;
  // Too old (stated max 35) -> avoidable
  assert.equal(E.isAvoidable(priya, profilesById.h1, [{ category: "age" }]), true);
  // Pune is in her stated cities -> not avoidable, it's a gap in the preferences
  assert.equal(E.isAvoidable(priya, profilesById.h3, [{ category: "location" }]), false);
  // Candidate broke age, but the client cited photos -> not avoidable by this definition
  assert.equal(E.isAvoidable(priya, profilesById.h1, [{ category: "attraction" }]), false);
});

test("pre-send check gives the designed status for every pool profile", () => {
  const expected = {
    c1: { p1: "clear", p2: "block", p3: "review", p4: "block", p5: "clear", p6: "block", p7: "block", p8: "review" },
    c2: { p1: "block", p2: "block", p3: "block", p4: "review", p5: "clear", p6: "review", p7: "block", p8: "block" },
    c3: { p9: "clear", p10: "block", p11: "block", p12: "block", p13: "block", p14: "clear" },
    c4: { p9: "block", p10: "review", p11: "clear", p12: "block", p13: "block", p14: "review" },
  };
  for (const [cid, byProfile] of Object.entries(expected)) {
    for (const [pid, status] of Object.entries(byProfile)) {
      const res = E.checkCandidate(clientById[cid], profilesById[pid], log, profilesById);
      assert.equal(res.status, status, `${cid} x ${pid}: ${JSON.stringify(res.issues)}`);
    }
  }
});

test("relocation: out-of-city candidate who will relocate is not blocked", () => {
  const res = E.checkCandidate(clientById.c1, profilesById.p5);
  assert.equal(res.issues.filter((i) => i.category === "location").length, 0);
});

test("learned signals: consistent pattern vs mixed signal", () => {
  // Sneha rejected two men at 5'5" and 5'6" for height and accepted none that short
  const sneha = E.learnedSignals(clientById.c2, log, profilesById);
  const height = sneha.find((s) => s.category === "height");
  assert.equal(height.rejected, 2);
  assert.equal(height.accepted, 0);
  assert.equal(height.consistent, true);
  assert.equal(height.matches({ heightCm: 167 }), true);
  assert.equal(height.matches({ heightCm: 180 }), false);

  // Priya rejected a Pune profile, then accepted another Pune profile later
  const priya = E.learnedSignals(clientById.c1, log, profilesById);
  const loc = priya.find((s) => s.category === "location");
  assert.equal(loc.rejected, 1);
  assert.equal(loc.accepted, 1);
  assert.match(loc.describe(), /Mixed signal/);
});

test("learned signals never block on their own", () => {
  const res = E.checkCandidate(clientById.c2, profilesById.p4, log, profilesById);
  assert.equal(res.status, "review");
  assert.ok(res.issues.every((i) => i.level === "review"));
});

test("missing profile data asks for review instead of passing silently", () => {
  const res = E.checkCandidate(clientById.c1, profilesById.p8);
  assert.equal(res.status, "review");
  assert.equal(res.issues[0].source, "missing");
});

test("learning loop: a second rejection for the same reason makes the signal consistent", () => {
  const kabir = clientById.c4;
  const before = E.learnedSignals(kabir, log, profilesById).find((s) => s.category === "location");
  assert.equal(before.rejected, 1);
  assert.equal(before.consistent, false);

  const reply = "Gurgaon again, the commute is too much.";
  const parsed = E.parseFeedbackOffline(reply);
  assert.equal(E.isAvoidable(kabir, profilesById.p10, parsed.reasons), false);
  const after = E.learnedSignals(
    kabir,
    [...log, { clientId: "c4", candidateId: "p10", decision: "rejected", text: reply, parsed }],
    profilesById
  ).find((s) => s.category === "location");
  assert.equal(after.rejected, 2);
  assert.equal(after.consistent, true);
});
