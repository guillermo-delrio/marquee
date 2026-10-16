import type { ShortlistNote, VenueKind } from "./types";

/** Verdict and section labels in each venue's own words: a bookshop puts a book on a table, a bar plays a record. */
export function verdictLabels(kind: VenueKind): Record<ShortlistNote["verdict"], string> {
  const featured = kind === "bookshop" ? "On a table" : kind === "music_bar" ? "Played, not booked" : kind === "music_venue" ? "Club-night playlist" : "Featured";
  return { programmed: "Programmed", featured, reserve: "Reserve", skip: "Skip", not_found: "Check the title" };
}

export const soundtrackTitle = (kind: VenueKind) => (kind === "bookshop" ? "In-store playlist" : "Pre-show soundtrack");

/** The verb for titles with the verdict featured, in the owner summary line. */
export const featuredVerb = (kind: VenueKind) => (kind === "bookshop" ? "Put on a table:" : kind === "music_bar" ? "Play on record:" : kind === "music_venue" ? "Play at a club night:" : "Feature:");

/** Why a held title is held, as code checked it against the data (see the server's holdProblem). */
export const heldLabel = (h: NonNullable<ShortlistNote["held_for"]>, city: string): string => ({
  taste: "weaker taste fit", local: `weaker in ${city}`, audience: "audience profile", size: "too big for the room",
  same_act: "same act as another night", format: "format", judgement: "Marquee's judgement", rights: "rights", slots: "no slot left",
})[h];
