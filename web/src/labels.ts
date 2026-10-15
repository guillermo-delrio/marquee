import type { ShortlistNote, VenueKind } from "./types";

/** Verdict and section labels in each venue's own words: a bookshop puts a book on a table, a bar plays a record. */
export function verdictLabels(kind: VenueKind): Record<ShortlistNote["verdict"], string> {
  const featured = kind === "bookshop" ? "On a table" : kind === "music_bar" ? "Played, not booked" : "Featured";
  return { programmed: "Programmed", featured, reserve: "Reserve", skip: "Skip", not_found: "Check the title" };
}

export const soundtrackTitle = (kind: VenueKind) => (kind === "bookshop" ? "In-store playlist" : "Pre-show soundtrack");

/** The verb for titles with the verdict featured, in the owner summary line. */
export const featuredVerb = (kind: VenueKind) => (kind === "bookshop" ? "Put on a table:" : kind === "music_bar" ? "Play on record:" : "Feature:");
