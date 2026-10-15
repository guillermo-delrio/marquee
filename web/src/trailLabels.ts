import type { AgentEvent } from "./types";

type Call = Extract<AgentEvent, { type: "tool_call" }>;

/** Qloo names for the entity ids seen so far, read from each result's interpretation and results. */
export function entityNames(events: AgentEvent[]): Map<string, string> {
  const names = new Map<string, string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    const id = o.entityId ?? o.entity_id;
    if (typeof id === "string" && typeof o.name === "string") names.set(id, o.name);
    Object.values(o).forEach(walk);
  };
  for (const e of events) if (e.type === "tool_result") walk(e.raw);
  return names;
}

/** Plain-language label for each Qloo workflow the agent can call; entity ids read as their names. */
export function label(c: Call, names: Map<string, string> = new Map()): string {
  const name = (v: unknown) => names.get(String(v)) ?? String(v ?? "");
  const list = (v: unknown) => (Array.isArray(v) ? v.map(name).join(", ") : name(v));
  const a = c.args;
  switch (c.name) {
    case "qloo_describe": return `Resolve “${name(a.entity)}”`;
    case "qloo_entity_tags": return `Find the taste shared by ${list(a.entities)}`;
    case "qloo_recommend": return `Discover ${a.target_type ?? "titles"} with affinity${a.signal_location ? ` in ${a.signal_location}` : ""}`;
    case "qloo_rank": return `Rank ${(a.options as unknown[] | undefined)?.length ?? ""} candidates${a.signal_location ? ` for ${a.signal_location}` : ""}`;
    case "qloo_trends": return `Check momentum of ${list(a.entities)}`;
    case "qloo_where_popular": return `Where “${name(a.entity)}” is popular within ${a.within}`;
    case "qloo_find_tags": return `Find Qloo tags for “${a.query}”`;
    case "qloo_compare_audiences": return "Compare two audiences";
    case "qloo_audience_demographics": return `Audience of “${name(a.entity)}”`;
    default: return c.name;
  }
}
