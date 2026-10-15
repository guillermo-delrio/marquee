import { describe, expect, it } from "vitest";

import { comparisons, scoreRows } from "./evidence";
import type { AgentEvent } from "./types";

const call = (id: string, name: string, args: Record<string, unknown>): AgentEvent => ({ type: "tool_call", call_id: id, name, args });
const result = (id: string, name: string, raw: unknown): AgentEvent => ({ type: "tool_result", call_id: id, name, status: "ok", summary: "", raw });
const item = (n: number, affinity: number) => ({ entity_id: `ID-${n}`, name: `Film ${n}`, affinity });
const options = (ns: number[]) => ({ options: ns.map((n) => ({ input: `ID-${n}`, entityId: `ID-${n}`, name: `Film ${n}` })) });

describe("comparisons", () => {
  it("pairs taste discovery with the local ranking of its candidates, by position within that set", () => {
    const events = [
      call("q1", "qloo_recommend", { signals: ["H"], limit: 20 }),
      result("q1", "qloo_recommend", { results: [item(1, 0.96), item(2, 0.95), item(3, 0.94), item(4, 0.93)] }),
      call("q2", "qloo_rank", { options: ["ID-2", "ID-3", "ID-4"], signals: ["H"], signal_location: "Madrid" }),
      result("q2", "qloo_rank", { interpretation: options([2, 3, 4]), results: [item(4, 0.9), item(2, 0.8)] }),
    ];
    const [c] = comparisons(events, { featured: ["Film 4"]});
    expect(c).toMatchObject({ kind: "discovery", location: "Madrid", tasteCall: "q1", localCall: "q2" });
    expect(c.rows).toEqual([
      { id: "ID-2", name: "Film 2", taste: 1, local: 2, programmed: false },
      { id: "ID-3", name: "Film 3", taste: 2, local: null, programmed: false },
      { id: "ID-4", name: "Film 4", taste: 3, local: 1, programmed: true },
    ]);
  });

  it("pairs the shortlist's taste ranking with its local ranking and names it as the shortlist", () => {
    const events = [
      call("q1", "qloo_rank", { options: ["Film 5", "Film 6"], signals: ["H"] }),
      result("q1", "qloo_rank", { interpretation: options([5, 6]), results: [item(6, 0.9), item(5, 0.8)] }),
      call("q2", "qloo_rank", { options: ["Film 5", "Film 6"], signals: ["H"], signal_location: "London" }),
      result("q2", "qloo_rank", { interpretation: options([5, 6]), results: [item(5, 0.9), item(6, 0.85)] }),
    ];
    const [c] = comparisons(events, { featured: []});
    expect(c).toMatchObject({ kind: "shortlist", location: "London" });
    expect(c.rows.map((r) => [r.name, r.taste, r.local])).toEqual([["Film 6", 1, 2], ["Film 5", 2, 1]]);
  });

  it("ignores a local ranking that returned nothing, keeping the one that worked", () => {
    const events = [
      call("q1", "qloo_recommend", { signals: ["H"] }),
      result("q1", "qloo_recommend", { results: [item(1, 0.9)] }),
      call("q2", "qloo_rank", { options: ["ID-1"], signal_location: "Lavapiés, Madrid" }),
      result("q2", "qloo_rank", { interpretation: options([1]), results: [] }),
      call("q3", "qloo_rank", { options: ["ID-1"], signal_location: "Madrid" }),
      result("q3", "qloo_rank", { interpretation: options([1]), results: [item(1, 0.8)] }),
    ];
    expect(comparisons(events, { featured: []}).map((c) => c.localCall)).toEqual(["q3"]);
  });
});

describe("scoreRows", () => {
  it("lists names and affinities and marks a score within 0.01 of the one above as tied", () => {
    expect(scoreRows({ results: [item(1, 0.924), item(2, 0.9205), item(3, 0.9204), item(4, 0.87)] })).toEqual([
      { name: "Film 1", score: 0.924, tied: false },
      { name: "Film 2", score: 0.9205, tied: true },
      { name: "Film 3", score: 0.9204, tied: true },
      { name: "Film 4", score: 0.87, tied: false },
    ]);
    expect(scoreRows({ results: [{ name: "No score" }] })).toEqual([]);
  });
});
