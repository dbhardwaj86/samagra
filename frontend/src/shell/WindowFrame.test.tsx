// CH1 fidelity — Aqua WindowFrame (proto.md §1.1 / .dc.html renderWindow L940-969
// + winControls L921-927). Aqua window: radius 13, glass surface, 38px title bar
// with LEFT traffic-lights (close #ff5f57 / min #febc2e / zoom #28c840), centered
// title, bottom-right resize grip. When the window is inactive the traffic-light
// dots desaturate to #cdcdd4 and the active shadow drops to the inactive shadow.
// All colors/sizes come from the active theme tokens (FD1) so the frame is
// theme-correct; the resize grip is an inline <svg> (FD2-style, not a glyph char).
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import WindowFrame from "./WindowFrame";
import { THEMES, INACTIVE_SHADOW } from "../themes";

const aqua = THEMES.aqua;

// jsdom canonicalises rgba() to a space-separated form when it round-trips through
// the `background` shorthand. We compare against the theme token modulo that CSSOM
// whitespace normalization so the assertion stays "painted from the token" rather
// than pinning a quirk of the serializer.
const norm = (s: string) => s.replace(/,\s+/g, ",");

const win = {
  id: "w1",
  app: "dashboard" as const,
  x: 40,
  y: 60,
  w: 940,
  h: 610,
  z: 21,
  min: false,
  max: false,
  prev: null,
};

describe("WindowFrame (CH1 aqua chrome fidelity)", () => {
  it("renders the frame and its children without crashing", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div>body</div>
      </WindowFrame>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders the window title in the title bar", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  // --- exact window measurements ---
  it("uses the aqua window radius of 13 (proto.md §1.1)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(frame.style.borderRadius).toBe("13px");
  });

  it("paints the window glass surface + blur from the active theme tokens (aqua)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(norm(frame.style.background)).toBe(aqua.winBg);
    expect(frame.style.backdropFilter).toBe(aqua.winBlur);
  });

  it("renders a 38px title bar (proto.md §1.1)", () => {
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const bar = getByTestId("titlebar");
    expect(bar.style.height).toBe("38px");
  });

  // --- centered title (renderWindow L951): the title sits in a flex-1,
  // justify-center, pointer-events:none wrapper so it centers within the space
  // left of the traffic lights and never swallows the bar's drag/right-click. ---
  it("centers the title in a flex-1 / justify-center / non-interactive wrapper", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const titleWrap = screen.getByText("Dashboard").parentElement as HTMLElement;
    // jsdom expands `flex:1` to the `1 1 0%` shorthand — assert it grows to fill.
    expect(titleWrap.style.flexGrow).toBe("1");
    expect(titleWrap.style.justifyContent).toBe("center");
    expect(titleWrap.style.pointerEvents).toBe("none");
  });

  // --- traffic lights: exact colors, 12×12 round, LEFT side ---
  it("renders three left traffic-light dots with the exact aqua colors", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    const min = screen.getByLabelText("Minimize");
    const zoom = screen.getByLabelText("Maximize");
    expect(close.style.background).toBe("rgb(255, 95, 87)"); // #ff5f57
    expect(min.style.background).toBe("rgb(254, 188, 46)"); // #febc2e
    expect(zoom.style.background).toBe("rgb(40, 200, 64)"); // #28c840
    // 12×12 circle
    expect(close.style.width).toBe("12px");
    expect(close.style.borderRadius).toBe("50%");
  });

  // --- inactive desaturation (winControls L925: inactive dot => #cdcdd4) ---
  it("desaturates the traffic lights to #cdcdd4 when the window is inactive", () => {
    render(
      <WindowFrame win={win} title="Dashboard" active={false}>
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    expect(close.style.background).toBe("rgb(205, 205, 212)"); // #cdcdd4
  });

  it("keeps the live traffic-light colors when the window IS active", () => {
    render(
      <WindowFrame win={win} title="Dashboard" active>
        <div />
      </WindowFrame>,
    );
    expect(screen.getByLabelText("Close").style.background).toBe("rgb(255, 95, 87)");
  });

  // --- active / inactive shadow (renderWindow L958) ---
  // The prototype appends a 1px white inset top-edge highlight to EVERY window
  // shadow (`inHi`), so the rendered boxShadow is `<base>, inset 0 1px 0
  // rgba(255,255,255,.5)`. We assert both the active/inactive base layer and the
  // always-present inset highlight.
  // jsdom does NOT normalize the `box-shadow` longhand the way it does `background`,
  // so the inset layer round-trips verbatim from the source string.
  const INSET = "inset 0 1px 0 rgba(255,255,255,.5)";
  it("uses the active theme shadow when active and the inactive shadow when not", () => {
    const { container: activeC } = render(
      <WindowFrame win={win} title="Dashboard" active>
        <div />
      </WindowFrame>,
    );
    const activeShadow = (activeC.firstChild as HTMLElement).style.boxShadow;
    expect(activeShadow).toContain(aqua.shadow);
    expect(activeShadow).toContain(INSET);

    const { container: idleC } = render(
      <WindowFrame win={win} title="Dashboard" active={false}>
        <div />
      </WindowFrame>,
    );
    const idleShadow = (idleC.firstChild as HTMLElement).style.boxShadow;
    expect(idleShadow).toContain(INACTIVE_SHADOW);
    expect(idleShadow).toContain(INSET);
    // when inactive the loud active shadow must NOT bleed through
    expect(idleShadow).not.toContain(aqua.shadow);
  });

  it("appends the inset top-edge highlight to the window shadow (glass lit edge)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard" active>
        <div />
      </WindowFrame>,
    );
    // the inset highlight is the LAST shadow layer (after the base drop shadow)
    const shadow = (container.firstChild as HTMLElement).style.boxShadow;
    expect(shadow.endsWith(INSET)).toBe(true);
  });

  // --- resize grip is an inline <svg> (bottom-right 18×18) ---
  it("renders the bottom-right resize grip as an inline <svg>", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  // --- behaviours preserved ---
  it("double-click on the title bar toggles maximize (proto.md §1.8)", () => {
    const onToggleMax = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onToggleMax={onToggleMax}>
        <div />
      </WindowFrame>,
    );
    fireEvent.doubleClick(getByTestId("titlebar"));
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });

  // --- drag-to-move (proto.md §1.6) — the title bar is grabbable; a move emits the
  // new absolute target (pointer position minus the grab offset). The WM store
  // re-applies clampDrag, so the frame here just reports the raw target. ---
  it("drag on the title bar moves the window by the pointer delta (proto.md §1.6)", () => {
    const onMove = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onMove={onMove}>
        <div />
      </WindowFrame>,
    );
    const bar = getByTestId("titlebar");
    // jsdom doesn't populate clientX on synthetic pointer events, so dispatch a
    // native MouseEvent typed 'pointer*' (React reads clientX off the nativeEvent).
    // grab at (100,80): offset from win origin (40,60) = (60,20).
    bar.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: 80 }));
    bar.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, cancelable: true, clientX: 200, clientY: 180 }));
    // target = pointer − offset = (200−60, 180−20)
    expect(onMove).toHaveBeenCalledWith("w1", 140, 160);
    bar.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  });

  it("focuses the window when a title-bar drag begins", () => {
    const onFocus = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onFocus={onFocus}>
        <div />
      </WindowFrame>,
    );
    fireEvent.pointerDown(getByTestId("titlebar"), { button: 0, pointerId: 1, clientX: 100, clientY: 80 });
    expect(onFocus).toHaveBeenCalledWith("w1");
  });

  it("does NOT drag when the pointer-down lands on a title-bar control button", () => {
    const onMove = vi.fn();
    render(
      <WindowFrame win={win} title="Dashboard" onMove={onMove}>
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    fireEvent.pointerDown(close, { button: 0, pointerId: 1, clientX: 50, clientY: 70 });
    fireEvent.pointerMove(close, { pointerId: 1, clientX: 300, clientY: 300 });
    expect(onMove).not.toHaveBeenCalled();
  });

  // --- drag the bottom-right grip (proto.md §1.7) — emits the grown absolute size. ---
  it("drag on the resize grip resizes the window by the pointer delta (proto.md §1.7)", () => {
    const onResize = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onResize={onResize}>
        <div />
      </WindowFrame>,
    );
    const grip = getByTestId("resize-grip");
    grip.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 500, clientY: 500 }));
    grip.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, cancelable: true, clientX: 560, clientY: 540 }));
    // size = (w0+60, h0+40) = (940+60, 610+40)
    expect(onResize).toHaveBeenCalledWith("w1", 1000, 650);
    grip.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  });

  it("right-click on the title bar opens the context menu (proto.md §1.1)", () => {
    const onContextMenu = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onContextMenu={onContextMenu}>
        <div />
      </WindowFrame>,
    );
    fireEvent.contextMenu(getByTestId("titlebar"), { clientX: 120, clientY: 80 });
    expect(onContextMenu).toHaveBeenCalledWith("w1", 120, 80);
  });

  it("clicking a traffic-light dispatches its window op", () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onToggleMax = vi.fn();
    render(
      <WindowFrame
        win={win}
        title="Dashboard"
        onClose={onClose}
        onMinimize={onMinimize}
        onToggleMax={onToggleMax}
      >
        <div />
      </WindowFrame>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(screen.getByLabelText("Minimize"));
    fireEvent.click(screen.getByLabelText("Maximize"));
    expect(onClose).toHaveBeenCalledWith("w1");
    expect(onMinimize).toHaveBeenCalledWith("w1");
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });

  // --- theme correctness (FD1): samagra opaque cream window, radius 15 ---
  it("paints the window from samagra tokens (radius 15, opaque cream) when theme=samagra", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(frame.style.borderRadius).toBe("15px");
    expect(frame.style.background).toBe("rgb(255, 252, 246)"); // #fffcf6 opaque
  });
});

// ---------------------------------------------------------------------------
// CH2 fidelity — Console WindowFrame (README §Windows / .dc.html renderWindow
// L940-969 + winControls console branch L929-937). Console window: radius 10, dark
// glass surface, 38px title bar with the app glyph + LEFT-aligned title and controls
// on the RIGHT as 28×23 icon buttons (minimize / maximize / close) rendered as inline
// <svg>s (NEVER traffic-light dots). The bar carries a 2px TOP accent border (full
// app accent when active, hexA(accent,0.35) when inactive); when active the frame
// gains a neon glow ring (0 0 0 1px hexA(accent,0.5), 0 0 34px hexA(accent,0.13)).
// Close hover fills #ef4444. All colours/sizes come from the active theme tokens +
// per-app accent (FD1). Pixel parity is a separate human QA pass.
// ---------------------------------------------------------------------------
import { APPS } from "../registry";
import { hexA } from "../components/icons-data";

const con = THEMES.console;
const dashAccent = APPS.dashboard.accent; // #4f46e5

// jsdom serializes a hex border color to the `rgb(r, g, b)` form when it round-trips
// through the `border-top` shorthand (the accent here is an opaque hex, unlike the
// rgba `line` tokens which survive verbatim). Derive the expected rgb string from the
// SAME accent token so the assertion stays "painted from the token", not a literal.
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  // spaceless to match the `norm()`-collapsed serialization compared against below
  return `rgb(${n >> 16},${(n >> 8) & 255},${n & 255})`;
};

describe("WindowFrame (CH2 console chrome fidelity)", () => {
  it("uses the console window radius of 10 and the dark glass surface (FD1)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(frame.style.borderRadius).toBe("10px");
    expect(norm(frame.style.background)).toBe(con.winBg);
    expect(frame.style.backdropFilter).toBe(con.winBlur);
  });

  // --- right-side controls: 28×23 icon BUTTONS, not traffic-light dots ---
  it("renders the three controls on the RIGHT as 28×23 icon buttons (min/max/close)", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    const min = screen.getByLabelText("Minimize");
    const max = screen.getByLabelText("Maximize");
    const close = screen.getByLabelText("Close");
    // 28×23 icon buttons (winControls console branch L933), radius 6
    for (const btn of [min, max, close]) {
      expect(btn.style.width).toBe("28px");
      expect(btn.style.height).toBe("23px");
      expect(btn.style.borderRadius).toBe("6px");
    }
  });

  it("renders each console control as an inline <svg> glyph, never a 12×12 round dot", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    // a glyph button — carries an inline <svg>, NOT a circular traffic-light dot
    expect(close.querySelector("svg")).not.toBeNull();
    expect(close.style.borderRadius).not.toBe("50%");
  });

  it("places the controls AFTER the title (right side) — title is left-aligned", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    // the title wrapper left-aligns its content (flex-start, not center)
    const titleWrap = screen.getByText("Dashboard").parentElement as HTMLElement;
    expect(titleWrap.style.justifyContent).toBe("flex-start");
  });

  // --- FD2: an app glyph sits to the left of the title (console title bar L952) ---
  it("renders the app icon glyph as an inline <svg> left of the title", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    const titleWrap = screen.getByText("Dashboard").parentElement as HTMLElement;
    expect(titleWrap.querySelector("svg")).not.toBeNull();
  });

  // --- 2px top accent border (renderWindow L949) ---
  it("draws a 2px top accent border in the app accent when active", () => {
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" theme="console" active>
        <div />
      </WindowFrame>,
    );
    const bar = getByTestId("titlebar");
    expect(norm(bar.style.borderTop)).toBe(`2px solid ${rgbOf(dashAccent)}`);
  });

  it("fades the 2px top accent border to hexA(accent,0.35) when inactive", () => {
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" theme="console" active={false}>
        <div />
      </WindowFrame>,
    );
    const bar = getByTestId("titlebar");
    expect(norm(bar.style.borderTop)).toBe(norm(`2px solid ${hexA(dashAccent, 0.35)}`));
  });

  // --- neon glow ring when active (renderWindow L956) ---
  it("adds a neon glow ring to the frame shadow only when the console window is active", () => {
    const { container: activeC } = render(
      <WindowFrame win={win} title="Dashboard" theme="console" active>
        <div />
      </WindowFrame>,
    );
    const activeShadow = (activeC.firstChild as HTMLElement).style.boxShadow;
    // ring = 0 0 0 1px hexA(accent,0.5), 0 0 34px hexA(accent,0.13)
    expect(activeShadow).toContain(`0 0 0 1px ${hexA(dashAccent, 0.5)}`);
    expect(activeShadow).toContain(`0 0 34px ${hexA(dashAccent, 0.13)}`);
    // console inset highlight (renderWindow L957)
    expect(activeShadow).toContain("inset 0 1px 0 rgba(255,255,255,.06)");

    const { container: idleC } = render(
      <WindowFrame win={win} title="Dashboard" theme="console" active={false}>
        <div />
      </WindowFrame>,
    );
    const idleShadow = (idleC.firstChild as HTMLElement).style.boxShadow;
    // no glow ring when inactive
    expect(idleShadow).not.toContain(`0 0 34px ${hexA(dashAccent, 0.13)}`);
    expect(idleShadow).toContain(INACTIVE_SHADOW);
  });

  // --- close hover fills #ef4444 (winControls console branch L931) ---
  it("fills the close button with #ef4444 on hover (danger), reverting on leave", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="console">
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    fireEvent.mouseEnter(close);
    expect(close.style.background).toBe("rgb(239, 68, 68)"); // #ef4444
    fireEvent.mouseLeave(close);
    expect(close.style.background).toBe("transparent");
  });

  // --- behaviours preserved on the console branch too ---
  it("dispatches the window ops from the console right-side controls", () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onToggleMax = vi.fn();
    render(
      <WindowFrame
        win={win}
        title="Dashboard"
        theme="console"
        onClose={onClose}
        onMinimize={onMinimize}
        onToggleMax={onToggleMax}
      >
        <div />
      </WindowFrame>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(screen.getByLabelText("Minimize"));
    fireEvent.click(screen.getByLabelText("Maximize"));
    expect(onClose).toHaveBeenCalledWith("w1");
    expect(onMinimize).toHaveBeenCalledWith("w1");
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });

  it("still toggles maximize on title-bar double-click in the console theme", () => {
    const onToggleMax = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" theme="console" onToggleMax={onToggleMax}>
        <div />
      </WindowFrame>,
    );
    fireEvent.doubleClick(getByTestId("titlebar"));
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });
});

// ---------------------------------------------------------------------------
// CH3 fidelity — Samagra WindowFrame (README §Windows L52 / .dc.html renderWindow
// L940-969 + winControls L929-937). Samagra has controlSide:'right' (themes §6.3),
// so — exactly like console and UNLIKE aqua — its windows carry the three controls
// on the RIGHT as 28×23 icon buttons (minimize / maximize / close) drawn as inline
// <svg>s, NEVER left traffic-light dots; the app glyph sits left of a LEFT-aligned
// title. But samagra is NOT console: the window is an opaque cream surface (radius
// 15), the title bar gets NO 2px top accent border and NO 90deg accent wash, and the
// active frame gets NO neon glow ring (those are console-only). All colours/sizes are
// driven by the samagra theme tokens (FD1). Pixel parity is a separate human QA pass.
// ---------------------------------------------------------------------------
const sam = THEMES.samagra;

describe("WindowFrame (CH3 samagra chrome fidelity)", () => {
  it("uses the samagra window radius 15 + opaque cream surface (FD1)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(frame.style.borderRadius).toBe("15px");
    expect(frame.style.background).toBe("rgb(255, 252, 246)"); // #fffcf6 opaque
  });

  // --- right-side controls: 28×23 icon BUTTONS, never traffic-light dots ---
  it("renders the three controls on the RIGHT as 28×23 icon buttons (min/max/close)", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const min = screen.getByLabelText("Minimize");
    const max = screen.getByLabelText("Maximize");
    const close = screen.getByLabelText("Close");
    for (const btn of [min, max, close]) {
      expect(btn.style.width).toBe("28px");
      expect(btn.style.height).toBe("23px");
      expect(btn.style.borderRadius).toBe("6px");
    }
  });

  it("renders each samagra control as an inline <svg> glyph, never a 12×12 round dot", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    expect(close.querySelector("svg")).not.toBeNull();
    expect(close.style.borderRadius).not.toBe("50%");
  });

  it("left-aligns the title with the app glyph to its left (controlSide right)", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const titleWrap = screen.getByText("Dashboard").parentElement as HTMLElement;
    expect(titleWrap.style.justifyContent).toBe("flex-start");
    // FD2: an inline app glyph sits left of the title (renderWindow L952)
    expect(titleWrap.querySelector("svg")).not.toBeNull();
  });

  // --- samagra is NOT console: no 2px top accent border / no neon glow ring ---
  it("does NOT draw the console-only 2px top accent border on the samagra title bar", () => {
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" theme="samagra" active>
        <div />
      </WindowFrame>,
    );
    const bar = getByTestId("titlebar");
    // the console top accent border is "2px solid <accent>"; samagra must not have it
    expect(bar.style.borderTop === "" || bar.style.borderTopWidth === "").toBe(true);
    expect(bar.style.borderTop).not.toContain("2px");
  });

  it("does NOT add the console neon glow ring to an active samagra frame", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard" theme="samagra" active>
        <div />
      </WindowFrame>,
    );
    const shadow = (container.firstChild as HTMLElement).style.boxShadow;
    // samagra active shadow comes from its own token, with the GLASS inset highlight
    expect(shadow).toContain(sam.shadow);
    expect(shadow).toContain("inset 0 1px 0 rgba(255,255,255,.5)");
    // no console glow ring layers
    expect(shadow).not.toContain("0 0 34px");
    expect(shadow).not.toContain("0 0 0 1px");
  });

  // --- close hover fills #ef4444 on samagra too (shared right-control branch) ---
  it("fills the samagra close button with #ef4444 on hover (danger)", () => {
    render(
      <WindowFrame win={win} title="Dashboard" theme="samagra">
        <div />
      </WindowFrame>,
    );
    const close = screen.getByLabelText("Close");
    fireEvent.mouseEnter(close);
    expect(close.style.background).toBe("rgb(239, 68, 68)"); // #ef4444
    fireEvent.mouseLeave(close);
    expect(close.style.background).toBe("transparent");
  });

  it("dispatches the window ops from the samagra right-side controls", () => {
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onToggleMax = vi.fn();
    render(
      <WindowFrame
        win={win}
        title="Dashboard"
        theme="samagra"
        onClose={onClose}
        onMinimize={onMinimize}
        onToggleMax={onToggleMax}
      >
        <div />
      </WindowFrame>,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(screen.getByLabelText("Minimize"));
    fireEvent.click(screen.getByLabelText("Maximize"));
    expect(onClose).toHaveBeenCalledWith("w1");
    expect(onMinimize).toHaveBeenCalledWith("w1");
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });
});
