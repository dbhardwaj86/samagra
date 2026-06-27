import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Pratham from "./index";

const manifest = {
  schema: "samagra.published.v1", generated_at: "t", publication_count: 1,
  chapters: {
    "circular-motion": {
      chapter: "circular-motion", title: "Circular Motion",
      seed_ref: "textbook:circular-motion",
      artifacts: [
        { uid: "u1", lane: "lecture", assignment_id: "a", files: [{ rel: "circular-motion/cm-thick.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
        { uid: "u2", lane: "revision", assignment_id: "a", files: [{ rel: "circular-motion/cm-thin.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
      ],
    },
  },
};

describe("Pratham reader", () => {
  beforeEach(() => useApiMock.mockReset());

  it("reads /api/published and renders the chapter list", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    expect(useApiMock).toHaveBeenCalledWith("/api/published");
    expect(screen.getByTestId("pratham-chapter-circular-motion")).toBeInTheDocument();
  });

  it("leads with the Saar (revision) lane and points the frame at it", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-lane-revision")).toBeInTheDocument();
    expect(screen.getByTestId("pratham-frame").getAttribute("src"))
      .toBe("/api/published/circular-motion/revision");
  });

  it("switching lane swaps the iframe src", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    fireEvent.click(screen.getByTestId("pratham-lane-lecture"));
    expect(screen.getByTestId("pratham-frame").getAttribute("src"))
      .toBe("/api/published/circular-motion/lecture");
  });

  it("empty manifest shows the empty state", () => {
    useApiMock.mockReturnValue({ data: { ...manifest, chapters: {} }, loading: false, error: null });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-empty")).toHaveTextContent("Nothing published yet.");
  });
});
