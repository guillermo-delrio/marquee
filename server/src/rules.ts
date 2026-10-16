import type { VenueInput } from "./types.js";

/** What each venue type programmes, and how Qloo names it. */
export const TARGET: Record<VenueInput["kind"], {
  type: string; noun: string; formats: string; trends: boolean; competitor: string; extra: string; soundtrack: boolean;
}> = {
  cinema: {
    type: "movie", noun: "films", formats: "screenings, double bills, themed seasons, introduced screenings, Q&As", trends: true,
    competitor: "another cinema", soundtrack: true,
    extra: "- In a country where films are usually dubbed, each event's version says original version or dubbed, in the local term (in Spain: VOSE for a subtitled original, VO for a film in Spanish or with no dialogue); flag in next_checks films whose distributor rarely books small venues (streaming-platform films, some studios); a film with its own intermission gets no added interval; family matinees are usually dubbed unless the film has no dialogue. Call a film by what it is (a quiet drama, a slow film), and do not oversell it.",
  },
  bookshop: {
    type: "book", noun: "books", formats: "book clubs, readings, themed tables, author events, swaps", trends: false,
    competitor: "another bookshop", soundtrack: true,
    extra: "- A book club needs reading time: hold the first one at least four weeks after today, and put ordering and announcing it now (this week) in next_checks. Events at a bookshop are usually free, so partner offers must not rely on tickets. On the year's big retail days (Small Business Saturday, the run-up to Christmas) events should sell books (a gift table, a signing, staff picks), never a swap. A reading means the author is present: only plan one when an author on tour plausibly fits, and say it needs confirming with the publisher; a staff-led event is a discussion or a staff-picks night. One book club a month. Bookshop events usually run on weeknights (Tuesday to Thursday), swaps on quiet weekend afternoons, and a retail day such as Small Business Saturday may be the push. Partners must not draw spending away from the shop's own café. For a bookshop, the verdict featured means on a table (a gift, themed or staff-pick table, even during an event); programmed means a reading, book club or author event is about that book.",
  },
  music_bar: {
    type: "artist", noun: "artists", formats: "live sets, listening sessions, DJ nights, themed nights", trends: true,
    competitor: "another bar, pub, music venue or club (look for cafés, restaurants or record shops instead)", soundtrack: false,
    extra: "- Live sets go to acts on the venue's list first. An act from outside the list may play live only if, from what you know of where it usually plays, it is no bigger than the list's acts; otherwise give it a DJ or listening night. A listed act too big for the room gets a listening or DJ night and the verdict \"featured\" (played, not booked), or skip. Friday and Saturday are the bar's busiest nights: DJ and late nights start at 21:00 or later and run past midnight; listening sessions suit a weeknight or the early evening before a DJ. Each event says whether an act is booked in person (with a fee) or only played on record; an act only played on record needs no availability check. Acts likely to play the month's big festival may be held by radius clauses: put that in next_checks, with whether the door takes (capacity times a typical ticket price) can cover each live act's fee. A band and its members' own projects (for example a bandleader's solo work or DJ sets) are one act: give them one night between them, records and listening nights included. Before choosing, think through which listed and programmed acts share members.",
  },
};

/**
 * The programme rules both plans follow: the one with Qloo and the control without it. Keeping them shared means the
 * comparison measures what Qloo's data changes, not what the prompt does.
 */
export const sharedRules = (kind: VenueInput["kind"]) => {
  const t = TARGET[kind];
  return `- Exactly the requested number of events across the requested month, in formats suited to the venue (${t.formats}). Vary the formats.
- The recent hits are what the venue's regulars loved: signals, not picks. Do not programme them again unless the venue's constraints ask for a reprise.
- Each event has a start_time (24-hour HH:MM) that fits local custom and the format: late shows late, double bills earlier, matinees in the afternoon. Its runtime_minutes is the event's length: for a film, the film plus about 15 minutes of trailers (and a 15-minute interval in a double bill); for other events, a realistic estimate.
- Put the strongest events, the push night above all, on Friday and Saturday evenings; weeknights take the specialist and smaller events. Within the venue's stated days, prefer a free Friday or Saturday to a second weeknight.
- Plan around the month's calendar in the venue's own country and city: public holidays, long weekends, major festivals in the venue's field that month (for example the London Jazz Festival in November), and local retail peaks (for example Thanksgiving and Small Business Saturday in the US; do not import another country's events such as Black Friday where they mean little). State public holidays you are sure of as facts (for example a city's patron-saint holiday), and plan around the eve of each. A holiday that falls on a Sunday moves to the Monday in some regions and years: if you rely on one you are unsure of, say so in next_checks. Spread the events across the month's weekends rather than stacking one weekend. Nothing you write anywhere may contradict the dates you chose.
- A family slot must suit families (content rating, length, dialogue or dubbing).
${t.extra}
- If the venue gives titles it can book, build mainly from them and give every one a verdict in shortlist_notes: programmed, featured (played or discussed but not booked), reserve (fits but no slot), skip (a clear poor fit, say why; a title whose scores sit close to the booked ones is reserve, not skip) or not_found. Titles not on the list may fill at most one event in three, when they suit the regulars better, marked as not on the list so the venue checks availability.
- push: the date (YYYY-MM-DD) of the one event to push hardest. It should be an event of the venue's core format (a screening for a cinema, a live set for a music bar, an author event, book club or the month's big retail day for a bookshop), not a filler night.
- summary: two short bullets for the owner, in plain words with no call ids, handles, scores or decimals: what the month is, and the one night to push hardest and why. Do not restate the verdicts, and state no counts of events or picks in the summary or the headline: the page shows them.
- A partner's offer must not clash with the venue's own event at the same time, and must name the day and date of the event it is tied to correctly.
- Write everything in the third person ("Marquee's judgement", never "I" or "my"); refer to bands, duos and groups as "they", in plain words an owner would use ("a near tie", "widely known"), not raw scores, and never imply ticket sales: say what taste or local data suggests, not what "did best" or "sold".
- next_checks are things the venue can do itself (rights and availability, pre-sales, asking regulars), never something you already know, and never a choice the plan has already made.
- Never send or ask for personal data; work only with places, titles, artists, tags and broad audience descriptions.`;
};
