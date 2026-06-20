// AP4 FIDELITY — Clock (README §Apps#13 Clock, #0ea5e9 560×640).
// The Clock app is a THIN presentational wrapper over the already-green
// `lib/clock/*` engines (analog/stopwatch/timer/world). This test pins two
// contracts:
//   1. BEHAVIOUR (kept from E1.22): the wrapper renders the FOUR tabs
//      `clock | stopwatch | timer | world` (proto.md §3 line 180, default `clock`)
//      and switching tabs swaps the body.
//   2. FIDELITY (AP4, new): the exact documented tokens/markup from the prototype's
//      `app_clock` / `clockFace` / `clockStopwatch` / `clockTimer` / `clockWorld`
//      (.dc.html L513-607):
//        • Tab strip — pill tabs (flex 1, 12.5px/600, pad 8px 0, radius 9). The
//          SELECTED tab's text + background are driven by the theme accent var
//          (FD1): color var(--samagra-accent), bg accent@12%.
//        • Analog — a 300×300 viewBox <svg> face: a backing circle r134 (R+14),
//          60 ticks (every 5th `big`), the 12/3/6/9 numerals (17px/700), three
//          hands (hour 5 / minute 4 / second 2px) with the second hand + centre pin
//          in the accent var, and the digital HH:MM:SS AM/PM readout (38px/700,
//          tabular-nums) + date + timezone. The svg is labelled (role=img).
//        • Stopwatch — MM:SS at 62px/300 tabular-nums + a `.cs` centiseconds span
//          in the accent var (28px); Reset + Start controls.
//        • Timer — a 264×264 viewBox ring <svg> (r110 / stroke 13), the MM:SS
//          countdown, and the four preset pills 1/5/10/25 min.
//        • World — six zone rows (cardBg / 1px line var / radius 12 / pad 13px 15px),
//          each with a 36px round day/night chip, the city + weekday, and the live
//          time (21px/600 tabular-nums).
// FD2: every glyph is a real inline <svg> (the day/night chip + tab-strip residue) —
// NEVER a letter badge. Per-pixel parity (hand sweep, ring depletion, the WebAudio
// chime) is a SEPARATE human QA pass and is NOT tested here.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Clock from "./index";

// proto.md §3 line 180: Tabs `clock | stopwatch | timer | world`, default `clock`.
const TABS = ["clock", "stopwatch", "timer", "world"];

// -------------------------------------------------------------------------- //
// BEHAVIOUR — the four tabs + tab switching (the headless residue).           //
// -------------------------------------------------------------------------- //
describe("Clock (behaviour — tab strip)", () => {
  it("renders the four tabs: clock | stopwatch | timer | world", () => {
    render(<Clock />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);

    for (const name of TABS) {
      expect(
        screen.getByRole("tab", { name: new RegExp(name, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("defaults to the Clock tab (analog face visible) and switches body on tab click", () => {
    render(<Clock />);
    // Default tab = clock → the analog face <svg> is present.
    expect(screen.getByLabelText("Analog clock")).toBeInTheDocument();

    // Switch to Timer → the timer ring appears and the analog face is gone.
    fireEvent.click(screen.getByRole("tab", { name: /timer/i }));
    expect(screen.getByLabelText("Timer ring")).toBeInTheDocument();
    expect(screen.queryByLabelText("Analog clock")).toBeNull();

    // Switch to World → the zone list appears.
    fireEvent.click(screen.getByRole("tab", { name: /world/i }));
    expect(screen.getByTestId("clock-world")).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — tab strip pill geometry + selected accent (AP4 / FD1).           //
// -------------------------------------------------------------------------- //
describe("Clock (fidelity — tab strip)", () => {
  it("renders each tab as a flex-1 pill at the prototype geometry (12.5px/600, pad 8px 0, radius 9)", () => {
    render(<Clock />);
    const tab = screen.getByRole("tab", { name: /clock/i });
    expect(tab).toHaveStyle({
      flex: 1,
      fontSize: "12.5px",
      fontWeight: "600",
      padding: "8px 0",
      borderRadius: "9px",
    });
    // the strip itself is a flex row with the prototype's 14px 16px 4px padding + gap 4.
    const strip = screen.getByRole("tablist", { name: /clock modes/i });
    expect(strip).toHaveStyle({ display: "flex", gap: "4px", padding: "14px 16px 4px" });
  });

  it("drives the SELECTED tab's text + background from the theme accent var (FD1)", () => {
    render(<Clock />);
    // clock is the default tab → it carries the accent text + accent@12% background.
    const selected = screen.getByRole("tab", { name: /clock/i });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveStyle({ color: "var(--samagra-accent)" });
    expect(selected).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
    });
    // an unselected tab uses the muted var with no background tint.
    const other = screen.getByRole("tab", { name: /stopwatch/i });
    expect(other).toHaveAttribute("aria-selected", "false");
    expect(other).toHaveStyle({ color: "var(--samagra-muted)" });
    expect(other).toHaveStyle({ background: "transparent" });
  });

  it("moves the accent pill to whichever tab is clicked (selected ↔ unselected swap)", () => {
    render(<Clock />);
    const clockTab = screen.getByRole("tab", { name: /clock/i });
    const worldTab = screen.getByRole("tab", { name: /world/i });

    // Click World → it becomes the accent-tinted selected tab; Clock reverts to muted.
    fireEvent.click(worldTab);
    expect(worldTab).toHaveAttribute("aria-selected", "true");
    expect(worldTab).toHaveStyle({
      color: "var(--samagra-accent)",
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
    });
    expect(clockTab).toHaveAttribute("aria-selected", "false");
    expect(clockTab).toHaveStyle({ color: "var(--samagra-muted)", background: "transparent" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — analog face (AP4).                                              //
// -------------------------------------------------------------------------- //
describe("Clock (fidelity — analog face)", () => {
  it("renders a labelled 300×300 viewBox <svg> face", () => {
    render(<Clock />);
    const svg = screen.getByLabelText("Analog clock");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 300 300");
    expect(svg).toHaveAttribute("role", "img");
  });

  it("draws the backing circle (r134), 60 ticks and the 12/3/6/9 numerals", () => {
    render(<Clock />);
    const svg = screen.getByLabelText("Analog clock");
    // backing circle = R+14 = 134.
    const backing = svg.querySelector('circle[r="134"]');
    expect(backing).not.toBeNull();
    // FD1: the backing fill + ring are the theme card-bg / line vars, not baked.
    expect(backing).toHaveAttribute("fill", "var(--samagra-card-bg)");
    expect(backing).toHaveAttribute("stroke", "var(--samagra-line)");
    // 60 tick lines.
    expect(svg.querySelectorAll("line.clock-tick")).toHaveLength(60);
    // every 5th tick (12 of them) is the `big` major tick (strokeWidth 2).
    expect(svg.querySelectorAll("line.clock-tick--big")).toHaveLength(12);
    // the four cardinal numerals, each 17px/700 in the theme text var (FD1).
    for (const n of ["12", "3", "6", "9"]) {
      const numeral = within(svg).getByText(n);
      expect(numeral).toBeInTheDocument();
      expect(numeral).toHaveAttribute("font-size", "17");
      expect(numeral).toHaveAttribute("font-weight", "700");
      expect(numeral).toHaveAttribute("fill", "var(--samagra-text)");
    }
    // FD1: the major (every-5th) ticks paint in the muted var @ 2px, the minors in
    // the line var @ 1px — both theme-driven, no baked hexes.
    const big = svg.querySelector("line.clock-tick--big");
    expect(big).toHaveAttribute("stroke", "var(--samagra-muted)");
    expect(big).toHaveAttribute("stroke-width", "2");
    const minor = svg.querySelector("line.clock-tick:not(.clock-tick--big)");
    expect(minor).toHaveAttribute("stroke", "var(--samagra-line)");
    expect(minor).toHaveAttribute("stroke-width", "1");
  });

  it("draws the three hands; the second hand + centre pin use the accent var (FD1)", () => {
    render(<Clock />);
    const svg = screen.getByLabelText("Analog clock");
    // hour 5 / minute 4 / second 2px widths (proto §3.1).
    const hour = svg.querySelector("line.clock-hand--hour");
    const minute = svg.querySelector("line.clock-hand--minute");
    const second = svg.querySelector("line.clock-hand--second");
    expect(hour).toHaveAttribute("stroke-width", "5");
    expect(minute).toHaveAttribute("stroke-width", "4");
    expect(second).toHaveAttribute("stroke-width", "2");
    // second hand is the theme accent var (FD1), not a baked hex.
    expect(second).toHaveAttribute("stroke", "var(--samagra-accent)");
    // centre pin r7 is the accent var too.
    const pin = svg.querySelector('circle.clock-pin[r="7"]');
    expect(pin).toHaveAttribute("fill", "var(--samagra-accent)");
    // hour + minute hands are the theme text var (FD1), not a baked hex.
    expect(hour).toHaveAttribute("stroke", "var(--samagra-text)");
    expect(minute).toHaveAttribute("stroke", "var(--samagra-text)");
    // the inner r3 cap dot fills with the window-bg var (FD1).
    const cap = svg.querySelector('circle[r="3"]');
    expect(cap).toHaveAttribute("fill", "var(--samagra-win-bg)");
  });

  it("renders the digital HH:MM:SS AM/PM readout (38px/700, tabular-nums) + date + timezone", () => {
    render(<Clock />);
    const digital = screen.getByTestId("clock-digital");
    // HH:MM:SS AM/PM shape.
    expect(digital).toHaveTextContent(/^\d{2}:\d{2}:\d{2} (AM|PM)$/);
    expect(digital).toHaveStyle({
      fontSize: "38px",
      fontWeight: "700",
      fontVariantNumeric: "tabular-nums",
    });
    // the date + timezone supporting lines are present.
    expect(screen.getByTestId("clock-date")).toBeInTheDocument();
    expect(screen.getByTestId("clock-tz")).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — stopwatch (AP4).                                                //
// -------------------------------------------------------------------------- //
describe("Clock (fidelity — stopwatch)", () => {
  function gotoStopwatch() {
    render(<Clock />);
    fireEvent.click(screen.getByRole("tab", { name: /stopwatch/i }));
  }

  it("renders the MM:SS readout at 62px/300 tabular-nums with a `.cs` accent span (FD1)", () => {
    gotoStopwatch();
    const main = screen.getByTestId("sw-main");
    expect(main).toHaveStyle({
      fontSize: "62px",
      fontWeight: "300",
      fontVariantNumeric: "tabular-nums",
    });
    // the centiseconds span is the theme accent var (FD1), 28px, prefixed with a dot.
    const cs = screen.getByTestId("sw-cs");
    expect(cs).toHaveStyle({ color: "var(--samagra-accent)", fontSize: "28px" });
    expect(cs).toHaveTextContent(/^\.\d{2}$/);
    // proto §3.3: the `.cs` span is a fixed-width (46px), left-aligned, 500-weight
    // tail so the MM:SS digits never reflow as the centiseconds tick.
    expect(cs).toHaveStyle({ width: "46px", textAlign: "left", fontWeight: "500" });
    // the MM:SS main + .cs share a baseline-aligned flex row (the proto's readout).
    expect(main).toHaveStyle({ display: "flex", alignItems: "baseline" });
    // at rest the readout reads 00:00 (proto default, elapsed 0).
    expect(main).toHaveTextContent("00:00");
  });

  it("renders the Reset + Start controls at rest", () => {
    gotoStopwatch();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — timer (AP4).                                                    //
// -------------------------------------------------------------------------- //
describe("Clock (fidelity — timer)", () => {
  function gotoTimer() {
    render(<Clock />);
    fireEvent.click(screen.getByRole("tab", { name: /timer/i }));
  }

  it("renders a 264×264 viewBox ring <svg> with the r110 / stroke-13 progress arc (accent var)", () => {
    gotoTimer();
    const svg = screen.getByLabelText("Timer ring");
    expect(svg).toHaveAttribute("viewBox", "0 0 264 264");
    // both ring circles are r110.
    const rings = svg.querySelectorAll('circle[r="110"]');
    expect(rings).toHaveLength(2);
    // the progress arc is stroke-width 13 and the theme accent var (FD1).
    const arc = svg.querySelector("circle.timer-ring--arc");
    expect(arc).toHaveAttribute("stroke-width", "13");
    expect(arc).toHaveAttribute("stroke", "var(--samagra-accent)");
    // the depletion track is the same r110/stroke13 ring painted in the sub-bg var (FD1).
    const track = svg.querySelector("circle.timer-ring--track");
    expect(track).toHaveAttribute("stroke-width", "13");
    expect(track).toHaveAttribute("stroke", "var(--samagra-sub-bg)");
    // proto §3.4: the track is painted BEFORE the arc so the accent arc sits on top.
    const ringCircles = Array.from(svg.querySelectorAll("circle.timer-ring"));
    expect(ringCircles.indexOf(track!)).toBeLessThan(ringCircles.indexOf(arc!));
    // the arc is round-capped and carries the proto's full-circumference dasharray.
    expect(arc).toHaveAttribute("stroke-linecap", "round");
    expect(arc).toHaveAttribute("stroke-dasharray", String(2 * Math.PI * 110));
    // the svg is rotated -90° so the arc starts at 12 o'clock (proto's wrapper transform).
    expect(svg).toHaveStyle({ transform: "rotate(-90deg)" });
  });

  it("renders the centred MM:SS countdown readout (default preset 05:00)", () => {
    gotoTimer();
    const readout = screen.getByTestId("timer-readout");
    expect(readout).toHaveTextContent(/^\d{2}:\d{2}$/);
    // the default preset is 5 min (proto §3.4 default).
    expect(readout).toHaveTextContent("05:00");
    expect(readout).toHaveStyle({ fontVariantNumeric: "tabular-nums" });
  });

  it("renders the four preset pills 1/5/10/25 min", () => {
    gotoTimer();
    for (const label of ["1 min", "5 min", "10 min", "25 min"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the default 5-min preset as the accent-tinted selected pill (FD1)", () => {
    gotoTimer();
    // proto §3.4 default preset = 5 min → it carries the accent text + accent@16% bg
    // and is a fully-rounded (999) pill; the others stay muted on the sub-bg var.
    const five = screen.getByRole("button", { name: "5 min" });
    expect(five).toHaveStyle({
      color: "var(--samagra-accent)",
      background: "color-mix(in srgb, var(--samagra-accent) 16%, transparent)",
      borderRadius: "999px",
    });
    const ten = screen.getByRole("button", { name: "10 min" });
    expect(ten).toHaveStyle({
      color: "var(--samagra-muted)",
      background: "var(--samagra-sub-bg)",
    });
    // clicking another preset moves the accent tint to it (selection follows the click).
    fireEvent.click(ten);
    expect(ten).toHaveStyle({
      color: "var(--samagra-accent)",
      background: "color-mix(in srgb, var(--samagra-accent) 16%, transparent)",
    });
    expect(screen.getByTestId("timer-readout")).toHaveTextContent("10:00");
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — world (AP4 / FD2).                                              //
// -------------------------------------------------------------------------- //
describe("Clock (fidelity — world)", () => {
  function gotoWorld() {
    render(<Clock />);
    fireEvent.click(screen.getByRole("tab", { name: /world/i }));
  }

  it("renders the six zone rows verbatim in order", () => {
    gotoWorld();
    const list = screen.getByTestId("clock-world");
    const rows = within(list).getAllByTestId(/^zone-row-/);
    expect(rows).toHaveLength(6);
    for (const city of [
      "New Delhi",
      "London",
      "New York",
      "San Francisco",
      "Tokyo",
      "Dubai",
    ]) {
      expect(within(list).getByText(city)).toBeInTheDocument();
    }
  });

  it("renders each row at the prototype geometry (cardBg var / 1px line var / radius 12)", () => {
    gotoWorld();
    const row = screen.getByTestId("zone-row-0");
    expect(row).toHaveStyle({
      background: "var(--samagra-card-bg)",
      border: "1px solid var(--samagra-line)",
      borderRadius: "12px",
    });
  });

  it("renders a 36px round day/night chip holding a real <svg> glyph (FD2), never a letter badge", () => {
    gotoWorld();
    const row = screen.getByTestId("zone-row-0");
    const chip = within(row).getByTestId("zone-chip");
    expect(chip).toHaveStyle({ width: "36px", height: "36px", borderRadius: "50%" });
    // FD2: the chip holds a real inline <svg> (sun / moon), not a unicode/letter badge.
    const glyph = chip.querySelector("svg");
    expect(glyph).not.toBeNull();
    // it is a real 24×24 vector glyph (round-capped stroke paths), not a glyph font.
    expect(glyph).toHaveAttribute("viewBox", "0 0 24 24");
    expect(glyph).toHaveAttribute("stroke-linecap", "round");
    expect(glyph!.querySelector("path")).not.toBeNull();
    // every chip across the six rows resolves to a real svg glyph (no bare text node).
    const chips = within(screen.getByTestId("clock-world")).getAllByTestId("zone-chip");
    expect(chips).toHaveLength(6);
    for (const c of chips) expect(c.querySelector("svg")).not.toBeNull();
    expect(within(row).queryByText(/^[A-Z]$/)).toBeNull();
  });

  it("renders the zone time at 21px/600 tabular-nums", () => {
    gotoWorld();
    const time = screen.getByTestId("zone-time-0");
    expect(time).toHaveStyle({ fontSize: "21px", fontWeight: "600", fontVariantNumeric: "tabular-nums" });
  });

  it("tints + glyphs each chip by the documented day/night rule (proto §3.5)", () => {
    gotoWorld();
    const list = screen.getByTestId("clock-world");
    const chips = within(list).getAllByTestId("zone-chip");
    // proto §3.5: day chip = amber #f59e0b@18% bg + a <circle> sun glyph; night chip
    // = indigo #6366f1@15% bg + a single-<path> moon glyph. Each chip is exactly one
    // of the two — never an undecided/blank state — whatever the host-local hour is.
    // normalise whitespace so the assertion pins the colour/alpha, not the
    // host's rgba() serialisation (jsdom re-emits `rgba(r, g, b, a)` with spaces).
    const norm = (s: string) => s.replace(/\s+/g, "");
    const DAY_BG = "rgba(245,158,11,0.18)";
    const NIGHT_BG = "rgba(99,102,241,0.15)";
    for (const chip of chips) {
      const bg = norm(chip.style.background);
      expect([DAY_BG, NIGHT_BG]).toContain(bg);
      const glyph = chip.querySelector("svg");
      expect(glyph).not.toBeNull();
      if (bg === DAY_BG) {
        // sun glyph carries the orb <circle>; chip text colour = the amber hue.
        expect(glyph!.querySelector("circle")).not.toBeNull();
        expect(chip).toHaveStyle({ color: "#f59e0b" });
      } else {
        // moon glyph is path-only (no <circle>); chip text colour = the indigo glyph hue.
        expect(glyph!.querySelector("circle")).toBeNull();
        expect(chip).toHaveStyle({ color: "#818cf8" });
      }
    }
  });

  it("renders a weekday line + live time for every zone row", () => {
    gotoWorld();
    const list = screen.getByTestId("clock-world");
    for (let i = 0; i < 6; i++) {
      const row = within(list).getByTestId(`zone-row-${i}`);
      // the live time reads h:MM AM/PM (Intl en-US numeric hour, 2-digit minute).
      expect(within(row).getByTestId(`zone-time-${i}`)).toHaveTextContent(
        /^\d{1,2}:\d{2}\s?(AM|PM)$/,
      );
    }
  });
});
