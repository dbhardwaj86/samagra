import { useState } from "react";
export interface PostState<T> { data: T | null; error: string | null; loading: boolean; }
export function useApiPost<T = unknown>() {
  const [state, setState] = useState<PostState<T>>({ data: null, error: null, loading: false });
  async function post(path: string, body: unknown): Promise<T | null> {
    setState({ data: null, error: null, loading: true });
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j?.detail) msg = String(j.detail); } catch { /* keep msg */ }
        setState({ data: null, error: msg, loading: false });
        return null;
      }
      const json = (await res.json()) as T;
      setState({ data: json, error: null, loading: false });
      return json;
    } catch (e) {
      setState({ data: null, error: String(e), loading: false });
      return null;
    }
  }
  return { ...state, post };
}
