import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { runAgent } from "./agent.js";
import { connectQloo } from "./qloo.js";
import { VENUE_KINDS, type AgentEvent, type VenueInput } from "./types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
// The private cache and the daily counters. On a host whose disk resets, point this at persistent storage (Cloud Run
// mounts a private bucket here), so samples are not re-run and caps are not reset on every restart.
const OUT = process.env.MARQUEE_DATA_DIR ?? path.join(ROOT, "out");
const CACHE = path.join(OUT, "cache");
const SAMPLES = path.join(ROOT, "samples");
const WEB = path.join(ROOT, "web", "dist");
// Live runs a day across all visitors; cached and sample runs are free. Keeps a public demo inside a small budget.
const DAILY_RUN_CAP = Number(process.env.MARQUEE_DAILY_RUNS ?? 25);
// Live runs a day per visitor, so one visitor cannot use up the day for everyone else.
const RUNS_PER_CLIENT = Number(process.env.MARQUEE_RUNS_PER_VISITOR ?? 3);
// Live runs at once; more overlapping runs hit Qloo's rate limit. Beyond MAX_WAITING queued, new runs are refused.
const CONCURRENT_RUNS = 2;
const MAX_WAITING = 2;
const HEARTBEAT_MS = 15_000;

fs.mkdirSync(CACHE, { recursive: true });

/** Up to 10 distinct, non-blank titles; omitted entirely when there are none, so cache keys stay as before. */
function shortlistOf(v: unknown, text: (v: unknown, max: number) => string): { shortlist?: string[] } {
  const titles = Array.isArray(v) ? [...new Set(v.map((t) => text(t, 80)).filter(Boolean))].slice(0, 10) : [];
  return titles.length ? { shortlist: titles } : {};
}

export function validate(body: unknown): VenueInput | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const kind = b.kind as VenueInput["kind"];
  if (!VENUE_KINDS.includes(kind)) return "Choose a venue type.";
  const location = text(b.location, 80);
  if (location.length < 2) return "Give the venue's city or neighbourhood.";
  const hits = Array.isArray(b.recentHits) ? b.recentHits.map((h) => text(h, 80)).filter(Boolean).slice(0, 5) : [];
  if (!hits.length) return "Add at least one recent hit.";
  const month = text(b.month, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return "Pick a month.";
  const slots = Math.round(Number(b.slots));
  if (!(slots >= 4 && slots <= 12)) return "Plan between 4 and 12 events.";
  return {
    kind,
    location,
    recentHits: hits,
    audience: text(b.audience, 60) || undefined,
    month,
    slots,
    notes: text(b.notes, 240) || undefined,
    ...shortlistOf(b.shortlist, text),
  };
}

const keyFor = (v: VenueInput) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
const cachePath = (v: VenueInput) => path.join(CACHE, `${keyFor(v)}.json`);

const loadSamples = (): VenueInput[] => {
  const file = path.join(SAMPLES, "venues.json");
  const venues = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown[]) : [];
  return venues.map(validate).filter((v): v is VenueInput => typeof v !== "string");
};

/**
 * One live plan; a finished programme is cached so the same request never costs twice. `signal` stops the run when
 * the visitor leaves. Error details go to the server log, never to the browser.
 */
async function planAndCache(venue: VenueInput, emit: (e: AgentEvent) => void, signal?: AbortSignal): Promise<void> {
  const log: AgentEvent[] = [];
  let qloo: Awaited<ReturnType<typeof connectQloo>> | null = null;
  try {
    qloo = await connectQloo();
    const programme = await runAgent(venue, qloo, (e) => { log.push(e); emit(e); }, undefined, signal);
    if (programme) fs.writeFileSync(cachePath(venue), JSON.stringify(log));
  } catch (err) {
    if (!signal?.aborted) console.error("Run failed:", err);
    emit({ type: "error", message: "The plan could not be finished. Please try again in a minute." });
  } finally {
    await qloo?.close();
  }
}

/**
 * Free hosts lose the private cache on every restart, which would leave the sample venues empty for the next
 * visitor. Run the uncached ones once, one at a time, inside the daily cap. Returns how many ran.
 */
export async function warmSamples(
  venues: VenueInput[],
  isCached: (v: VenueInput) => boolean,
  take: () => boolean,
  run: (v: VenueInput) => Promise<void>,
): Promise<number> {
  let ran = 0;
  for (const v of venues) {
    if (isCached(v)) continue;
    if (!take()) break;
    await run(v);
    ran++;
  }
  return ran;
}

/**
 * Daily live-run allowance, in total and per visitor. Returns null when a run may start, else the reason it may not.
 * With `file`, the count survives a process restart (a host that wipes its disk still resets it).
 */
export function createBudget(o: { daily: number; perClient: number; today?: () => string; file?: string }) {
  const today = o.today ?? (() => new Date().toISOString().slice(0, 10));
  type State = { day: string; total: number; clients: Record<string, number> };
  let state: State = { day: "", total: 0, clients: {} };
  try {
    if (o.file && fs.existsSync(o.file)) state = JSON.parse(fs.readFileSync(o.file, "utf8")) as State;
  } catch { /* a corrupt file starts the day afresh */ }
  return {
    take(client: string): string | null {
      const d = today();
      if (state.day !== d) state = { day: d, total: 0, clients: {} };
      if (state.total >= o.daily) return "Today's live runs are used up. Explore the sample venues, or try again tomorrow.";
      if ((state.clients[client] ?? 0) >= o.perClient) {
        return `You have used your ${o.perClient} live plans for today. Explore the sample venues, or try again tomorrow.`;
      }
      state.total++;
      state.clients[client] = (state.clients[client] ?? 0) + 1;
      if (o.file) fs.writeFileSync(o.file, JSON.stringify(state));
      return null;
    },
  };
}

/** Runs at most `max` jobs at once, first come first served; `onWait` fires for a job that has to queue. */
export function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const run = async <T>(job: () => Promise<T>, onWait: () => void = () => {}): Promise<T> => {
    if (active >= max) {
      onWait();
      await new Promise<void>((r) => queue.push(r));
    } else active++;
    try {
      return await job();
    } finally {
      const next = queue.shift();
      if (next) next(); else active--;
    }
  };
  return Object.assign(run, { waiting: () => queue.length });
}

export function createApp() {
  const limit = createLimiter(CONCURRENT_RUNS);
  const budget = createBudget({ daily: DAILY_RUN_CAP, perClient: RUNS_PER_CLIENT, file: path.join(OUT, "budget.json") });
  const app = express();
  app.disable("x-powered-by");
  // Behind the host's reverse proxy, req.ip is the visitor's address only when the first proxy hop is trusted.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));

  // `client` is a short hash of the address the per-visitor cap counts, so a deploy can check it sees visitors rather
  // than its proxy without the address itself ever being shown.
  app.get("/api/health", (req, res) => res.json({
    ok: true,
    live: Boolean(process.env.QLOO_API_KEY) && process.env.QLOO_MOCK !== "1",
    client: createHash("sha256").update(req.ip ?? "").digest("hex").slice(0, 8),
  }));

  // Sample venues are inputs only: Qloo results may be cached privately on the server but never stored in the
  // public repository, so a sample's events come from this server's cache once someone has run it.
  app.get("/api/samples", (_req, res) => {
    res.json(loadSamples().map((venue) => {
      const cached = cachePath(venue);
      return { venue, events: fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, "utf8")) : null };
    }));
  });

  app.post("/api/plan", async (req, res) => {
    const venue = validate(req.body);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    const send = (e: AgentEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    if (typeof venue === "string") {
      send({ type: "error", message: venue });
      return res.end();
    }
    const cached = cachePath(venue);
    if (fs.existsSync(cached)) {
      for (const e of JSON.parse(fs.readFileSync(cached, "utf8")) as AgentEvent[]) send(e);
      return res.end();
    }
    if (limit.waiting() >= MAX_WAITING) {
      send({ type: "error", message: "Marquee is busy right now. Explore the sample venues, or try again in a few minutes." });
      return res.end();
    }
    const refused = budget.take(req.ip ?? "unknown");
    if (refused) {
      send({ type: "error", message: refused });
      return res.end();
    }
    // A visitor who leaves stops the run: no more model turns are paid for a page nobody is reading.
    const abort = new AbortController();
    res.on("close", () => { if (!res.writableFinished) abort.abort(); });
    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    try {
      await limit(() => (abort.signal.aborted ? Promise.resolve() : planAndCache(venue, send, abort.signal)),
        () => send({ type: "status", message: "Another plan is running; yours starts as soon as it finishes." }));
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  if (fs.existsSync(WEB)) app.use(express.static(WEB));
  if (process.env.MARQUEE_WARM_SAMPLES === "1") {
    void warmSamples(loadSamples(), (v) => fs.existsSync(cachePath(v)), () => !budget.take("warm-up"), (v) => limit(() => planAndCache(v, () => {})))
      .then((n) => console.log(`Warmed ${n} sample venue(s)`));
  }
  return app;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.PORT ?? 8787);
  // Start the Qloo harness once before taking traffic: on a fresh hosted instance its first start is slow, and a
  // visitor's first plan should not pay for it.
  try {
    const qloo = await connectQloo();
    await qloo.close();
  } catch (err) {
    console.error("Qloo warm-up failed; plans will connect on demand:", err);
  }
  createApp().listen(port, () => console.log(`Marquee on http://localhost:${port}`));
}
