// FD2 RED — <Icon> inline-SVG line-icon primitive.
// Authoritative source: the prototype's `icon()` helper + `ICONS` map
// (.dc.html lines ~242-244 / ~96-114). The tests pin the exact SVG attributes
// (24×24 viewBox, stroke 1.9, round caps/joins, fill none, stroke currentColor),
// the verbatim path data (split on `|` → one <path> per segment), the size
// driving, and the a11y fidelity hooks introduced by this component.
import { render, screen } from "@testing-library/react";
import Icon from "./Icon";
import { ICONS, ICON_STROKE, ICON_DEFAULT_SIZE } from "./icons-data";

const svgOf = (container: HTMLElement) =>
  container.querySelector("svg") as SVGSVGElement;

describe("Icon — inline SVG markup (proto icon() helper)", () => {
  it("renders an inline <svg> (never a letter badge / img)", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = svgOf(container);
    expect(svg).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("pins the exact SVG attributes from the prototype", () => {
    const { container } = render(<Icon name="clock" />);
    const svg = svgOf(container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe(String(ICON_STROKE)); // 1.9
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
  });

  it("defaults to the prototype's 20px size and is overridable", () => {
    const { container, rerender } = render(<Icon name="dashboard" />);
    let svg = svgOf(container);
    expect(svg.getAttribute("width")).toBe(String(ICON_DEFAULT_SIZE)); // 20
    expect(svg.getAttribute("height")).toBe(String(ICON_DEFAULT_SIZE));
    rerender(<Icon name="dashboard" size={23} />);
    svg = svgOf(container);
    expect(svg.getAttribute("width")).toBe("23");
    expect(svg.getAttribute("height")).toBe("23");
  });

  it("allows the stroke-width to be overridden (proto sw arg), default 1.9", () => {
    const { container } = render(<Icon name="questions" strokeWidth={1.6} />);
    expect(svgOf(container).getAttribute("stroke-width")).toBe("1.6");
  });

  it("splits the verbatim path data on '|' into one <path> per segment", () => {
    // dashboard = 4 squares = 4 segments; activity = single segment (no '|').
    const { container: cDash } = render(<Icon name="dashboard" />);
    expect(cDash.querySelectorAll("path")).toHaveLength(4);
    const { container: cAct } = render(<Icon name="activity" />);
    expect(cAct.querySelectorAll("path")).toHaveLength(1);
  });

  it("emits the path 'd' attributes VERBATIM from ICONS (no mangling)", () => {
    const { container } = render(<Icon name="dashboard" />);
    const ds = Array.from(container.querySelectorAll("path")).map((p) =>
      p.getAttribute("d"),
    );
    expect(ds).toEqual(ICONS.dashboard.split("|"));
  });

  it("renders every app glyph with at least one path and verbatim data", () => {
    (Object.keys(ICONS) as Array<keyof typeof ICONS>).forEach((id) => {
      const { container, unmount } = render(<Icon name={id} />);
      const paths = container.querySelectorAll("path");
      expect(paths.length).toBe(ICONS[id].split("|").length);
      expect(paths.length).toBeGreaterThan(0);
      unmount();
    });
  });

  it("inherits color via currentColor (no hardcoded stroke color)", () => {
    const { container } = render(<Icon name="snake" />);
    expect(svgOf(container).getAttribute("stroke")).toBe("currentColor");
  });

  // Theme correctness: the glyph never hardcodes a per-theme color — it strokes
  // with `currentColor`, so it picks up whatever `color` the active theme paints
  // on an ancestor (aqua text, console glow, samagra ink, or a per-app accent).
  // We prove the inheritance path by painting an ancestor and reading it back.
  it("renders theme-correctly by inheriting the ancestor color (currentColor)", () => {
    const { container } = render(
      <div style={{ color: "rgb(217, 96, 26)" }}>
        <Icon name="settings" />
      </div>,
    );
    const svg = svgOf(container);
    // stroke resolves through currentColor → the ancestor's painted color.
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(getComputedStyle(svg).color).toBe("rgb(217, 96, 26)");
    // no literal hex/rgb baked onto stroke or any path → fully theme-driven.
    expect(svg.getAttribute("stroke")).not.toMatch(/#|rgb/);
    container.querySelectorAll("path").forEach((p) => {
      expect(p.getAttribute("stroke")).toBeNull();
      expect(p.getAttribute("fill")).toBeNull();
    });
  });

  describe("a11y fidelity hooks", () => {
    it("is decorative by default: aria-hidden, no accessible name", () => {
      const { container } = render(<Icon name="terminal" />);
      const svg = svgOf(container);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("role")).toBeNull();
      expect(svg.getAttribute("aria-label")).toBeNull();
    });

    it("becomes a labelled img role when a title/label is supplied", () => {
      render(<Icon name="clock" label="Clock" />);
      const svg = screen.getByRole("img", { name: "Clock" });
      expect(svg.tagName.toLowerCase()).toBe("svg");
      expect(svg.getAttribute("aria-hidden")).not.toBe("true");
    });
  });
});
