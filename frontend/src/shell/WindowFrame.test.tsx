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
