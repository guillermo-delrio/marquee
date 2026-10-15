import { afterEach, describe, expect, it, vi } from "vitest";

import { streamPlan } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("streamPlan", () => {
  it("tells the server to stop the run when the request is aborted", async () => {
    // A stream that sends the run id and then stays open, as a live plan does; like a real fetch, aborting errors it.
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => new Response(new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"run","id":"abc-123"}\n\n'));
        init.signal?.addEventListener("abort", () => c.error(new DOMException("Aborted", "AbortError")));
      },
    }))));
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: beacon });
    const abort = new AbortController();
    const seen: unknown[] = [];
    const done = streamPlan({ kind: "cinema", location: "Madrid", recentHits: ["Past Lives"], month: "2026-11", slots: 4 },
      (e) => { seen.push(e); abort.abort(); }, abort.signal).catch(() => {});
    await done;
    expect(seen).toEqual([{ type: "run", id: "abc-123" }]);
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/cancel");
    expect(JSON.parse(await blob.text())).toEqual({ id: "abc-123" });
  });
});
