import { createHash } from "node:crypto";

import type { QlooEnvelope } from "./types.js";

/**
 * Canned Qloo envelopes for development and tests, shaped like result_schema_version 1.0-preview.1.
 * Every mock result says so in its summary and warnings, so a mock run can never pass for live data.
 */
const MOCK_WARNING = "MOCK DATA: not a Qloo result. Set QLOO_API_KEY for live results.";

const POOLS: Record<string, string[]> = {
  movie: ["Paddington 2", "Past Lives", "The Grand Budapest Hotel", "Amélie", "Perfect Days", "Spirited Away",
    "The Banshees of Inisherin", "Aftersun", "Paterson", "Portrait of a Lady on Fire", "Columbus", "Frances Ha"],
  book: ["Tomorrow, and Tomorrow, and Tomorrow", "Piranesi", "Klara and the Sun", "Normal People", "The Remains of the Day",
    "Convenience Store Woman", "Small Things Like These", "Stoner", "A Gentleman in Moscow", "Station Eleven"],
  artist: ["Khruangbin", "Nubya Garcia", "Snarky Puppy", "BADBADNOTGOOD", "Ezra Collective", "Alfa Mist",
    "Hiatus Kaiyote", "Tom Misch", "Yussef Dayes", "Kokoroko"],
};

const uuid = (s: string) => {
  const h = createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const score = (s: string, salt: string) => (parseInt(createHash("sha1").update(s + salt).digest("hex").slice(0, 6), 16) % 600) / 1000 + 0.4;

const envelope = (operation: string, results: unknown[], summary: string): QlooEnvelope => ({
  schema_version: "1.0-preview.1",
  operation,
  status: results.length ? "ok" : "empty",
  summary: `${summary} (mock)`,
  results,
  result_count: results.length,
  warnings: [MOCK_WARNING],
  execution: { transport: "mcp", transport_name: "mock", correlation_id: uuid(operation + summary), duration_ms: 1 },
});

const pool = (type: unknown) => POOLS[String(type ?? "movie")] ?? POOLS.movie;

export function mockCall(name: string, args: Record<string, unknown>): QlooEnvelope {
  const where = String(args.signal_location ?? args.within ?? "the area");
  switch (name) {
    case "qloo_describe": {
      const entity = String(args.entity);
      return envelope("describe", [{ name: entity, entity_id: uuid(entity), type: args.type ?? "movie" }], `Resolved "${entity}"`);
    }
    case "qloo_entity_tags": {
      const tags = ["Feel-good", "Quirky", "Bittersweet", "Arthouse", "Coming of age", "Whimsical"];
      return envelope("entity_tags", tags.map((t) => ({ name: t, tag_id: `urn:tag:mock:${t.toLowerCase()}`, affinity: score(t, "tag") })),
        `Tags shared by ${(args.entities as string[]).length} entities`);
    }
    case "qloo_recommend": {
      const items = pool(args.target_type).map((n) => ({ name: n, entity_id: uuid(n), affinity: score(n, where) }))
        .sort((a, b) => b.affinity - a.affinity);
      return envelope("recommend", items, `Recommendations for ${where}`);
    }
    case "qloo_rank": {
      const options = (args.options as string[]).map((n) => ({ name: n, entity_id: uuid(n), score: score(n, where + "rank") }))
        .sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));
      return envelope("rank", options, `Ranked ${options.length} options for ${where}`);
    }
    case "qloo_trends": {
      const entities = args.entities as string[];
      return envelope("trends", entities.map((n) => ({ name: n, entity_id: uuid(n), trend: score(n, "trend") > 0.7 ? "rising" : "steady" })),
        `Trends for ${entities.length} entities`);
    }
    case "qloo_where_popular": {
      const places = ["City centre", "Old town", "University district", "Harbour"].map((p) => ({ name: `${p}, ${where}`, affinity: score(p, String(args.entity)) }));
      return envelope("where_popular", places, `Areas where "${args.entity}" is popular within ${where}`);
    }
    case "qloo_find_tags": {
      const q = String(args.query);
      return envelope("find_tags", [{ name: q, tag_id: `urn:tag:mock:${q.toLowerCase().replace(/\W+/g, "_")}` }], `Tags for "${q}"`);
    }
    default:
      return envelope(name.replace(/^qloo_/, ""), [], `No mock for ${name}`);
  }
}
