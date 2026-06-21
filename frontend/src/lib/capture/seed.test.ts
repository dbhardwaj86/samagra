import { buildSeed, SEED_TYPES } from "./seed";
it("builds a seed body", () => {
  expect(buildSeed({ type: "rough_idea", raw_text: "  tidal demo " }))
    .toEqual({ ok: true, body: { type: "rough_idea", raw_text: "tidal demo" } });
});
it("requires raw_text", () => { expect(buildSeed({ type: "concept", raw_text: " " }).ok).toBe(false); });
it("exposes the 7 seed types", () => { expect(SEED_TYPES).toHaveLength(7); });
