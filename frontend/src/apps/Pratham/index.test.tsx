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
  beforeEach(() => {
    useApiMock.mockReset();
    window.history.pushState({}, "", "/");
  });

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

  it("shows a docx download link when the artifact has a .docx file", () => {
    const withDocx = {
      ...manifest,
      chapters: {
        "circular-motion": {
          ...manifest.chapters["circular-motion"],
          artifacts: [
            { uid: "u3", lane: "lecture", assignment_id: "a",
              files: [
                { rel: "circular-motion/cm-thick.html", sha256: "s", bytes: 1 },
                { rel: "circular-motion/cm-thick.docx", sha256: "s2", bytes: 2 },
              ],
              source_seed_ref: "", style_seed_version: null, captured_at: null,
              published_at: null, publication_id: "p" },
          ],
        },
      },
    };
    useApiMock.mockReturnValue({ data: withDocx, loading: false, error: null });
    render(<Pratham />);
    const link = screen.getByTestId("pratham-docx");
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe("/api/published/circular-motion/lecture?kind=docx");
    expect(link).toHaveTextContent("Download original (.docx)");
  });

  it("honors a deep-link to a specific chapter/lane at mount", () => {
    window.history.pushState({}, "", "/learn/circular-motion/lecture");
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-frame").getAttribute("src"))
      .toBe("/api/published/circular-motion/lecture");
  });

  it("shows a distinct error state when /api/published fails", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-error")).toBeInTheDocument();
    expect(screen.queryByTestId("pratham-empty")).not.toBeInTheDocument();
  });
});
