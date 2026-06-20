// FD1 RED — ThemeRoot is the CSS-var theme provider. It reads the active theme
// from a theme store and renders a root element that (1) carries a `data-theme`
// attribute, (2) sets every `--samagra-*` custom property from the active
// theme's tokens, and (3) paints background/color/font from those tokens — so the
// whole surface renders faithfully in aqua, console AND samagra without any
// hardcoded per-theme values. Switching the store re-paints the vars live.
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import ThemeRoot from "./ThemeRoot";
import { THEMES, cssVars } from "../themes";
import { createThemeStore, type ThemeStore } from "../stores/theme";
import { createWindowManagerStore } from "../stores/windowManager";

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true, writable: true });
});

function makeStore(): ThemeStore {
  return createThemeStore({ wm: createWindowManagerStore() });
}

describe("ThemeRoot — CSS-var theme provider (FD1)", () => {
  it("renders its children", () => {
    render(
      <ThemeRoot store={makeStore()}>
        <span>inside</span>
      </ThemeRoot>,
    );
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it("carries a data-theme attribute for the active theme (defaults to aqua)", () => {
    const { container } = render(<ThemeRoot store={makeStore()}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("aqua");
  });

  it("applies EVERY --samagra-* var from the active theme's tokens", () => {
    const { container } = render(<ThemeRoot store={makeStore()}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;
    const vars = cssVars(THEMES.aqua);
    for (const [name, value] of Object.entries(vars)) {
      expect(root.style.getPropertyValue(name)).toBe(value);
    }
  });

  it("paints background / color / font from the active theme tokens", () => {
    const { container } = render(<ThemeRoot store={makeStore()}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;
    // background + color reference the CSS vars (so they track the active theme)
    expect(root.style.background).toContain("--samagra-bg");
    expect(root.style.color).toContain("--samagra-text");
    // font-family resolves through the theme font var
    expect(root.style.fontFamily).toContain("--samagra-font");
  });

  it("exposes the key aqua measurements as vars (barH 30 / winRadius 13 / rail 0)", () => {
    const { container } = render(<ThemeRoot store={makeStore()}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue("--samagra-bar-h")).toBe("30px");
    expect(root.style.getPropertyValue("--samagra-win-radius")).toBe("13px");
    expect(root.style.getPropertyValue("--samagra-rail")).toBe("0px");
  });

  it("re-paints data-theme + vars when the store switches to console", () => {
    const store = makeStore();
    const { container } = render(<ThemeRoot store={store}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;

    act(() => store.getState().setTheme("console"));

    expect(root.getAttribute("data-theme")).toBe("console");
    expect(root.style.getPropertyValue("--samagra-accent")).toBe(THEMES.console.accent);
    expect(root.style.getPropertyValue("--samagra-text")).toBe(THEMES.console.text);
    expect(root.style.getPropertyValue("--samagra-win-radius")).toBe("10px");
    expect(root.style.getPropertyValue("--samagra-bar-h")).toBe("0px");
  });

  it("re-paints to the samagra theme — rail width + Devanagari wordmark var", () => {
    const store = makeStore();
    const { container } = render(<ThemeRoot store={store}>x</ThemeRoot>);
    const root = container.firstChild as HTMLElement;

    act(() => store.getState().setTheme("samagra"));

    expect(root.getAttribute("data-theme")).toBe("samagra");
    expect(root.style.getPropertyValue("--samagra-rail")).toBe("66px");
    expect(root.style.getPropertyValue("--samagra-accent")).toBe("#d9601a");
    expect(root.style.getPropertyValue("--samagra-wordmark")).toContain("Tiro Devanagari Hindi");
    expect(root.style.getPropertyValue("--samagra-win-bg")).toBe("#fffcf6");
  });
});
