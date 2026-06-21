import { renderHook, act } from "@testing-library/react";
import { useApiPost } from "./useApiPost";

it("POSTs JSON and returns parsed data", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } }),
  );
  const { result } = renderHook(() => useApiPost<{ ok: boolean }>());
  let out: unknown;
  await act(async () => { out = await result.current.post("/api/x", { a: 1 }); });
  expect(out).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledWith("/api/x", expect.objectContaining({ method: "POST" }));
  expect(result.current.error).toBeNull();
});

it("surfaces a non-2xx detail as error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ detail: "bad kind" }), { status: 400, headers: { "content-type": "application/json" } }),
  );
  const { result } = renderHook(() => useApiPost());
  await act(async () => { await result.current.post("/api/x", {}); });
  expect(result.current.error).toBe("bad kind");
});
