import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { withRetry } from "../src/qloo.js";
import { createBudget, createLimiter, createRuns, warmSamples } from "../src/server.js";
import type { QlooEnvelope } from "../src/types.js";

const limited: QlooEnvelope = { status: "error", summary: "429", error: { code: "QLOO_RATE_LIMIT", layer: "qloo", retryable: true, recovery: "Wait" } };
const ok: QlooEnvelope = { status: "ok", results: [] };

describe("withRetry", () => {
  it("waits out a rate limit and returns the retried result", async () => {
    const waits: number[] = [];
    let n = 0;
    const out = await withRetry(async () => (++n < 3 ? limited : ok), async (ms) => { waits.push(ms); });
    expect(out).toBe(ok);
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeGreaterThan(waits[0]);
  });
  it("gives up after its retries and does not retry other errors", async () => {
    expect(await withRetry(async () => limited, async () => {})).toBe(limited);
    let n = 0;
    const bad: QlooEnvelope = { status: "error", error: { code: "BAD_INPUT", layer: "qloo", retryable: false, recovery: "" } };
    await withRetry(async () => { n++; return bad; }, async () => {});
    expect(n).toBe(1);
  });
});

describe("createLimiter", () => {
  it("runs at most `max` jobs at once and tells queued callers they are waiting", async () => {
    const limit = createLimiter(2);
    let running = 0, peak = 0, waited = 0;
    const job = () => limit(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; }, () => waited++);
    await Promise.all([job(), job(), job(), job()]);
    expect(peak).toBe(2);
    expect(waited).toBe(2);
  });
});

describe("warmSamples", () => {
  const v = (location: string) => ({ kind: "cinema" as const, location, recentHits: ["Past Lives"], month: "2026-11", slots: 4 });
  it("runs only uncached samples and stops at the daily cap", async () => {
    const ran: string[] = [];
    let budget = 1;
    const n = await warmSamples([v("A"), v("B"), v("C")], (x) => x.location === "A", () => budget-- > 0, async (x) => { ran.push(x.location); });
    expect(n).toBe(1);
    expect(ran).toEqual(["B"]);
  });
});

describe("createBudget", () => {
  it("caps runs per visitor and in total, and resets each day", () => {
    let day = "2026-10-20";
    const budget = createBudget({ daily: 3, perClient: 2, today: () => day });
    expect(budget.take("a")).toBeNull();
    expect(budget.take("a")).toBeNull();
    expect(budget.take("a")).toMatch(/your 2 live plans/);
    expect(budget.take("b")).toBeNull();
    expect(budget.take("c")).toMatch(/used up/);
    day = "2026-10-21";
    expect(budget.take("a")).toBeNull();
  });
  it("keeps its count across restarts when given a file", () => {
    const file = path.join(os.tmpdir(), `marquee-budget-${process.pid}.json`);
    fs.rmSync(file, { force: true });
    const today = () => "2026-10-20";
    createBudget({ daily: 2, perClient: 2, today, file }).take("a");
    createBudget({ daily: 2, perClient: 2, today, file }).take("b");
    expect(createBudget({ daily: 2, perClient: 2, today, file }).take("c")).toMatch(/used up/);
    fs.rmSync(file, { force: true });
  });
  it("stops live runs at the spend cap, across days, counting each run's real cost once settled", () => {
    let day = "2026-11-02";
    const budget = createBudget({ daily: 10, perClient: 10, today: () => day, spendCapUsd: 1.9, reserveUsd: 0.75 });
    expect(budget.take("a")).toBeNull();
    budget.settle(0.6);
    expect(budget.take("a")).toBeNull();
    budget.settle(0.6);
    day = "2026-11-03";
    // $1.20 spent: a third run would reserve $0.75 and could pass $1.90, so it is refused, and stays refused.
    expect(budget.take("b")).toMatch(/live plans are used up/);
    expect(budget.spentUsd()).toBeCloseTo(1.2);
  });
  it("starts counting on its start day, from zero", () => {
    let day = "2026-10-30";
    const budget = createBudget({ daily: 10, perClient: 10, today: () => day, spendCapUsd: 1, reserveUsd: 0.75, spendFrom: "2026-11-01" });
    expect(budget.take("a")).toBeNull();
    budget.settle(0.6);
    expect(budget.take("b")).toBeNull(); // before the start day: no total cap
    budget.settle(0.6);
    day = "2026-11-01";
    expect(budget.take("c")).toBeNull(); // October's spend does not count
    budget.settle(0.6);
    expect(budget.spentUsd()).toBeCloseTo(0.6);
    expect(budget.take("d")).toMatch(/live plans are used up/);
  });
  it("keeps a run's reservation when it dies before reporting its cost", () => {
    const budget = createBudget({ daily: 10, perClient: 10, today: () => "2026-11-02", spendCapUsd: 1, reserveUsd: 0.75 });
    expect(budget.take("a")).toBeNull();
    expect(budget.take("b")).toMatch(/used up/);
    expect(budget.spentUsd()).toBeCloseTo(0.75);
  });
});

describe("createLimiter queue", () => {
  it("reports how many are waiting", async () => {
    const limit = createLimiter(1);
    let release = () => {};
    const first = limit(() => new Promise<void>((r) => { release = r; }));
    const second = limit(async () => {});
    expect(limit.waiting()).toBe(1);
    release();
    await Promise.all([first, second]);
    expect(limit.waiting()).toBe(0);
  });
});

describe("createRuns", () => {
  it("cancels a registered run by its id, once, and forgets finished ones", () => {
    const runs = createRuns();
    const a = new AbortController();
    const id = runs.start(a);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(runs.cancel("not-an-id")).toBe(false);
    expect(runs.cancel(id)).toBe(true);
    expect(a.signal.aborted).toBe(true);
    const b = new AbortController();
    const id2 = runs.start(b);
    runs.finish(id2);
    expect(runs.cancel(id2)).toBe(false);
    expect(b.signal.aborted).toBe(false);
  });
});
