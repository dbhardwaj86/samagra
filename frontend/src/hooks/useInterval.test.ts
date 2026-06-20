// E1.22 RED — useInterval fake-timer test (the headless residue of the VISUAL
// Clock task). The hook is the ONE new piece of logic khanak's Clock wrapper
// adds over the already-green `lib/clock/*` engines: a cleanup-safe declarative
// `setInterval`. Per proto.md §11 ("All cleared in componentWillUnmount") and the
// plan §E1.22, interval hygiene = created on mount, fired at the interval, and
// CLEARED on unmount. That hygiene is the only thing this task tests headlessly;
// angles/elapsed/ring/zones are NOT re-tested here (green in lib/clock).
//
// Two assertions, both with fake timers:
//   (1) the callback fires once per `delay` ms while mounted (drives the
//       1s clock / 33ms sw / 200ms timer ticks);
//   (2) on unmount the interval is cleared — no further fires after teardown
//       (the leak that proto.md §11 / RUBRIC §5 "visual residue" guards against).
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInterval } from "./useInterval";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useInterval (E1.22 residue — fake timers)", () => {
  it("fires the callback once per `delay` ms while mounted", () => {
    const cb = vi.fn();
    renderHook(() => useInterval(cb, 200));

    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600); // three more 200ms ticks
    expect(cb).toHaveBeenCalledTimes(4);
  });

  it("clears the interval on unmount — no further fires after teardown", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useInterval(cb, 33));

    vi.advanceTimersByTime(99); // three 33ms ticks
    expect(cb).toHaveBeenCalledTimes(3);

    unmount();

    vi.advanceTimersByTime(330); // would be ten more ticks if not cleared
    expect(cb).toHaveBeenCalledTimes(3); // unchanged — interval was cleared
  });
});
