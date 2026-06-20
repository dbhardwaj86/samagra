// src/shell/ThemeRoot.tsx — CSS-var theme provider (FD1, THEMING).
// Reads the active theme from the theme store and renders a root element that
// (1) carries a `data-theme` attribute, (2) sets every `--samagra-*` custom
// property from the active theme's tokens (via themes/cssVars), and (3) paints
// background/color/font from those vars — so the whole surface renders faithfully
// in aqua, console AND samagra with NO hardcoded per-theme values. Switching the
// store re-paints the vars live (useStore subscription).
//
// Presentational only: it holds no window/geometry logic; the active theme comes
// from the store, all token math lives in themes/. Consumers (TopBar, Dock,
// WindowFrame, app bodies) reference `var(--samagra-*)` instead of importing a
// fixed theme, which is what makes the chrome theme-correct across all three.
import type { CSSProperties, ReactNode } from "react";
import { useStore } from "zustand";
import { THEMES, cssVars } from "../themes";
import type { ThemeStore } from "../stores/theme";

export interface ThemeRootProps {
  /** The theme store whose active theme drives the CSS vars. */
  store: ThemeStore;
  children: ReactNode;
}

export default function ThemeRoot({ store, children }: ThemeRootProps) {
  const theme = useStore(store, (s) => s.theme);
  const vars = cssVars(THEMES[theme]);

  // Spread the theme vars first, then reference them for the painted properties.
  // `style` carries both the custom props and the var-driven surface paint so the
  // whole tree inherits the active theme's background, text color and font.
  const style: CSSProperties = {
    ...(vars as CSSProperties),
    position: "fixed",
    inset: 0,
    overflow: "hidden",
    background: "var(--samagra-bg)",
    color: "var(--samagra-text)",
    fontFamily: "var(--samagra-font)",
  };

  return (
    <div data-theme={theme} style={style}>
      {children}
    </div>
  );
}
