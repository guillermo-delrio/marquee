export const VENUE_KINDS = ["cinema", "bookshop", "music_bar"] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

/** What a venue tells Marquee. Nothing here identifies a person: it describes a place and its programme. */
export interface VenueInput {
  kind: VenueKind;
  location: string;
  recentHits: string[];
  audience?: string;
  month: string;
  slots: number;
  notes?: string;
  /** Titles the venue can actually book this month; when given, the programme is built mainly from these. */
  shortlist?: string[];
}

export interface Evidence {
  call_id: string;
  claim: string;
}

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
  /** Where the pick came from; absent in runs saved before it existed. */
  source?: EventSource;
}

/** shortlist: a title the venue can book; taste: a taste-discovery pick; local: a city crowd-pleaser; reprise: a recent hit. */
export type EventSource = "shortlist" | "taste" | "local" | "reprise";

/** The agent's verdict on one title from the venue's shortlist. */
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
  /** One verdict per shortlisted title, when the venue gave a shortlist. */
  shortlist_notes?: ShortlistNote[];
}

/** The result envelope every qloo mcp tool returns (result_schema_version 1.0-preview.1). */
export interface QlooEnvelope {
  schema_version?: string;
  operation?: string;
  status: "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";
  summary?: string;
  interpretation?: unknown;
  results?: unknown;
  result_count?: number;
  warnings?: string[];
  error?: { code: string; layer: string; retryable: boolean; recovery: string };
  [key: string]: unknown;
}

export type AgentEvent =
  | { type: "status"; message: string }
  /** First event of a live run: the id the page sends to /api/cancel when its visitor leaves. */
  | { type: "run"; id: string }
  | { type: "tool_call"; call_id: string; name: string; args: Record<string, unknown> }
  | {
      type: "tool_result";
      call_id: string;
      name: string;
      status: QlooEnvelope["status"];
      summary: string;
      result_count?: number;
      warnings?: string[];
      raw: QlooEnvelope;
    }
  | { type: "programme"; programme: Programme }
  | { type: "error"; message: string }
  | { type: "done"; tool_calls: number; input_tokens: number; cached_tokens?: number; output_tokens: number; cost_usd: number; mock: boolean };
