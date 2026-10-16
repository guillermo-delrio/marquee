import { describe, expect, it } from "vitest";

import { imageFor, imageIndex, nameIndex } from "./images";
import type { AgentEvent } from "./types";

const result = (items: unknown[]): AgentEvent => ({ type: "tool_result", call_id: "q1", name: "qloo_recommend", status: "ok", summary: "", raw: { results: items } });

describe("images", () => {
  const events = [result([
    { name: "Piranesi", properties: { image: { url: "https://images.qloo.com/i/a.jpg" } } },
    { name: "Squirrel Flower", properties: { image: { url: "http://insecure.example/b.jpg" } } },
    { name: "Writers &amp; Lovers" },
  ])];

  it("finds a title's image as the plan writes it", () => {
    const idx = imageIndex(events);
    expect(imageFor(idx, "Piranesi by Susanna Clarke")).toBe("https://images.qloo.com/i/a.jpg");
    expect(imageFor(idx, "piranesi")).toBe("https://images.qloo.com/i/a.jpg");
  });

  it("ignores images that are not https", () => {
    expect(imageFor(imageIndex(events), "Squirrel Flower")).toBeUndefined();
  });

  it("keeps Qloo's own spelling, decoded", () => {
    const names = nameIndex(events);
    expect(names.get("squirrel flower")).toBe("Squirrel Flower");
    expect(names.get("writers lovers")).toBe("Writers & Lovers");
  });
});
