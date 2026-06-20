// E1.22 RED — Clock smoke (proto.md §3 Clock + §3.4/§3.5 tabs).
// The Clock app is a THIN presentational wrapper over the already-green
// `lib/clock/*` engines (analog/digital/stopwatch/timer/world, all green in
// deepak's E1.10–E1.13). khanak's wrapper renders the four tabs and wires a
// `useInterval` (1s clock / 33ms sw / 200ms timer). The ONE structural assertion
// the loop gates on (the headless residue): the wrapper renders the FOUR tabs
// `clock | stopwatch | timer | world` (proto.md §3 line 180, default `clock`).
//
// Hand sweep, ring depletion, the WebAudio chime, and per-pixel parity are a
// SEPARATE human QA pass (RUBRIC §6, E1.22 row) and are NOT tested here.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Clock from "./index";

// proto.md §3 line 180: Tabs `clock | stopwatch | timer | world`, default `clock`.
const TABS = ["clock", "stopwatch", "timer", "world"];

describe("Clock (E1.22 smoke)", () => {
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
});
