import { describe, expect, it } from "vitest";

import { createHandles } from "../src/handles.js";

const A = "9A62B37E-9A6D-47DA-A6FD-9414FA7F7710";
const B = "B30DB61E-707C-421E-A1C4-1A912B7F067D";

describe("entity handles", () => {
  it("shows the model short handles and maps them back for Qloo", () => {
    const h = createHandles();
    const shown = h.hide({ results: [{ entity_id: A, name: "Past Lives" }, { entity_id: B }, { entity_id: A }], tag: "urn:tag:genre:media:drama" });
    expect(shown).toEqual({ results: [{ entity_id: "e1", name: "Past Lives" }, { entity_id: "e2" }, { entity_id: "e1" }], tag: "urn:tag:genre:media:drama" });
    expect(h.reveal({ signals: ["e2", "e1", "Perfect Days"], options: "e1", limit: 10 })).toEqual({ signals: [B, A, "Perfect Days"], options: A, limit: 10 });
  });
  it("leaves unknown handles and ordinary words alone", () => {
    const h = createHandles();
    expect(h.reveal({ entity: "e7", type: "movie" })).toEqual({ entity: "e7", type: "movie" });
  });
});
