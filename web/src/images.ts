import type { AgentEvent } from "./types";

type Item = { name?: string; properties?: { image?: { url?: string } } };

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/&amp;/g, "&").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Qloo's own image for each entity the run saw (posters, covers, artist photos), by name. */
export function imageIndex(events: AgentEvent[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "tool_result") continue;
    const items = (e.raw as { results?: unknown } | null)?.results;
    if (!Array.isArray(items)) continue;
    for (const it of items as Item[]) {
      const url = it?.properties?.image?.url;
      if (it?.name && url?.startsWith("https://") && !out.has(norm(it.name))) out.set(norm(it.name), url);
    }
  }
  return out;
}

/** Qloo's own spelling of each name the run saw, so a pick the model wrote in lower case shows as Qloo has it. */
export function nameIndex(events: AgentEvent[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of events) {
    if (e.type !== "tool_result") continue;
    const items = (e.raw as { results?: unknown } | null)?.results;
    if (Array.isArray(items)) for (const it of items as Item[]) if (it?.name && !out.has(norm(it.name))) out.set(norm(it.name), it.name.replace(/&amp;/g, "&"));
  }
  return out;
}

/** The image for a title as the plan writes it ("Piranesi by Susanna Clarke" finds "Piranesi"). */
export function imageFor(index: Map<string, string>, title: string): string | undefined {
  return index.get(norm(title)) ?? index.get(norm(title.replace(/\s+by\s+.*$/i, "").replace(/\s*[([].*?[)\]]/g, "")));
}
