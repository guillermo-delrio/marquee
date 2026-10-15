import { describe, expect, it } from "vitest";

import { forModel, summarise } from "../src/compact.js";
import type { QlooEnvelope } from "../src/types.js";

// Invented values in the live envelope's shape (Qloo results are never committed).
const bulk = "x".repeat(4000);
const meta = {
  schema_version: "1.0-preview.1",
  provenance: { requests: [{ path: "/v2/insights", note: bulk }] },
  query_intent: { note: bulk },
  execution: { duration_ms: 812 },
};
const film = (i: number) => ({
  entity_id: `ID-${i}`, name: `Film ${i}`, popularity: 0.912345678, affinity: 0.87654321,
  properties: { description: "d".repeat(600), release_year: 2020, image: { url: "https://example.invalid/i.jpg" } },
});

const rankEmpty: QlooEnvelope = {
  ...meta, operation: "rank", status: "ok", result_count: 0, results: [],
  interpretation: { options: [{ input: "Film 1", entityId: "ID-1", name: "Film 1", match: "exact" }], signal_location: "Lavapiés, Madrid" },
  resolution: { provider: { note: bulk }, outcomes: [{ input: "Film 1", alternatives: [{ name: "Unrelated family film" }] }] },
};

describe("forModel", () => {
  it("keeps an empty result visible and points a neighbourhood at its city", () => {
    const out = forModel(rankEmpty, { signal_location: "Lavapiés, Madrid" });
    const text = JSON.stringify(out);
    expect(text.length).toBeLessThan(1000);
    expect(out).toMatchObject({ status: "ok", result_count: 0, results: [], summary: "No results." });
    expect(out.note).toMatch(/retry with "Madrid"/);
    expect(text).not.toMatch(/Unrelated family film|provenance|query_intent/);
  });

  it("trims results without losing names, ids or scores", () => {
    const out = forModel({ ...meta, status: "ok", results: Array.from({ length: 20 }, (_, i) => film(i)) });
    const results = out.results as ReturnType<typeof film>[];
    expect(results).toHaveLength(15);
    expect(out).toMatchObject({ result_count: 20, results_shown: 15, summary: "20 results: Film 0, Film 1, Film 2, …" });
    expect(results[0]).toMatchObject({ entity_id: "ID-0", name: "Film 0", popularity: 0.912, affinity: 0.877 });
    expect(results[0].properties.description.length).toBeLessThanOrEqual(221);
    expect(results[0].properties).not.toHaveProperty("image");
  });

  it("passes ambiguity candidates through so the agent can choose", () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({ id: `C-${i}`, name: "Same Title", popularity: 1 - i / 10 }));
    const out = forModel({ status: "needs_input", summary: "Choose the intended Qloo entity.", resolution: { issues: [{ input: "Same Title", kind: "ambiguous", candidates }] } });
    expect(out.summary).toBe("Choose the intended Qloo entity.");
    expect((out.issues as { candidates: unknown[] }[])[0].candidates).toHaveLength(5);
    expect(out).not.toHaveProperty("results");
  });

  it("reads trends from series, keeping each one's first and last point", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ date: `2026-0${(i % 9) + 1}-01`, population_percentile: i / 12, population_rank: `${100 - i}` }));
    const env = { ...meta, operation: "trends", status: "ok" as const, series: [{ entity: { name: "Film 1", entityId: "ID-1" }, points }] };
    const out = forModel(env);
    expect(out).toMatchObject({ result_count: 1, summary: "1 result" });
    expect(out).not.toHaveProperty("note");
    const s = (out.series as { points: unknown[]; points_total: number }[])[0];
    expect(s.points).toEqual([trimmedPoint(points[0]), trimmedPoint(points[11])]);
    expect(s.points_total).toBe(12);
  });

  it("counts only series with data points and says when a trend window is empty", () => {
    const env = { status: "ok" as const, series: [{ entity: { name: "Film 1" }, points: [] }, { entity: { name: "Film 2" }, points: [] }] };
    const out = forModel(env, { start_date: "2026-07-17", end_date: "2026-10-15" });
    expect(out).toMatchObject({ result_count: 0, summary: "No data points." });
    expect(out.note).toMatch(/six months/);
  });

  it("passes unknown top-level fields through rather than hiding them", () => {
    expect(forModel({ status: "ok", results: [], heat: { cells: 3 } })).toMatchObject({ heat: { cells: 3 } });
  });
});

const trimmedPoint = (p: { population_percentile: number }) => ({ ...p, population_percentile: Number(p.population_percentile.toFixed(3)) });

describe("tag noise", () => {
  it("drops place, amenity, payment and rating tags from what the model and the trail summary see", () => {
    const tag = (name: string, type: string) => ({ id: `urn:tag:x:${name}`, name, type });
    const env = { operation: "entity_tags", status: "ok" as const, results: [
      tag("Mini Bar", "urn:tag:amenity:qloo"), tag("Reflective", "urn:tag:emotional_tone:qloo"),
      tag("China Union Pay", "urn:tag:credit_card:place"), tag("Four Star", "urn:tag:hotel_rating:place"),
      tag("Cafe", "urn:tag:genre:place"), tag("Drama", "urn:tag:genre:media"),
      tag("Inexpensive", "urn:tag:cost_description:place"), tag("Casual", "urn:tag:genre:brand"),
    ] };
    expect(summarise(env)).toBe("2 results: Reflective, Drama");
    expect((forModel(env).results as { name: string }[]).map((t) => t.name)).toEqual(["Reflective", "Drama"]);
  });
});

describe("summarise", () => {
  it("prefers Qloo's own summary and falls back to the error recovery", () => {
    expect(summarise({ status: "needs_input", summary: "Pick one." })).toBe("Pick one.");
    expect(summarise({ status: "error", error: { code: "x", layer: "api", retryable: true, recovery: "Retry later." } })).toBe("Retry later.");
    expect(summarise({ status: "ok", results: [film(1)] })).toBe("1 result: Film 1");
  });
});

describe("escaped names", () => {
  it("decodes Qloo's HTML-escaped names for the model, the summary and the checks", async () => {
    const { normalName } = await import("../src/check.js");
    const env = { status: "ok" as const, results: [{ name: "Writers &amp; Lovers", entity_id: "W" }] };
    expect(summarise(env)).toBe("1 result: Writers & Lovers");
    expect((forModel(env).results as { name: string }[])[0].name).toBe("Writers & Lovers");
    expect(normalName("Writers &amp; Lovers")).toBe(normalName("Writers & Lovers"));
  });
});
