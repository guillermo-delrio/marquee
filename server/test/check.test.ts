import { describe, expect, it } from "vitest";

import { checkProgramme, venueBands } from "../src/check.js";
import type { Programme, ProgrammeEvent, ShortlistNote } from "../src/types.js";

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
    expect(checkProgramme(programme([event({ featured: ["Emma-Jean Thackray"] }), event({ featured: ["tomorrow, and tomorrow, and tomorrow"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      { ...known, names })).toEqual([]);
  });
});

describe("shortlist checks", () => {
  const withNotes = (notes: Programme["shortlist_notes"], events = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening", source: "taste" })]) =>
    ({ ...programme(events), shortlist_notes: notes });
  const shortlisted = { ...known, shortlist: ["Paterson", "Old Joy"] };

  it("accepts a verdict for every shortlisted title that matches the programme", () => {
    expect(checkProgramme(withNotes([
      { title: "Paterson", verdict: "programmed", reason: "A close fit for the regulars, booked for a Friday", evidence: ["q2"] },
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
      { title: "Paterson", verdict: "featured", reason: "A listening night: too big to book live.", evidence: [], held_for: "format" },
      { title: "Old Joy", verdict: "reserve", reason: "In Marquee's judgement it suits the regulars less well than the booked films.", evidence: [], held_for: "judgement" },
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

describe("one night per name", () => {
  it("flags a title or act booked on two nights", () => {
    const p = programme([event(), event({ date: "2026-11-07", when: "Week 1, Saturday evening" })]);
    expect(checkProgramme(p, known)).toEqual([expect.stringMatching(/"Paterson" appears in events 1 and 2/)]);
  });
});

describe("why a title is held, checked against the rankings", () => {
  // Paterson is booked; Old Joy beats it on taste (q1) and no city ranking scored it.
  const shortlisted = { ...known, shortlist: ["Paterson", "Old Joy"],
    tasteScores: new Map([["Old Joy", { score: 0.97, callId: "q1" }], ["Paterson", { score: 0.94, callId: "q1" }]]), localCalls: new Map([["Paterson", "q2"]]) };
  const two = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })];
  const note = (held_for: ShortlistNote["held_for"], over: Partial<Parameters<typeof checkProgramme>[1]> = {}) => checkProgramme({ ...programme(two), shortlist_notes: [
    { title: "Paterson", verdict: "programmed", reason: "", evidence: [] },
    { title: "Old Joy", verdict: "reserve", reason: "The slots went to acts that also scored in the city.", evidence: [], held_for },
  ] }, { ...shortlisted, ...over }).join("\n");
  it("asks what holds a title back", () => {
    expect(note(undefined)).toMatch(/"Old Joy" \(reserve\) has no held_for/);
  });
  it("rejects missing local data passed off as slots, whatever the wording", () => {
    expect(note("slots")).toMatch(/"Old Joy" out-ranks booked "Paterson" on taste \(q1\), so slots is not why it is held, and it has no local data/);
    expect(note("taste")).toMatch(/out-ranks booked "Paterson"/);
    expect(note("local")).toMatch(/no city ranking scored it/);
  });
  it("accepts a hold for the title itself, or a real local reason", () => {
    expect(note("format")).toBe("");
    expect(note("rights")).toBe("");
    expect(note("format", { kind: "music_bar" })).toMatch(/format is not a reason at a music bar/);
    expect(note("size")).toMatch(/gave no popularity/);
    expect(note("size", { tasteScores: new Map([["Old Joy", { score: 0.97, callId: "q1", popularity: 0.99 }], ["Paterson", { score: 0.94, callId: "q1", popularity: 0.6 }]]) })).toBe("");
    expect(note("same_act")).toMatch(/same_act_as names no act in the programme/);
    expect(note("local", { localCalls: new Map([["Paterson", "q2"], ["Old Joy", "q2"]]) })).toBe("");
  });
  it("treats a near tie as no ranking difference", () => {
    expect(note("slots", { tasteScores: new Map([["Old Joy", { score: 0.945, callId: "q1" }], ["Paterson", { score: 0.94, callId: "q1" }]]) })).toBe("");
  });
  it("does not let a title with no taste data be held for taste", () => {
    expect(note("taste", { tasteScores: new Map([["Paterson", { score: 0.94, callId: "q1" }]]) })).toMatch(/no ranking scored it, so taste cannot be checked/);
    expect(note("taste", { tasteScores: new Map([["Paterson", { score: 0.94, callId: "q1" }]]), localCalls: new Map([["Old Joy", "q2"]]) })).toMatch(/taste ranking did not score it/);
  });
});

describe("partner citations", () => {
  it("rejects a partner that cites a call which did not return it", () => {
    const p = { ...programme([event(), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      partners: [{ name: "Jalopy", kind: "cafe", idea: "", evidence: ["q2"] }] };
    const names = new Set([...known.names, "Jalopy"]);
    expect(checkProgramme(p, { ...known, names, callNames: new Map([["q1", new Set(["jalopy"])], ["q2", new Set(["paterson"])]]) }).join("\n"))
      .toMatch(/Partner "Jalopy" cites q2, which did not return it/);
    expect(checkProgramme({ ...p, partners: [{ ...p.partners[0], evidence: ["q1"] }] }, { ...known, names, callNames: new Map([["q1", new Set(["jalopy"])]]) })).toEqual([]);
  });
});

describe("round 5 checks", () => {
  const shortlisted = { ...known, shortlist: ["Paterson", "Old Joy"] };
  it("does not let a title Qloo's own taste discovery returned be called a wrong match", () => {
    const p = { ...programme([event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] },
        { title: "Old Joy", verdict: "not_found" as const, reason: "Check the title: the description looks wrong.", evidence: [] }] };
    expect(checkProgramme(p, { ...shortlisted, discovered: new Set(["Old Joy"]) }).join("\n")).toMatch(/"Old Joy" came back from taste discovery/);
  });
  it("rejects counts in the headline and summary", () => {
    const p = { ...programme([event(), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      headline: "Five Thursday evenings of quiet films", summary: ["Two picks are not on your list."] };
    const problems = checkProgramme(p, known).join("\n");
    expect(problems).toMatch(/headline states a count/);
    expect(problems).toMatch(/summary states a count/);
  });
  it("asks a skip to cite the city ranking that scored the title", () => {
    const p = { ...programme([event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] },
        { title: "Old Joy", verdict: "skip" as const, reason: "Last on taste.", evidence: ["q1"] }] };
    expect(checkProgramme(p, { ...shortlisted, localCalls: new Map([["old joy", "q2"]]) }).join("\n")).toMatch(/"Old Joy" is skipped without citing q2/);
  });
  it("does not call an act booked when it only appears on records nights", () => {
    const p = { ...programme([event({ source: "shortlist", format: "Listening session, records played" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] }, { title: "Old Joy", verdict: "reserve" as const, reason: "No slot.", evidence: [] }] };
    expect(checkProgramme(p, { ...shortlisted, kind: "music_bar" }).join("\n")).toMatch(/"Paterson" is marked programmed but only appears on a records night/);
  });
});

describe("holds for audience", () => {
  const base = { ...known, shortlist: ["Paterson", "Old Joy"], audience: "people 25-34",
    tasteScores: new Map([["Old Joy", { score: 0.97, callId: "q1" }], ["Paterson", { score: 0.94, callId: "q1" }]]) };
  const two = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })];
  const hold = (ages: Map<string, Record<string, number>>) => checkProgramme({ ...programme(two), shortlist_notes: [
    { title: "Paterson", verdict: "programmed", reason: "", evidence: [] },
    { title: "Old Joy", verdict: "reserve", reason: "Its audience is older than the venue's.", evidence: ["q2"], held_for: "audience" },
  ] }, { ...base, ages }).join("\n");
  it("needs an audience profile for the held title", () => {
    expect(hold(new Map())).toMatch(/no audience profile was fetched/);
  });
  it("rejects a hold when the held title fits the venue's ages better than a weaker booked one", () => {
    expect(hold(new Map([["Old Joy", { "25_to_29": -0.1, "30_to_34": -0.02 }], ["Paterson", { "25_to_29": -0.13, "30_to_34": -0.1 }]])))
      .toMatch(/fits the venue's people 25-34 as well as or better than booked "Paterson"/);
    expect(hold(new Map([["Old Joy", { "25_to_29": -0.3 }]]))).toMatch(/booked "Paterson", no better on taste, has no audience profile/);
    expect(hold(new Map([["Old Joy", { "25_to_29": -0.3, "30_to_34": -0.2 }], ["Paterson", { "25_to_29": 0.1, "30_to_34": 0 }]]))).toBe("");
  });
  it("reads the venue's age bands from its audience", () => {
    expect(venueBands("people 25-34")).toEqual(["25_to_29", "30_to_34"]);
    expect(venueBands("students")).toEqual([]);
  });
});

describe("acts that share members", () => {
  it("allows one night between a band and its leader's project", () => {
    const p = { ...programme([event(), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [], same_act_as: ["Columbus"] }] };
    expect(checkProgramme(p, known).join("\n")).toMatch(/"Paterson" and "Columbus" share members/);
    const together = { ...programme([event({ featured: ["Paterson", "Columbus"] }), event({ featured: ["Old Joy"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: p.shortlist_notes };
    expect(checkProgramme(together, { ...known, names: new Set([...known.names, "Old Joy"]) })).toEqual([]);
  });
});

describe("titles no ranking scored", () => {
  const base = { ...known, shortlist: ["Paterson", "Old Joy"], tasteScores: new Map([["Paterson", { score: 0.94, callId: "q1" }]]) };
  const two = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })];
  const hold = (held_for: ShortlistNote["held_for"], title = "Old Joy") => checkProgramme({ ...programme(two), shortlist_notes: [
    { title: "Paterson", verdict: title === "Paterson" ? "reserve" : "programmed", reason: "", evidence: [], ...(title === "Paterson" ? { held_for } : {}) },
    ...(title === "Old Joy" ? [{ title: "Old Joy", verdict: "reserve" as const, reason: "", evidence: [], held_for }] : [{ title: "Old Joy", verdict: "programmed" as const, reason: "", evidence: [] }]),
  ] }, base).join("\n");
  it("cannot be held because the others have data", () => {
    expect(hold("slots")).toMatch(/no ranking scored it, so slots cannot be checked/);
  });
  it("can be held on Marquee's judgement, which a scored title cannot", () => {
    expect(hold("judgement")).not.toMatch(/Old Joy/);
    expect(hold("judgement", "Paterson")).toMatch(/"Paterson" was scored by Qloo/);
  });
});

describe("round 7 checks", () => {
  const two = [event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })];
  const base = { ...known, shortlist: ["Paterson", "Old Joy"] };
  const notes = (held: Partial<ShortlistNote>) => [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] },
    { title: "Old Joy", verdict: "reserve" as const, reason: "Held this month.", evidence: [], ...held }];
  it("does not accept a tie on taste as a weaker taste fit", () => {
    const k = { ...base, tasteScores: new Map([["Paterson", { score: 0.786, callId: "q9" }], ["Old Joy", { score: 0.78, callId: "q9" }]]) };
    expect(checkProgramme({ ...programme(two), shortlist_notes: notes({ held_for: "taste" }) }, k).join("\n")).toMatch(/tied with booked "Paterson" on taste \(q9\)/);
  });
  it("holds for local only when a booked title is clearly ahead in the city", () => {
    const k = { ...base, tasteScores: new Map([["Paterson", { score: 0.9, callId: "q1" }], ["Old Joy", { score: 0.8, callId: "q1" }]]),
      localCalls: new Map([["Paterson", "q2"], ["Old Joy", "q2"]]) };
    const run = (p: number) => checkProgramme({ ...programme(two), shortlist_notes: notes({ held_for: "local" }) },
      { ...k, localScores: new Map([["Paterson", { score: p, callId: "q2" }], ["Old Joy", { score: 0.86, callId: "q2" }]]) }).join("\n");
    expect(run(0.865)).toMatch(/no booked title is clearly ahead of it in the city ranking \(q2\)/);
    expect(run(0.9)).toBe("");
  });
  it("keeps missing data out of a held title's reason", () => {
    expect(checkProgramme({ ...programme(two), shortlist_notes: notes({ held_for: "rights", reason: "Rights unclear, and no city signal." }) }, base).join("\n"))
      .toMatch(/leave the missing data \("no city signal"\) out/);
    expect(checkProgramme({ ...programme(two), shortlist_notes: notes({ held_for: "slots", reason: "The Fridays went to acts with a London signal." }) }, base).join("\n"))
      .toMatch(/leave the missing data \("with a London signal"\) out/);
  });
  it("puts the push night on a Friday or Saturday", () => {
    const p = { ...programme([event({ date: "2026-11-05" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]), push: "2026-11-05" };
    expect(checkProgramme(p, known).join("\n")).toMatch(/push night 2026-11-05 is not a Friday or Saturday/);
    expect(checkProgramme({ ...p, push: "2026-11-07" }, known)).toEqual([]);
  });
});

describe("round 7 checks, after the re-runs", () => {
  it("fills free Fridays and Saturdays before a second weeknight", () => {
    const p = programme([event({ date: "2026-11-05" }), event({ featured: ["Columbus"], date: "2026-11-12" })]);
    expect(checkProgramme(p, known).join("\n")).toMatch(/2 events are on weeknights \(2026-11-05, 2026-11-12\) while 2026-11-06/);
  });
  it("asks a music bar to say which acts share members", () => {
    const p = { ...programme([event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] }] };
    expect(checkProgramme(p, { ...known, shortlist: ["Paterson"], kind: "music_bar" }).join("\n")).toMatch(/"Paterson" has no same_act_as/);
  });
});

describe("records nights", () => {
  it("accepts an act booked in person to DJ, and flags one only played on record", () => {
    const run = (on_record: boolean) => checkProgramme({ ...programme([event({ format: "DJ night", on_record }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [], same_act_as: [] }] }, { ...known, shortlist: ["Paterson"], kind: "music_bar" }).join("\n");
    expect(run(false)).toBe("");
    expect(run(true)).toMatch(/only appears on a records night/);
  });
});

describe("round 8 checks", () => {
  it("keeps ranks and comparisons out of verdict reasons", () => {
    const p = { ...programme([event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "Top of the Madrid ranking.", evidence: [] }] };
    expect(checkProgramme(p, { ...known, shortlist: ["Paterson"] }).join("\n")).toMatch(/the reason says "Top of the Madrid ranking"/);
  });
  it("does not push a night whose audience leans away from the venue's ages", () => {
    const p = { ...programme([event({ date: "2026-11-06" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]), push: "2026-11-06" };
    const k = { ...known, audience: "people 25-34", ages: new Map([["Paterson", { "25_to_29": 0.12, "30_to_34": -0.37 }]]) };
    expect(checkProgramme(p, k).join("\n")).toMatch(/push night features "Paterson", whose audience profile is below average/);
    expect(checkProgramme({ ...p, push: "2026-11-07" }, k).join("\n")).not.toMatch(/push night/);
  });
  it("spreads events across weekends", () => {
    const three = [event({ date: "2026-11-06" }), event({ featured: ["Columbus"], date: "2026-11-07" }), event({ featured: ["Old Joy"], date: "2026-11-08" })];
    const p = programme([...three, event({ featured: ["Alpha"], date: "2026-11-13" }), event({ featured: ["Beta"], date: "2026-11-20" })]);
    const names = new Set(["Paterson", "Columbus", "Old Joy", "Alpha", "Beta"]);
    expect(checkProgramme(p, { ...known, slots: 5, names }).join("\n")).toMatch(/weekend of 2026-11-06 has 3 events while the weekend of 2026-11-27 has none/);
  });
  it("finds counts with several words between number and noun", () => {
    expect(checkProgramme({ ...programme([event(), event({ featured: ["Columbus"], date: "2026-11-07" })]), headline: "Four Friday live sets and one swap" }, known).join("\n"))
      .toMatch(/headline states a count/);
  });
});

describe("round 9 checks", () => {
  it("gives acts that share members one night, from the separate question", () => {
    const p = programme([event({ featured: ["Paterson"] }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]);
    expect(checkProgramme(p, { ...known, sameActs: [["Paterson", "Columbus"]] }).join("\n")).toMatch(/"Paterson" and "Columbus" share members/);
  });
  it("leaves a bookshop's weeknight events and push day alone", () => {
    const p = { ...programme([event({ date: "2026-11-04", when: "Wednesday evening" }), event({ featured: ["Columbus"], date: "2026-11-12" })]), push: "2026-11-12" };
    expect(checkProgramme(p, { ...known, kind: "bookshop" })).toEqual([]);
    expect(checkProgramme(p, { ...known, kind: "cinema" }).join("\n")).toMatch(/2 events are on weeknights/);
  });
  it("asks for an audience profile of the push night's pick", () => {
    const p = { ...programme([event({ date: "2026-11-06", when: "Friday evening" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Saturday evening" })]), push: "2026-11-07" };
    expect(checkProgramme(p, { ...known, kind: "cinema", profiled: new Set(["Paterson"]) }).join("\n")).toMatch(/"Columbus" with no audience profile requested/);
    expect(checkProgramme(p, { ...known, kind: "cinema", profiled: new Set(["Columbus"]) })).toEqual([]);
  });
  it("keeps ranks out of an event's why", () => {
    expect(checkProgramme(programme([event({ why: "Top of the London ranking." }), event({ featured: ["Columbus"], date: "2026-11-07" })]), known).join("\n"))
      .toMatch(/the why says "Top of the London ranking"/);
  });
});

describe("rank talk, not dates", () => {
  it("allows ordinal dates and 'lead' but not ranking claims", () => {
    const run = (why: string) => checkProgramme(programme([event({ why }), event({ featured: ["Columbus"], date: "2026-11-07" })]), known).join("\n");
    expect(run("The first Friday of the month, leading into the long weekend.")).not.toMatch(/the why says/);
    expect(run("Second on taste and a near tie in Madrid.")).toMatch(/the why says/);
    expect(run("Top of the London ranking.")).toMatch(/the why says "Top of the London ranking"/);
  });
});

describe("push night taste", () => {
  it("does not push a title in the bottom half on taste", () => {
    const p = { ...programme([event({ date: "2026-11-06", when: "Friday evening" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Saturday evening" })]), push: "2026-11-07" };
    const tasteScores = new Map([["Paterson", { score: 0.9, callId: "q9" }], ["Alpha", { score: 0.85, callId: "q9" }], ["Beta", { score: 0.8, callId: "q9" }], ["Columbus", { score: 0.7, callId: "q9" }]]);
    expect(checkProgramme(p, { ...known, tasteScores }).join("\n")).toMatch(/"Columbus", in the bottom half of the taste ranking \(q9\)/);
    expect(checkProgramme({ ...p, push: "2026-11-06" }, { ...known, tasteScores }).join("\n")).not.toMatch(/bottom half/);
    expect(checkProgramme(p, { ...known, tasteScores, kind: "bookshop" }).join("\n")).not.toMatch(/bottom half/);
  });
});

describe("music venues", () => {
  const venue = { ...known, shortlist: ["Paterson"], kind: "music_venue" };
  const notes = [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [], same_act_as: [] }];
  it("asks which acts share members, as at a music bar", () => {
    const p = { ...programme([event({ source: "shortlist" }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]),
      shortlist_notes: [{ title: "Paterson", verdict: "programmed" as const, reason: "", evidence: [] }] };
    expect(checkProgramme(p, venue).join("\n")).toMatch(/"Paterson" has no same_act_as/);
  });
  it("rejects a support act more widely known than its headliner", () => {
    const run = (head: number, sup: number) => checkProgramme({ ...programme([event({ featured: ["Paterson", "Old Joy"] }),
      event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]), shortlist_notes: notes },
    { ...venue, tasteScores: new Map([["Paterson", { score: 0.95, callId: "q1", popularity: head }], ["Old Joy", { score: 0.94, callId: "q1", popularity: sup }]]) }).join("\n");
    expect(run(0.9, 0.97)).toMatch(/support "Old Joy" is more widely known than headliner "Paterson"/);
    expect(run(0.95, 0.96)).not.toMatch(/more widely known/);
  });
  it("sizes a support act from discovery by the popularity any Qloo result gave it", () => {
    const p = { ...programme([event({ featured: ["Paterson", "Old Joy"] }), event({ featured: ["Columbus"], date: "2026-11-07", when: "Week 1, Saturday evening" })]), shortlist_notes: notes };
    const tasteScores = new Map([["Paterson", { score: 0.95, callId: "q1", popularity: 0.9 }]]);
    const popularity = new Map([["Old Joy", { popularity: 0.99, callId: "q3" }]]);
    expect(checkProgramme(p, { ...venue, tasteScores, popularity }).join("\n")).toMatch(/support "Old Joy" is more widely known than headliner "Paterson" in Qloo's data \(q3\)/);
  });
});
