import { describe, expect, it } from "vitest";

import { entityNames, label } from "./trailLabels";
import type { AgentEvent } from "./types";

describe("trail labels", () => {
  it("shows entity ids as the names Qloo resolved them to", () => {
    const events = [
      { type: "tool_result", call_id: "q1", name: "qloo_describe", status: "ok", summary: "",
        raw: { status: "ok", interpretation: { entity: { input: "Film", entityId: "ID-1", name: "Film One" } } } },
    ] as AgentEvent[];
    const call = { type: "tool_call", call_id: "q2", name: "qloo_entity_tags", args: { entities: ["ID-1", "ID-9"] } } as const;
    expect(label(call, entityNames(events))).toBe("Find the taste shared by Film One, ID-9");
  });
});
