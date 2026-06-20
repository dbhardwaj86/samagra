import { describe, it, expect } from "vitest";
import { THEMES } from "./index";

describe("THEMES.aqua", () => {
  const a = THEMES.aqua;
  it("chrome constants drive work-area + clamps", () => {
    expect(a.kind).toBe("mac");
    expect(a.dockPos).toBe("bottom");
    expect(a.controlSide).toBe("left");
    expect(a.barH).toBe(30);
    expect(a.winRadius).toBe(13);
  });
  it("core color tokens are exact", () => {
    expect(a.accent).toBe("#4f46e5");
    expect(a.accent2).toBe("#0d9488");
    expect(a.text).toBe("#1d1d1f");
    expect(a.muted).toBe("#6e6e76");
    expect(a.winBg).toBe("rgba(255,255,255,0.78)");
    expect(a.font).toContain("Inter");
  });
  it("console + samagra exist forward-compat with their barH/rail", () => {
    expect(THEMES.console.barH).toBe(0);
    expect(THEMES.console.winRadius).toBe(10);
    expect(THEMES.samagra.barH).toBe(32);
    expect(THEMES.samagra.rail).toBe(66);
    expect(THEMES.samagra.winRadius).toBe(15);
  });
});
