import type { VenueInput } from "./types.js";

/** What each venue type programmes, and how Qloo names it. */
export const TARGET: Record<VenueInput["kind"], {
  type: string; noun: string; formats: string; trends: boolean; competitor: string; extra: string; soundtrack: boolean;
}> = {
  cinema: {
    type: "movie", noun: "films", formats: "screenings, double bills, themed seasons, introduced screenings, Q&As", trends: true,
    competitor: "another cinema", soundtrack: true,
    extra: "- In a country where films are usually dubbed, each event's version says original version or dubbed; family matinees are usually dubbed unless the film has no dialogue.",
  },
  bookshop: {
    type: "book", noun: "books", formats: "book clubs, readings, themed tables, author events, swaps", trends: false,
    competitor: "another bookshop", soundtrack: true,
    extra: "- A book club needs reading time: hold the first one at least four weeks after today, and put the stock order-by date in next_checks. Events at a bookshop are usually free, so partner offers must not rely on tickets.",
  },
  music_bar: {
    type: "artist", noun: "artists", formats: "live sets, listening sessions, DJ nights, themed nights", trends: true,
    competitor: "another music venue or club", soundtrack: false,
    extra: "- A live set must be by an act a room of this size could plausibly book; for bigger names use a listening or DJ night and give the shortlist verdict \"featured\" (played, not booked).",
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
- Each event has a start_time (24-hour HH:MM) that fits local custom and the format: late shows late, double bills earlier, matinees in the afternoon.
- Plan around the month's calendar in the venue's country: public holidays, long weekends and retail peaks (for example Thanksgiving week and Small Business Saturday in the US). Nothing you write anywhere may contradict the dates you chose.
- A family slot must suit families (content rating, length, dialogue or dubbing).
${t.extra}
- If the venue gives titles it can book, build mainly from them and give every one a verdict in shortlist_notes: programmed, featured (played or discussed but not booked), reserve (fits but no slot), skip (poor fit, say why) or not_found.
- summary: three short bullets for the owner, in plain words with no call ids, handles, scores or decimals: what the month is, which bookable titles to take or pass, and the one night to push hardest.
- Write why, verdict reasons and the summary in plain words an owner would use ("top of the city's ranking", "a near tie", "widely known"), not raw scores.
- next_checks are things the venue can do itself (rights and availability, pre-sales, asking regulars), never something you already know.
- Never send or ask for personal data; work only with places, titles, artists, tags and broad audience descriptions.`;
};
