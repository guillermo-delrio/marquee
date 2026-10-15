import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { mockCall } from "./mock-qloo.js";
import type { QlooEnvelope } from "./types.js";

export interface QlooTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface QlooClient {
  readonly mock: boolean;
  tools(): Promise<QlooTool[]>;
  call(name: string, args: Record<string, unknown>): Promise<QlooEnvelope>;
  close(): Promise<void>;
}

const HACKATHON_API = "https://hackathon.api.qloo.com";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const QLOO_BIN = path.join(HERE, "..", "node_modules", ".bin", "qloo");

/** Waits before each retry of a rate-limited call; the hackathon key 429s when a few runs overlap. */
const RETRY_WAITS_MS = [2000, 5000, 10000];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry(call: () => Promise<QlooEnvelope>, wait: (ms: number) => Promise<void> = sleep): Promise<QlooEnvelope> {
  let envelope = await call();
  for (const ms of RETRY_WAITS_MS) {
    if (envelope.error?.code !== "QLOO_RATE_LIMIT") break;
    await wait(ms);
    envelope = await call();
  }
  return envelope;
}

/** The readiness tool is for operators, not for the agent. */
const HIDDEN_TOOLS = new Set(["qloo_capabilities"]);

/**
 * Start the canonical `qloo mcp` server as a child process (the event-supported route) and talk MCP over stdio.
 * The key travels only in the child's environment; it never reaches the model, the browser or a log.
 */
async function connectMcp(apiKey: string): Promise<QlooClient> {
  const client = new Client({ name: "marquee", version: "0.1.0" });
  // Only what the child needs: in particular, not ANTHROPIC_API_KEY.
  const keep = ["PATH", "HOME", "TMPDIR", "NODE_ENV", "NODE_OPTIONS"];
  const env = {
    ...Object.fromEntries(keep.flatMap((k) => (process.env[k] ? [[k, process.env[k]!]] : []))),
    QLOO_API_KEY: apiKey,
    QLOO_BASE_URL: HACKATHON_API,
    QLOO_TRUSTED_BASE_URL: HACKATHON_API,
  };
  await client.connect(new StdioClientTransport({ command: QLOO_BIN, args: ["mcp"], env }));
  const listed = await client.listTools();
  const tools: QlooTool[] = listed.tools
    .filter((t) => !HIDDEN_TOOLS.has(t.name))
    .map((t) => ({ name: t.name, description: t.description ?? "", inputSchema: t.inputSchema as Record<string, unknown> }));
  return {
    mock: false,
    tools: async () => tools,
    call: (name, args) => withRetry(async () => {
      const result = await client.callTool({ name, arguments: args });
      const envelope = (result.structuredContent ?? {}) as QlooEnvelope;
      return envelope.status ? envelope : { ...envelope, status: "error", summary: "Qloo returned no result envelope." };
    }),
    close: () => client.close(),
  };
}

/** Same tools, canned results: lets the app and its tests run before a key exists. Results are labelled as mock. */
async function connectMock(): Promise<QlooClient> {
  const live = await connectMcp("mock-key-for-schema-only");
  const tools = await live.tools();
  await live.close();
  return { mock: true, tools: async () => tools, call: async (name, args) => mockCall(name, args), close: async () => {} };
}

export async function connectQloo(): Promise<QlooClient> {
  const key = process.env.QLOO_API_KEY;
  return key && process.env.QLOO_MOCK !== "1" ? connectMcp(key) : connectMock();
}
