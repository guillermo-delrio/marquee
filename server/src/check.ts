import type { Programme } from "./types.js";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Qloo stores some names HTML-escaped ("Writers &amp; Lovers"); show and compare them decoded. */
export const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#39|apos|lt|gt);/g, (_, e: string) => ({ amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">" })[e] ?? _);

/** Names compare without case, curly quotes or dash variants: Qloo writes "Emma‐Jean" with U+2010. */
export const normalName = (s: string) =>
  decodeEntities(s).normalize("NFKC").toLowerCase().replace(/[‐-―]/g, "-").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Every entity name a Qloo envelope mentions: results, trend series, interpretations and resolution candidates. */
export function namesIn(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => namesIn(v, into));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.name === "string") into.add(normalName(o.name));
    Object.values(o).forEach((v) => namesIn(v, into));
  }
  return into;
}

/**
 * Rules the prompt states and code enforces: the number of events, dates inside the month on the weekday named,
 * featured titles that Qloo returned, and citations of calls that happened. Returns the problems, empty when none.
 */
export function checkProgramme(
  p: Programme,
  known: { month: string; slots: number; names: Set<string>; callIds: Set<string>; shortlist?: string[] },
): string[] {
  const problems: string[] = [];
  const names = new Set([...known.names].map(normalName));
  const shortlist = new Set((known.shortlist ?? []).map(normalName));
  const featured = new Set(p.events.flatMap((e) => e.featured.map(normalName)));
  if (shortlist.size) {
    const notes = new Map((p.shortlist_notes ?? []).map((n) => [normalName(n.title), n]));
    for (const title of known.shortlist ?? []) {
      const note = notes.get(normalName(title));
      if (!note) problems.push(`shortlist_notes has no verdict for "${title}"; give one for every shortlisted title.`);
      else if (featured.has(normalName(title)) !== (note.verdict === "programmed")) {
        problems.push(featured.has(normalName(title))
          ? `"${title}" is featured in the programme but its verdict is ${note.verdict}; use programmed.`
          : `"${title}" has the verdict programmed but no event features it.`);
      }
    }
  }
  if (p.events.length !== known.slots) problems.push(`The programme must have exactly ${known.slots} events, not ${p.events.length}.`);
  for (const partner of p.partners ?? []) {
    if (!names.has(normalName(partner.name))) problems.push(`Partner "${partner.name}" does not appear in any Qloo result; suggest only places Qloo returned.`);
  }
  p.events.forEach((e, i) => {
    const at = `Event ${i + 1} ("${e.title}")`;
    for (const f of e.featured) if (!names.has(normalName(f))) problems.push(`${at}: "${f}" does not appear in any Qloo result; feature only returned titles, named as returned.`);
    for (const c of e.evidence) if (!known.callIds.has(c.call_id)) problems.push(`${at}: ${c.call_id} is not a call in this run.`);
    if (e.source === "shortlist" && !e.featured.some((f) => shortlist.has(normalName(f)))) {
      problems.push(`${at}: marked as from the shortlist but features none of it.`);
    }
    if (e.start_time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.start_time)) problems.push(`${at}: start_time "${e.start_time}" is not 24-hour HH:MM.`);
    if (!e.date?.startsWith(`${known.month}-`)) {
      problems.push(`${at}: date ${e.date ?? "(missing)"} is outside ${known.month}.`);
      return;
    }
    const day = DAYS[new Date(`${e.date}T12:00:00Z`).getUTCDay()];
    const named = DAYS.find((d) => e.when.toLowerCase().includes(d));
    if (named && named !== day) {
      problems.push(`${at}: ${e.date} is a ${day[0].toUpperCase()}${day.slice(1)}, but \`when\` says ${named[0].toUpperCase()}${named.slice(1)}.`);
    }
  });
  return problems;
}
