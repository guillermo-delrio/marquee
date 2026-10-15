import type { AgentEvent, Sample, VenueInput } from "./types";

/**
 * POST the venue and read the server-sent events as they arrive. When `signal` aborts (a new plan, or the visitor
 * leaving), the server is told to stop the run: a hosting proxy may keep the request open after the page lets go.
 */
export async function streamPlan(venue: VenueInput, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  let runId: string | null = null;
  signal?.addEventListener("abort", () => {
    if (runId) navigator.sendBeacon("/api/cancel", new Blob([JSON.stringify({ id: runId })], { type: "application/json" }));
  }, { once: true });
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(venue),
    signal,
  });
  if (!res.body) throw new Error(`Server answered ${res.status}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as AgentEvent;
      if (event.type === "run") runId = event.id;
      onEvent(event);
    }
  }
}

export const fetchSamples = async (): Promise<Sample[]> => (await fetch("/api/samples")).json();
export const fetchHealth = async (): Promise<{ ok: boolean; live: boolean }> => (await fetch("/api/health")).json();
