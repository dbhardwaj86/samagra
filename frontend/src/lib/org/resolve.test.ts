import { describe, it, expect } from "vitest";
import { resolveOwner, ownerName } from "./resolve";
import type { OrgChart } from "../../types/contracts";

const org: OrgChart = {
  chairman: { id: "deepak", name: "Deepak Bhardwaj", role: "Founder & Chairman" },
  board: [], workers: [],
  owners: {
    codex: { name: "Codex", role: "Reviewer — pre-merge gate" },
    human: { name: "Human", role: "Manual gate / approval" },
  },
};

describe("resolveOwner", () => {
  it("maps a known token", () => {
    expect(resolveOwner(org, "codex")).toEqual({ name: "Codex", role: "Reviewer — pre-merge gate" });
  });
  it("falls back to the raw token (empty role) when unknown or org null", () => {
    expect(resolveOwner(org, "gemini")).toEqual({ name: "gemini", role: "" });
    expect(resolveOwner(null, "codex")).toEqual({ name: "codex", role: "" });
  });
});

describe("ownerName", () => {
  it("returns the display name or the token", () => {
    expect(ownerName(org, "human")).toBe("Human");
    expect(ownerName(org, "grok")).toBe("grok");
    expect(ownerName(null, null)).toBe("");
  });
});
