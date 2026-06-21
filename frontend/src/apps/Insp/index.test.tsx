import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Insp from "./index";

const data = { results: [
  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
    unit: null, chapter: null, status: null, path: null, url: null, updated_at: null, meta: { pdfs: 5 } },
] };

describe("INSP app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=insp and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Insp />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=insp&limit=500");
    expect(screen.getByTestId("insp")).toBeInTheDocument();
    expect(screen.getByText("NSEP 2024")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Insp />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("insp")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Insp />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
  // A-5 (ship loop) mobile no-overflow guard: catalog-row is a flex row; without
  // min-width:0 on the text block a long unbreakable title forces ~145px of horizontal
  // overflow that the phone screen (overflow:hidden) clips. Assert the shrink-enabling
  // contract (min-width:0 + break-word) so a revert re-introduces the clip-test red.
  it("catalog row title block can shrink (A-5 mobile-overflow guard)", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Insp />);
    const titleBlock = screen.getByTestId("catalog-row").firstElementChild as HTMLElement;
    expect(titleBlock.style.minWidth).toMatch(/^0(px)?$/);
    const titleText = titleBlock.firstElementChild as HTMLElement;
    expect(titleText.style.overflowWrap).toBe("break-word");
  });
  it("catalog list column is width-capped, not auto-grow (A-5 mobile-overflow guard)", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Insp />);
    // Without an explicit column the implicit `auto` track grows to the rows' max-content
    // (long single-line titles) and overflows the phone screen. minmax(0,1fr) caps it to
    // the container so rows wrap instead of forcing ~145px of clipped horizontal overflow.
    const tmpl = screen.getByTestId("catalog-list").style.gridTemplateColumns;
    expect(tmpl).toMatch(/minmax\(\s*0/);
  });
});
