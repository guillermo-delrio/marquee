import { describe, expect, it } from "vitest";

import { checkProgramme } from "../src/check.js";
import type { Programme, ProgrammeEvent } from "../src/types.js";

const event = (over: Partial<ProgrammeEvent> = {}): ProgrammeEvent => ({
  title: "Night", when: "Week 1, Thursday evening", date: "2026-11-05", format: "Screening", featured: ["Paterson"],
  why: "", evidence: [{ call_id: "q2", claim: "Ranked first" }], confidence: "medium", ...over,
});
const programme = (events: ProgrammeEvent[]): Programme => ({ headline: "", audience_read: "", events, limits: [], next_checks: [] });
const known = { month: "2026-11", slots: 2, names: new Set(["Paterson", "Columbus"]), callIds: new Set(["q1", "q2"]) };

describe("checkProgramme", () => {
  it("accepts a programme that keeps every rule", () => {
    expect(checkProgramme(programme([event(), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]), known)).toEqual([]);
  });
  it("names each broken rule so the agent can fix it", () => {
    const problems = checkProgramme(programme([
      event({ featured: ["Barbie"] }),
      event({ date: "2026-12-01" }),
      event({ evidence: [{ call_id: "q9", claim: "" }], date: "2026-11-06", when: "Week 1, Thursday evening" }),
    ]), known);
    expect(problems.join("\n")).toMatch(/exactly 2 events, not 3/);
    expect(problems.join("\n")).toMatch(/"Barbie" does not appear in any Qloo result/);
    expect(problems.join("\n")).toMatch(/2026-12-01 is outside 2026-11/);
    expect(problems.join("\n")).toMatch(/q9 is not a call in this run/);
    expect(problems.join("\n")).toMatch(/2026-11-06 is a Friday, but `when` says Thursday/);
  });
  it("matches featured names without regard to case, quotes or dashes", () => {
    const names = new Set(["Emma‐Jean Thackray", "Tomorrow, and Tomorrow, and Tomorrow"]);
    expect(checkProgramme(programme([event({ featured: ["Emma-Jean Thackray"] }), event({ featured: ["tomorrow, and tomorrow, and tomorrow"], date: "2026-11-12" })]),
      { ...known, names })).toEqual([]);
  });
});

describe("shortlist checks", () => {
  const withNotes = (notes: Programme["shortlist_notes"], events = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening", source: "taste" })]) =>
    ({ ...programme(events), shortlist_notes: notes });
  const shortlisted = { ...known, shortlist: ["Paterson", "Old Joy"] };

  it("accepts a verdict for every shortlisted title that matches the programme", () => {
    expect(checkProgramme(withNotes([
      { title: "Paterson", verdict: "programmed", reason: "Ranks first for taste and here", evidence: ["q2"] },
      { title: "Old Joy", verdict: "not_found", reason: "Qloo did not resolve it", evidence: [] },
    ]), shortlisted)).toEqual([]);
  });

  it("asks for the missing verdicts and catches ones that contradict the programme", () => {
    const problems = checkProgramme(withNotes([
      { title: "Paterson", verdict: "skip", reason: "", evidence: ["q2"] },
    ]), shortlisted).join("\n");
    expect(problems).toMatch(/no verdict for "Old Joy"/);
    expect(problems).toMatch(/"Paterson" is in the programme but its verdict is skip/);
  });

  it("checks that an event marked shortlist features a shortlisted title", () => {
    const problems = checkProgramme(withNotes([
      { title: "Paterson", verdict: "programmed", reason: "", evidence: [] },
      { title: "Old Joy", verdict: "skip", reason: "", evidence: [] },
    ], [event({ featured: ["Columbus"], source: "shortlist" }), event({ date: "2026-11-07", when: "Week 1, Saturday evening", source: "taste" })]), shortlisted).join("\n");
    expect(problems).toMatch(/marked as from the shortlist but features none of it/);
  });
});

describe("partner checks", () => {
  it("accepts partners Qloo returned and names the ones it did not", () => {
    const p = { ...programme([event(), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      partners: [{ name: "Café de la Luz", kind: "cafe", idea: "Coffee for ticket holders", evidence: ["q1"] },
        { name: "Made Up Bar", kind: "bar", idea: "", evidence: ["q1"] }] };
    const problems = checkProgramme(p, { ...known, names: new Set([...known.names, "Café de la Luz"]) });
    expect(problems).toEqual([expect.stringMatching(/Partner "Made Up Bar" does not appear in any Qloo result/)]);
  });
});

describe("verdict rules", () => {
  const shortlisted = { ...known, shortlist: ["Paterson", "Old Joy"] };
  const two = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })];
  it("accepts featured for a title played but not booked", () => {
    expect(checkProgramme({ ...programme(two), shortlist_notes: [
      { title: "Paterson", verdict: "featured", reason: "A listening night: too big to book live.", evidence: [] },
      { title: "Old Joy", verdict: "reserve", reason: "Fits the taste but no slot is left.", evidence: [] },
    ] }, shortlisted)).toEqual([]);
  });
  it("rejects missing data given as a reason to skip, but lets an unknown title wait in reserve", () => {
    const problems = checkProgramme({ ...programme(two), shortlist_notes: [
      { title: "Paterson", verdict: "programmed", reason: "", evidence: [] },
      { title: "Old Joy", verdict: "skip", reason: "Low taste fit and absent from the Madrid ranking.", evidence: [] },
    ] }, shortlisted).join("\n");
    expect(problems).toMatch(/"Old Joy": the reason rests on missing data \("absent"\)/);
    expect(checkProgramme({ ...programme(two), shortlist_notes: [
      { title: "Paterson", verdict: "programmed", reason: "", evidence: [] },
      { title: "Old Joy", verdict: "reserve", reason: "Qloo has no data on it, so it waits as a swap-in.", evidence: [] },
    ] }, shortlisted)).toEqual([]);
  });
});

describe("local check of taste picks", () => {
  it("asks for a city check of every programmed taste pick", () => {
    const p = programme([event({ source: "taste", featured: ["Paterson"] }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening", source: "taste" })]);
    const problems = checkProgramme(p, { ...known, checkedLocally: new Set(["Paterson"]) });
    expect(problems).toEqual([expect.stringMatching(/"Columbus" is a taste pick that was never checked in the city/)]);
  });
});
