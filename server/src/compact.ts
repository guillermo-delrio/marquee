import { decodeEntities } from "./check.js";
import type { QlooEnvelope } from "./types.js";

/**
 * Live qloo mcp envelopes are 2-45 kB, mostly provider metadata, provenance and query intent. Sending them whole
 * cost tokens and, once clipped, hid the results themselves (an empty rank came after the cut). The model gets
 * the status, what each input resolved to, open issues with their candidates, and trimmed results; the research
 * trail in the app keeps the full envelope.
 */
const DROP = new Set(["image", "provenance", "alternatives", "provider", "contract_version", "schema_version", "execution", "query_intent"]);
const MAX_RESULTS = 15;
const MAX_CANDIDATES = 5;
const MAX_TEXT = 220;

function trim(value: unknown): unknown {
  if (typeof value === "number") return Number.isInteger(value) ? value : Number(value.toFixed(3));
  if (typeof value === "string") {
    // Qloo writes some names with typographic hyphens (U+2010): show them as plain hyphens.
    const s = decodeEntities(value).replace(/[\u2010-\u2013]/g, "-");
    return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
  }
  if (Array.isArray(value)) return value.map(trim);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !DROP.has(k)).map(([k, v]) => [k, trim(v)]));
  }
  return value;
}

/** Fields the model gets in a shaped form (or not at all); anything else Qloo adds passes through trimmed. */
const SHAPED = new Set([...DROP, "operation", "status", "summary", "interpretation", "resolution", "results", "series", "result_count",
  "explainability", "warnings", "error"]);

/** Most operations return `results`; trends returns `series`. */
const listKey = (e: QlooEnvelope): "results" | "series" => (!Array.isArray(e.results) && Array.isArray(e.series) ? "series" : "results");
const listOf = (e: QlooEnvelope): unknown[] => {
  const list = e[listKey(e)];
  return Array.isArray(list) ? list : [];
};
const hasPoints = (item: unknown) => {
  const points = (item as { points?: unknown[] } | null)?.points;
  return !Array.isArray(points) || points.length > 0;
};
/**
 * Qloo's tag lists mix in tags meant for places (amenities, payment cards, hotel ratings, place genres) even for
 * films, books and artists (types ending :place or :brand, amenities, payment cards); they say nothing about an
 * audience's taste.
 */
const PLACE_TAG = /^urn:tag:(amenity|credit_card|lifestyle|influencer_appeal|category|hotel_rating)\b|:(place|brand)$/;
const isTasteTag = (item: unknown) => {
  const type = (item as { type?: unknown } | null)?.type;
  return typeof type !== "string" || !type.startsWith("urn:tag:") || !PLACE_TAG.test(type);
};

/** What came back with data: a trend series with no points is not a result, nor is a place tag. */
export const resultsOf = (e: QlooEnvelope): unknown[] => listOf(e).filter(hasPoints).filter(isTasteTag);

/** A trend series is a dated point every few days; its first and last point carry the momentum. */
function shortenSeries(item: unknown): unknown {
  const points = (item as { points?: unknown[] } | null)?.points;
  if (!Array.isArray(points) || points.length <= 2) return item;
  // Values that never move across the window are a gap in the data, not "flat momentum".
  const shape = (p: unknown) => JSON.stringify(Object.entries(p as object).filter(([k]) => k !== "date"));
  const still = points.every((p) => shape(p) === shape(points[0]));
  return { ...(item as object), points: [points[0], points.at(-1)], points_total: points.length, ...(still ? { no_movement: true } : {}) };
}

const nameOf = (r: unknown) => (r && typeof r === "object" && typeof (r as { name?: unknown }).name === "string" ? decodeEntities((r as { name: string }).name) : null);

/** A neighbourhood Qloo cannot resolve returns nothing rather than an error; point the agent at the city. */
function emptyNote(e: QlooEnvelope, args: Record<string, unknown>): string {
  if (listKey(e) === "series") {
    return "No data points in this window. On this API, trend windows shorter than about six months come back empty: widen start_date.";
  }
  const place = [args.signal_location, args.within, args.location].find((v): v is string => typeof v === "string");
  const city = place?.includes(",") ? place.split(",").pop()!.trim() : null;
  return city
    ? `Qloo returned no results. "${place}" may be finer than Qloo resolves: retry with "${city}" and use that same location for later calls.`
    : "Qloo returned no results for this request.";
}

/** One line for the research trail and logs. */
export function summarise(e: QlooEnvelope): string {
  if (e.summary) return e.summary;
  if (e.status !== "ok") return e.error?.recovery ?? e.status;
  const results = resultsOf(e);
  if (!results.length) return listKey(e) === "series" && listOf(e).length ? "No data points." : "No results.";
  const names = results.map(nameOf).filter((n): n is string => Boolean(n)).slice(0, 3);
  return `${results.length} result${results.length === 1 ? "" : "s"}${names.length ? `: ${names.join(", ")}${results.length > names.length ? ", …" : ""}` : ""}`;
}

export function forModel(e: QlooEnvelope, args: Record<string, unknown> = {}): Record<string, unknown> {
  const results = resultsOf(e);
  const issues = (e.resolution as { issues?: { candidates?: unknown[] }[] } | undefined)?.issues;
  const out: Record<string, unknown> = { status: e.status, summary: summarise(e) };
  if (e.interpretation) out.interpretation = trim(e.interpretation);
  if (issues?.length) out.issues = trim(issues.map((i) => ({ ...i, candidates: i.candidates?.slice(0, MAX_CANDIDATES) })));
  if (e.warnings?.length) out.warnings = e.warnings;
  if (e.error) out.error = e.error;
  for (const [k, v] of Object.entries(e)) if (!SHAPED.has(k)) out[k] = trim(v);
  if (e.status === "ok") {
    out.result_count = results.length;
    if (results.length > MAX_RESULTS) out.results_shown = MAX_RESULTS;
    out[listKey(e)] = trim(results.slice(0, MAX_RESULTS).map(shortenSeries));
    if (!results.length) out.note = emptyNote(e, args);
  }
  return out;
}
