import { describe, it, expect } from "vitest";
import { THEMES, cssVars, type ThemeTokens } from "./index";

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

// FD1 — all three theme token sets must match the prototype's THEMES map
// (.dc.html lines ~59-95 / README §Design Tokens) EXACTLY so the surface
// renders faithfully in every theme.
describe("THEMES.console — exact prototype tokens", () => {
  const c = THEMES.console;
  it("chrome constants (kind/dockPos/controlSide/barH/winRadius)", () => {
    expect(c.kind).toBe("console");
    expect(c.dockPos).toBe("taskbar");
    expect(c.controlSide).toBe("right");
    expect(c.barH).toBe(0);
    expect(c.winRadius).toBe(10);
  });
  it("surface + color tokens are exact", () => {
    expect(c.bg).toContain("#080b12");
    expect(c.winBg).toBe("rgba(16,22,34,0.88)");
    expect(c.winBlur).toBe("blur(20px)");
    expect(c.bar).toBe("rgba(9,13,21,0.78)");
    expect(c.barText).toBe("#cdd7e6");
    expect(c.barBlur).toBe("blur(18px)");
    expect(c.text).toBe("#e7eef8");
    expect(c.muted).toBe("#8595ab");
    expect(c.line).toBe("rgba(255,255,255,0.09)");
    expect(c.cardBg).toBe("rgba(255,255,255,0.04)");
    expect(c.subBg).toBe("rgba(255,255,255,0.035)");
    expect(c.accent).toBe("#38bdf8");
    expect(c.accent2).toBe("#34d399");
    expect(c.shadow).toBe("0 28px 80px rgba(0,0,0,0.62)");
    expect(c.dockBg).toBe("rgba(9,13,21,0.84)");
    expect(c.dockBlur).toBe("blur(22px)");
    expect(c.dockBorder).toBe("rgba(255,255,255,0.08)");
  });
  it("fonts: Inter body, JetBrains Mono wordmark", () => {
    expect(c.font).toContain("Inter");
    expect(c.wordmark).toContain("JetBrains Mono");
  });
});

describe("THEMES.samagra — exact prototype tokens", () => {
  const s = THEMES.samagra;
  it("chrome constants (kind/dockPos/controlSide/barH/rail/winRadius)", () => {
    expect(s.kind).toBe("samagra");
    expect(s.dockPos).toBe("left");
    expect(s.controlSide).toBe("right");
    expect(s.barH).toBe(32);
    expect(s.rail).toBe(66);
    expect(s.winRadius).toBe(15);
  });
  it("surface + color tokens are exact", () => {
    expect(s.bg).toContain("linear-gradient(165deg,#fbf3e5,#f5ead7)");
    expect(s.winBg).toBe("#fffcf6");
    expect(s.winBlur).toBe("none");
    expect(s.bar).toBe("rgba(255,251,243,0.82)");
    expect(s.barText).toBe("#2a2118");
    expect(s.barBlur).toBe("blur(12px)");
    expect(s.text).toBe("#2a2118");
    expect(s.muted).toBe("#937f63");
    expect(s.line).toBe("rgba(42,33,24,0.13)");
    expect(s.cardBg).toBe("#fffaf0");
    expect(s.subBg).toBe("rgba(221,107,32,0.07)");
    expect(s.accent).toBe("#d9601a");
    expect(s.accent2).toBe("#0f766e");
    expect(s.shadow).toBe("0 22px 54px rgba(74,52,24,0.22)");
    expect(s.dockBg).toBe("rgba(255,251,243,0.9)");
    expect(s.dockBlur).toBe("blur(16px)");
    expect(s.dockBorder).toBe("rgba(42,33,24,0.10)");
  });
  it("fonts: Hanken Grotesk body, Tiro Devanagari Hindi wordmark", () => {
    expect(s.font).toContain("Hanken Grotesk");
    expect(s.wordmark).toContain("Tiro Devanagari Hindi");
  });
});

// FD1 — the CSS-var provider mapping. `cssVars(tokens)` flattens a theme's
// tokens into the `--samagra-*` custom properties consumed by the chrome/apps,
// so every color/size/font is driven by the active theme (no hardcoded aqua).
describe("cssVars — token → CSS custom-property map", () => {
  const expectVars = (vars: Record<string, string>, t: ThemeTokens) => {
    expect(vars["--samagra-bg"]).toBe(t.bg);
    expect(vars["--samagra-win-bg"]).toBe(t.winBg);
    expect(vars["--samagra-win-blur"]).toBe(t.winBlur);
    expect(vars["--samagra-bar"]).toBe(t.bar);
    expect(vars["--samagra-bar-text"]).toBe(t.barText);
    expect(vars["--samagra-bar-blur"]).toBe(t.barBlur);
    expect(vars["--samagra-text"]).toBe(t.text);
    expect(vars["--samagra-muted"]).toBe(t.muted);
    expect(vars["--samagra-line"]).toBe(t.line);
    expect(vars["--samagra-card-bg"]).toBe(t.cardBg);
    expect(vars["--samagra-sub-bg"]).toBe(t.subBg);
    expect(vars["--samagra-accent"]).toBe(t.accent);
    expect(vars["--samagra-accent2"]).toBe(t.accent2);
    expect(vars["--samagra-shadow"]).toBe(t.shadow);
    expect(vars["--samagra-dock-bg"]).toBe(t.dockBg);
    expect(vars["--samagra-dock-blur"]).toBe(t.dockBlur);
    expect(vars["--samagra-dock-border"]).toBe(t.dockBorder);
    expect(vars["--samagra-font"]).toBe(t.font);
    expect(vars["--samagra-wordmark"]).toBe(t.wordmark);
  };

  it("maps every aqua token to a --samagra-* var", () => {
    expectVars(cssVars(THEMES.aqua), THEMES.aqua);
  });
  it("maps every console token", () => {
    expectVars(cssVars(THEMES.console), THEMES.console);
  });
  it("maps every samagra token", () => {
    expectVars(cssVars(THEMES.samagra), THEMES.samagra);
  });

  it("emits numeric measurements as px strings (winRadius / barH)", () => {
    const a = cssVars(THEMES.aqua);
    expect(a["--samagra-win-radius"]).toBe("13px");
    expect(a["--samagra-bar-h"]).toBe("30px");
    const c = cssVars(THEMES.console);
    expect(c["--samagra-win-radius"]).toBe("10px");
    expect(c["--samagra-bar-h"]).toBe("0px");
  });

  it("emits the samagra rail width, and 0px rail for themes without a rail", () => {
    expect(cssVars(THEMES.samagra)["--samagra-rail"]).toBe("66px");
    expect(cssVars(THEMES.aqua)["--samagra-rail"]).toBe("0px");
    expect(cssVars(THEMES.console)["--samagra-rail"]).toBe("0px");
  });
});
