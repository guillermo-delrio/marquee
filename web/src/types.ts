// Mirrors server/src/types.ts (kept separate so the web build has no server imports).
export type VenueKind = "cinema" | "bookshop" | "music_bar";

export interface VenueInput {
  kind: VenueKind;
  location: string;
  recentHits: string[];
  audience?: string;
  month: string;
  slots: number;
  notes?: string;
  shortlist?: string[];
}

export interface Evidence { call_id: string; claim: string }

export interface ProgrammeEvent {
  title: string;
  when: string;
  /** YYYY-MM-DD; absent in runs saved before it existed. */
  date?: string;
  format: string;
  featured: string[];
  why: string;
  evidence: Evidence[];
  confidence: "high" | "medium" | "low";
  source?: "shortlist" | "taste" | "local" | "reprise";
}

export interface ShortlistNote {
  title: string;
  verdict: "programmed" | "reserve" | "skip" | "not_found";
  reason: string;
  evidence: string[];
}

export interface Programme {
  headline: string;
  audience_read: string;
  events: ProgrammeEvent[];
  limits: string[];
  next_checks: string[];
  shortlist_notes?: ShortlistNote[];
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "run"; id: string }
  | { type: "tool_call"; call_id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; call_id: string; name: string; status: string; summary: string; result_count?: number; warnings?: string[]; raw: unknown }
  | { type: "programme"; programme: Programme }
  | { type: "error"; message: string }
  | { type: "done"; tool_calls: number; input_tokens: number; cached_tokens?: number; output_tokens: number; cost_usd: number; mock: boolean };

/** A sample venue, with its saved run when this server has one cached. */
export interface Sample { venue: VenueInput; events: AgentEvent[] | null }
