import type { AgentEvent } from "./types";

type Call = Extract<AgentEvent, { type: "tool_call" }>;
type Result = Extract<AgentEvent, { type: "tool_result" }>;
type Item = { entity_id?: string; name?: string; affinity?: number };

export interface ComparisonRow {
  id: string;
  name: string;
  /** Position by taste among these titles, 1 = best. */
  taste: number;
  /** Position in the local ranking, or null when Qloo has no local data for the title. */
  local: number | null;
  programmed: boolean;
}

export interface Comparison {
  kind: "shortlist" | "discovery";
  location: string;
  tasteCall: string;
  localCall: string;
  rows: ComparisonRow[];
}

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+/g, " ").trim();
const itemsOf = (raw: unknown): Item[] => {
  const r = (raw as { results?: unknown } | null)?.results;
  return Array.isArray(r) ? (r as Item[]) : [];
};
const optionsOf = (raw: unknown): { id: string; name: string }[] => {
  const o = (raw as { interpretation?: { options?: { entityId?: string; name?: string }[] } } | null)?.interpretation?.options;
  return (o ?? []).filter((x) => x.entityId).map((x) => ({ id: x.entityId!, name: x.name ?? x.entityId! }));
};

/**
 * Pairs each local ranking (qloo_rank with a location) with the taste ordering of the same titles: a qloo_rank of the
 * same options without a location (the shortlist), or else the taste-discovery recommendation they were drawn from.
 * Positions are counted within that set of titles, so the two columns compare orders, never scores across calls.
 */
export function comparisons(events: AgentEvent[], ctx: { featured: string[] }): Comparison[] {
  const results = new Map(events.filter((e): e is Result => e.type === "tool_result").map((r) => [r.call_id, r]));
  const calls = events.filter((e): e is Call => e.type === "tool_call" && results.get(e.call_id)?.status === "ok");
  const featured = new Set(ctx.featured.map(norm));
  const out = new Map<string, Comparison>();

  for (const local of calls) {
    if (local.name !== "qloo_rank" || !local.args.signal_location) continue;
    const localItems = itemsOf(results.get(local.call_id)!.raw);
    const options = optionsOf(results.get(local.call_id)!.raw);
    if (!localItems.length || !options.length) continue;
    const ids = new Set(options.map((o) => o.id));

    const tasteOrder = (call: Call) => itemsOf(results.get(call.call_id)!.raw).map((i) => i.entity_id).filter((id): id is string => !!id && ids.has(id));
    const sameShortlist = calls.find((c) => c.name === "qloo_rank" && !c.args.signal_location && c.call_id !== local.call_id &&
      optionsOf(results.get(c.call_id)!.raw).every((o) => ids.has(o.id)) && optionsOf(results.get(c.call_id)!.raw).length === ids.size);
    const discovery = calls.find((c) => c.name === "qloo_recommend" && !c.args.signal_location && Array.isArray(c.args.signals) &&
      [...ids].every((id) => tasteOrder(c).includes(id)));
    const taste = sameShortlist ?? discovery;
    if (!taste) continue;

    const order = tasteOrder(taste);
    const localIds = localItems.map((i) => i.entity_id);
    const names = new Map(options.map((o) => [o.id, o.name]));
    const rows = order.map((id, i) => {
      const at = localIds.indexOf(id);
      const name = names.get(id) ?? id;
      return { id, name, taste: i + 1, local: at < 0 ? null : at + 1, programmed: featured.has(norm(name)) };
    });
    const kind = sameShortlist ? "shortlist" : "discovery";
    // A later ranking of the same titles (a retry at city level) replaces an earlier one.
    out.set(`${kind}:${[...ids].sort().join(",")}`, { kind, location: String(local.args.signal_location), tasteCall: taste.call_id, localCall: local.call_id, rows });
  }
  return [...out.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "shortlist" ? -1 : 1));
}

export interface ScoreRow {
  name: string;
  score: number;
  /** Within 0.01 of the score above it: the order between them is not meaningful. */
  tied: boolean;
}

/** The named, scored results of a recommend or rank call, in Qloo's order. */
export function scoreRows(raw: unknown): ScoreRow[] {
  const rows = itemsOf(raw).filter((i): i is Required<Pick<Item, "name" | "affinity">> & Item => typeof i.name === "string" && typeof i.affinity === "number");
  return rows.map((r, i) => ({ name: r.name, score: r.affinity, tied: i > 0 && Math.abs(rows[i - 1].affinity - r.affinity) < 0.01 }));
}
