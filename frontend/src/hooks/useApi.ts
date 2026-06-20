// src/hooks/useApi.ts
// Typed thin fetch hook against the `ApiClient` contract (api.md §2).
// Read-only: GETs a JSON endpoint and exposes {data, error, loading}.
// All real shaping lives in the consuming component / pure lib — this hook
// only owns the fetch + JSON decode + mount/unmount lifecycle.
import { useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * GET a JSON endpoint once on mount. Defensive: a non-2xx response or a JSON
 * decode failure surfaces as `error` rather than throwing into render. The
 * effect is abort-guarded so a unit that unmounts mid-flight never setstates.
 */
export function useApi<T = unknown>(path: string): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null, loading: true });
    (async () => {
      try {
        const res = await fetch(path, { headers: { accept: "application/json" } });
        if (!res.ok) {
          if (alive) setState({ data: null, error: `HTTP ${res.status}`, loading: false });
          return;
        }
        const json = (await res.json()) as T;
        if (alive) setState({ data: json, error: null, loading: false });
      } catch (e) {
        if (alive) setState({ data: null, error: String(e), loading: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  return state;
}
