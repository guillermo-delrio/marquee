import type { Programme, ProgrammeEvent } from "./types";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A day of `month` written in the hint: "15 Nov", "Nov 15", "22 November". */
function writtenDay(w: string, m: number): number | null {
  const name = MONTHS[m - 1];
  const hit = new RegExp(`\\b(\\d{1,2})\\s+${name}|\\b${name}[a-z]*\\s+(\\d{1,2})\\b`).exec(w);
  return hit ? Number(hit[1] ?? hit[2]) : null;
}

/**
 * Place an event in the month: its own ISO date when it has one inside the month, else a date written in the
 * hint, else "Week 2, Friday" counted from the 1st; unreadable hints spread across the month.
 */
export function dateFor(when: string, month: string, index: number, total: number, iso?: string, start?: string): Date {
  const [y, m] = month.split("-").map(Number);
  const w = when.toLowerCase();
  const week = Number(/week\s*(\d)/.exec(w)?.[1] ?? 0);
  const day = DAYS.findIndex((d) => w.includes(d));
  const own24 = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(start ?? "");
  const hour = own24 ? Number(own24[1]) : /matin|afternoon|morning|lunch/.test(w) ? 16 : 19;
  const minute = own24 ? Number(own24[2]) : hour === 19 ? 30 : 0;
  const last = new Date(y, m, 0).getDate();
  const own = iso?.startsWith(`${month}-`) ? Number(iso.slice(8, 10)) : writtenDay(w, m);
  if (own && own >= 1 && own <= last) return new Date(y, m - 1, own, hour, minute);
  if (week >= 1 && day >= 0) {
    const first = new Date(y, m - 1, 1 + (week - 1) * 7);
    const offset = (day - first.getDay() + 7) % 7;
    const date = new Date(y, m - 1, first.getDate() + offset, hour, minute);
    if (date.getMonth() === m - 1) return date;
  }
  return new Date(y, m - 1, 1 + Math.round((index * (last - 1)) / Math.max(total, 1)), hour, minute);
}

const stamp = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T` +
  `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;

const escape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

export function toIcs(programme: Programme, month: string, venue: string): string {
  const events = programme.events.map((e: ProgrammeEvent, i) => {
    const start = dateFor(e.when, month, i, programme.events.length, e.date, e.start_time);
    const end = new Date(start.getTime() + (e.runtime_minutes ?? 120) * 60 * 1000);
    return [
      "BEGIN:VEVENT",
      `UID:marquee-${month}-${i}@marquee.local`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(e.title)}`,
      `DESCRIPTION:${escape(`${e.format}. ${e.featured.join(", ")}. ${e.why}`)}`,
      `LOCATION:${escape(venue)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Marquee//Programme//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function toMarkdown(programme: Programme, month: string, location: string): string {
  const lines = [`# ${programme.headline}`, "", `_${location}, ${month}_`, "", programme.audience_read, ""];
  for (const e of programme.events) {
    lines.push(`## ${e.when}: ${e.title}`, `${e.format} · ${e.featured.join(", ")} · confidence ${e.confidence}`, "", e.why, "");
    for (const ev of e.evidence) lines.push(`- ${ev.call_id}: ${ev.claim}`);
    lines.push("");
  }
  lines.push("## Limits", ...programme.limits.map((l) => `- ${l}`), "", "## Before you commit", ...programme.next_checks.map((n) => `- ${n}`));
  return lines.join("\n");
}
