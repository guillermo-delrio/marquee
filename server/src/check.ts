import type { Programme, ShortlistNote } from "./types.js";

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

/** Qloo's age bands that overlap the ages in a venue's audience ("people 25-34" gives 25_to_29 and 30_to_34). */
const BANDS: [string, number, number][] = [["24_and_younger", 0, 24], ["25_to_29", 25, 29], ["30_to_34", 30, 34], ["35_to_44", 35, 44],
  ["45_to_54", 45, 54], ["55_and_older", 55, 120]];
export const venueBands = (audience = "") => {
  const m = audience.match(/(\d{2})\s*(?:-|–|to)\s*(\d{2})/);
  return m ? BANDS.filter(([, lo, hi]) => lo <= Number(m[2]) && hi >= Number(m[1])).map(([k]) => k) : [];
};

/** Scores less than this apart within one call are a tie. */
const TIE = 0.01;

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
    /** For each title the taste ranking of the shortlist (no location) scored, its affinity and the call. */
    tasteScores?: Map<string, { score: number; callId: string; popularity?: number }>;
    /** The names each call returned, so a citation can be checked against the call it names. */
    callNames?: Map<string, Set<string>>;
    /** Each profiled title's age skews (Qloo's keys, such as "25_to_29"), from qloo_audience_demographics. */
    ages?: Map<string, Record<string, number>>;
    /** The venue's stated audience, such as "people 25-34". */
    audience?: string;
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
  const lookup = <T,>(m: Map<string, T> | undefined, title: string) => [...(m ?? [])].find(([n]) => normalName(n) === normalName(title))?.[1];
  // Booked shortlist titles with a taste score, the bar a held title is measured against.
  const programmedOnTaste = (p.shortlist_notes ?? []).filter((n) => n.verdict === "programmed")
    .flatMap((n) => { const t = lookup(known.tasteScores, n.title); return t ? [{ title: n.title, score: t.score, popularity: t.popularity }] : []; });
  const fit = (ages: Record<string, number>) => venueBands(known.audience).reduce((t, k) => t + (ages[k] ?? 0), 0);
  /**
   * Why a bookable title is held is checked against the data, not the wording: each reason names something code can
   * see (a ranking, a profile, Qloo's popularity, a shared act in the programme), except format and rights. A title with
   * no local data that beats a booked title on taste was held for want of data unless one of those holds it.
   */
  const holdProblem = (note: ShortlistNote, title: string): string | null => {
    const own = lookup(known.tasteScores, title);
    const hasLocal = !!lookup(known.localCalls, title);
    const weaker = own ? programmedOnTaste.filter((x) => own.score - x.score >= TIE) : [];
    const h = note.held_for;
    if (!h) return `"${title}" (${note.verdict}) has no held_for; say what holds it back.`;
    if (h === "local" && !hasLocal) return `"${title}" is held for its local fit, but no city ranking scored it: no local data is not a weak local fit.`;
    if (h === "taste" && !own) return `"${title}" is held for its taste fit, but the taste ranking did not score it: no data is not a weak fit.`;
    if ((h === "taste" || h === "slots" || h === "local") && weaker.length) {
      const w = weaker[0];
      return h === "local"
        ? null
        : `"${title}" out-ranks booked "${w.title}" on taste (${own!.callId}), so ${h} is not why it is held${hasLocal ? "; if the city ranking is, held_for is local" : ", and it has no local data, which is not a reason"}. Book it in place of a weaker taste fit, or give the held_for that is true.`;
    }
    if (h === "audience") {
      const mine = lookup(known.ages, title);
      if (!mine) return `"${title}" is held for its audience, but no audience profile was fetched for it.`;
      // Every booked title it beats on taste needs a profile that fits the venue's ages better; an unprofiled one
      // would mean the missing profile decided.
      const against = venueBands(known.audience).length ? weaker.find((x) => { const a = lookup(known.ages, x.title); return !a || fit(a) <= fit(mine); }) : undefined;
      if (against) return lookup(known.ages, against.title)
        ? `"${title}" is held for its audience, but its profile fits the venue's ${known.audience} as well as or better than booked "${against.title}", which it out-ranks on taste.`
        : `"${title}" is held for its audience, but booked "${against.title}", which it out-ranks on taste, has no audience profile to compare.`;
    }
    if (h === "size") {
      const pop = own?.popularity;
      const bigger = programmedOnTaste.find((x) => x.popularity !== undefined && pop !== undefined && x.popularity >= pop);
      if (pop === undefined) return `"${title}" is held as too big, but the taste ranking gave no popularity for it.`;
      if (bigger) return `"${title}" is held as too big, but booked "${bigger.title}" is at least as widely known in Qloo's data.`;
    }
    if (h === "same_act" && !(note.same_act_as ?? []).some((o) => featured.has(normalName(o)))) {
      return `"${title}" is held as the same act as another, but same_act_as names no act in the programme.`;
    }
    if (h === "format" && known.kind === "music_bar") return `"${title}": format is not a reason at a music bar; give the held_for that is true.`;
    return null;
  };
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
        const localCall = lookup(known.localCalls, title);
        if (note.verdict === "skip" && localCall && !note.evidence.includes(localCall)) {
          problems.push(`"${title}" is skipped without citing ${localCall}, the city ranking that scored it; weigh both rankings.`);
        }
        if (note.verdict === "programmed" && known.kind === "music_bar") {
          const nights = p.events.filter((e) => e.featured.some((f) => normalName(f) === normalName(title)));
          if (nights.length && nights.every((e) => RECORDS.test(e.format))) problems.push(`"${title}" is marked programmed but only appears on a records night; use featured (played, not booked) or book it live.`);
        }
        const benched = note.verdict === "skip" || note.verdict === "reserve" || (note.verdict === "featured" && inProgramme);
        if (benched) {
          const problem = holdProblem(note, title);
          if (problem) problems.push(problem);
        }
      }
    }
  }
  // Acts that share members are one act: one night between them, records nights included.
  for (const n of p.shortlist_notes ?? []) for (const other of n.same_act_as ?? []) {
    if (normalName(other) !== normalName(n.title) && featured.has(normalName(n.title)) && featured.has(normalName(other))) {
      problems.push(`"${n.title}" and "${other}" share members, so they are one act; give them one night between them.`);
    }
  }
  if (p.events.length !== known.slots) problems.push(`The programme must have exactly ${known.slots} events, not ${p.events.length}.`);
  for (const partner of p.partners ?? []) {
    if (!names.has(normalName(partner.name))) problems.push(`Partner "${partner.name}" does not appear in any Qloo result; suggest only places Qloo returned.`);
    else if (known.callNames && !partner.evidence.some((c) => known.callNames!.get(c)?.has(normalName(partner.name)))) {
      problems.push(`Partner "${partner.name}" cites ${partner.evidence.join(", ") || "no call"}, which did not return it; cite the call that did.`);
    }
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
