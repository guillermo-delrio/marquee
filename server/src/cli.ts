// Run one plan from the command line and save its event log: npm run plan -- <venue.json> [out.json]
import fs from "node:fs";

import { runAgent } from "./agent.js";
import { connectQloo } from "./qloo.js";
import { validate } from "./server.js";
import type { AgentEvent } from "./types.js";

const [input, output] = process.argv.slice(2);
const venue = validate(JSON.parse(fs.readFileSync(input, "utf8")));
if (typeof venue === "string") throw new Error(venue);
const log: AgentEvent[] = [];
const qloo = await connectQloo();
try {
  await runAgent(venue, qloo, (e) => {
    log.push(e);
    const line = e.type === "tool_call" ? `${e.call_id} ${e.name} ${JSON.stringify(e.args)}`
      : e.type === "tool_result" ? `${e.call_id} -> ${e.status}: ${e.summary}`
      : e.type === "programme" ? `programme: ${e.programme.events.length} events — ${e.programme.headline}`
      : JSON.stringify(e);
    console.log(`[${e.type}] ${line}`);
  });
} finally {
  await qloo.close();
}
if (output) fs.writeFileSync(output, JSON.stringify({ venue, events: log }, null, 1));
