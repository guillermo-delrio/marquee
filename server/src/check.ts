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

/** A reason that treats a title's absence from a ranking as evidence against it. */
const COUNT = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(?:[a-z-]+\s+)?(picks?|events?|nights?|evenings?|titles?|films?|books?|acts?|shows?|screenings?|sets?)\b/i;
const RECORDS = /\b(listening|records?|vinyl|dj)\b/i;

/** A reason of its own beside the missing data: no slot, room size, runtime, family fit, rights, a weak taste fit... */
const OTHER_REASON = /\b(slot|room|space|runtime|long|length|family|big|fee|budget|rights|availab|repeat|clash|weak|low|weaker|lowest|tie)\w*/i;
const MISSING_AS_REASON = /\b(absent|missing|not ranked|isn't ranked|no(?: [\w-]+){0,2} (?:signal|data))\b/i;

/**
 * Rules the prompt states and code enforces: the number of events, dates inside the month on the weekday named,
 * featured titles that Qloo returned, and citations of calls that happened. Returns the problems, empty when none.
 */
export function checkProgramme(
  p: Programme,
  known: {
    month: string; slots: number; names: Set<string>; callIds: Set<string>; shortlist?: string[]; checkedLocally?: Set<string>;
    /** Titles Qloo's taste discovery returned for the venue's hits. */
    discovered?: Set<string>;
    /** For each title a local ranking scored, the id of that call. */
    localCalls?: Map<string, string>;
    kind?: string;
  },
): string[] {
  const problems: string[] = [];
  // Counts belong to the page, which computes them; the model's own counts drift from its plan.
  for (const [where, text] of [["headline", p.headline], ...(p.summary ?? []).map((s) => ["summary", s] as const)] as const) {
    if (COUNT.test(text ?? "")) problems.push(`The ${where} states a count ("${(text ?? "").match(COUNT)![0]}"); leave counts to the page.`);
  }
  const names = new Set([...known.names].map(normalName));
  const shortlist = new Set((known.shortlist ?? []).map(normalName));
  const discovered = new Set([...(known.discovered ?? [])].map(normalName));
  const featured = new Set(p.events.flatMap((e) => e.featured.map(normalName)));
  if (shortlist.size) {
    const notes = new Map((p.shortlist_notes ?? []).map((n) => [normalName(n.title), n]));
    for (const title of known.shortlist ?? []) {
      const note = notes.get(normalName(title));
      if (!note) problems.push(`shortlist_notes has no verdict for "${title}"; give one for every shortlisted title.`);
      else {
        const inProgramme = featured.has(normalName(title));
        const used = note.verdict === "programmed" || note.verdict === "featured";
        if (inProgramme !== used) {
          problems.push(inProgramme
            ? `"${title}" is in the programme but its verdict is ${note.verdict}; use programmed (booked) or featured (played, not booked).`
            : `"${title}" has the verdict ${note.verdict} but no event features it.`);
        }
        if (note.verdict === "not_found" && discovered.has(normalName(title))) {
          problems.push(`"${title}" came back from taste discovery on the venue's hits, so Qloo matched the right act; programme or judge it, and note the description looks wrong if it does.`);
        }
        const localCall = [...(known.localCalls ?? [])].find(([n]) => normalName(n) === normalName(title))?.[1];
        if (note.verdict === "skip" && localCall && !note.evidence.includes(localCall)) {
          problems.push(`"${title}" is skipped without citing ${localCall}, the city ranking that scored it; weigh both rankings.`);
        }
        if (note.verdict === "programmed" && known.kind === "music_bar") {
          const nights = p.events.filter((e) => e.featured.some((f) => normalName(f) === normalName(title)));
          if (nights.length && nights.every((e) => RECORDS.test(e.format))) problems.push(`"${title}" is marked programmed but only appears on a records night; use featured (played, not booked) or book it live.`);
        }
        // Missing data never benches a title the venue can book: judge it on what is known, or say so and programme it.
        const benched = note.verdict === "skip" || note.verdict === "reserve" || (note.verdict === "featured" && inProgramme);
        if (benched && MISSING_AS_REASON.test(note.reason) && !OTHER_REASON.test(note.reason.replace(MISSING_AS_REASON, ""))) {
          problems.push(`"${title}": the reason rests on missing data ("${note.reason.match(MISSING_AS_REASON)![0]}"); missing is not a low score. Rewrite the reason from what Qloo did return or from the programme itself (for example that the live or headline slots are already taken by stronger fits, or the room is too small), or book it.`);
        }
      }
    }
  }
  if (p.events.length !== known.slots) problems.push(`The programme must have exactly ${known.slots} events, not ${p.events.length}.`);
  for (const partner of p.partners ?? []) {
    if (!names.has(normalName(partner.name))) problems.push(`Partner "${partner.name}" does not appear in any Qloo result; suggest only places Qloo returned.`);
  }
  // One night per name: the same title or act on two nights is a repeat, not a month.
  const seen = new Map<string, number>();
  p.events.forEach((e, i) => e.featured.forEach((f) => {
    const k = normalName(f);
    if (seen.has(k)) problems.push(`"${f}" appears in events ${seen.get(k)! + 1} and ${i + 1}; give each title or act one night.`);
    else seen.set(k, i);
  }));
  p.events.forEach((e, i) => {
    const at = `Event ${i + 1} ("${e.title}")`;
    for (const f of e.featured) if (!names.has(normalName(f))) problems.push(`${at}: "${f}" does not appear in any Qloo result; feature only returned titles, named as returned.`);
    for (const c of e.evidence) if (!known.callIds.has(c.call_id)) problems.push(`${at}: ${c.call_id} is not a call in this run.`);
    if (e.source === "taste" && known.checkedLocally) {
      const local = new Set([...known.checkedLocally].map(normalName));
      for (const f of e.featured) {
        if (!local.has(normalName(f))) problems.push(`${at}: "${f}" is a taste pick that was never checked in the city; rank it with the venue's location before programming it (step 3).`);
      }
    }
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
