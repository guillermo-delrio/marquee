import { describe, expect, it } from "vitest";

import { dateFor, toIcs } from "./calendar";
import type { Programme } from "./types";

const programme: Programme = {
  headline: "A quiet November",
  audience_read: "",
  events: [{ title: "Paterson night", when: "Week 1, Thursday evening", format: "Screening", featured: ["Paterson"], why: "",
    evidence: [], confidence: "medium" }],
  limits: [],
  next_checks: [],
};

describe("calendar", () => {
  it("maps week and weekday hints onto the month", () => {
    expect(dateFor("Week 1, Thursday evening", "2026-11", 0, 4).toDateString()).toBe(new Date(2026, 10, 5).toDateString());
    expect(dateFor("Week 3, Sunday matinee", "2026-11", 0, 4).getHours()).toBe(16);
  });
  it("prefers the event's own date, then a date written in the hint, over week counting", () => {
    // The model and a week grid disagree about where week 2 starts in a month that begins on a Sunday.
    expect(dateFor("Week 2, Sunday evening", "2026-11", 0, 4, "2026-11-15").getDate()).toBe(15);
    expect(dateFor("Week 2, Sunday evening (15 Nov)", "2026-11", 0, 4).getDate()).toBe(15);
    expect(dateFor("Sunday 22 November, matinee", "2026-11", 0, 4).getDate()).toBe(22);
    expect(dateFor("Week 1, Thursday evening", "2026-11", 0, 4, "2026-12-03").getDate()).toBe(5); // outside the month: ignored
  });
  it("uses the event's own start time when it has one", () => {
    const d = dateFor("Week 3, Friday late show", "2026-11", 0, 4, "2026-11-20", "22:30");
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([20, 22, 30]);
    expect(dateFor("Week 3, Friday evening", "2026-11", 0, 4, "2026-11-20", "7pm").getHours()).toBe(19); // unreadable: the old guess
  });
  it("ends a calendar event after its runtime", () => {
    const ics = toIcs({ ...programme, events: [{ ...programme.events[0], date: "2026-11-05", start_time: "20:00", runtime_minutes: 135 }] }, "2026-11", "Lavapiés");
    expect(ics).toMatch(/DTSTART:20261105T200000/);
    expect(ics).toMatch(/DTEND:20261105T221500/);
  });
  it("spreads unreadable hints across the month", () => {
    expect(dateFor("Sometime", "2026-11", 2, 4).getMonth()).toBe(10);
  });
  it("writes one calendar event per programme event", () => {
    expect(toIcs(programme, "2026-11", "Lavapiés").match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
