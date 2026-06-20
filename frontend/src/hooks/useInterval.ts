// useInterval — a cleanup-safe declarative `setInterval` (E1.22).
// The ONE new piece of logic khanak's Clock wrapper adds over the already-green
// `lib/clock/*` engines. Per proto.md §11 ("All cleared in componentWillUnmount")
// and plan §E1.22, interval hygiene = created on mount, fired at the interval,
// and CLEARED on unmount (and re-created when `delay` changes; paused when
// `delay` is null). The callback is held in a ref so a changing closure does NOT
// tear down and rebuild the interval — only `delay` does.
import { useEffect, useRef } from "react";

/**
 * Fire `callback` every `delay` ms. Passing `null` for `delay` pauses the
 * interval (no timer is created). The interval is always cleared on unmount and
 * whenever `delay` changes — no leaked timers (proto.md §11 / RUBRIC §5).
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Keep the latest callback in the ref without resetting the interval.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
