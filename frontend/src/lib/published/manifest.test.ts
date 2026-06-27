import { describe, it, expect } from "vitest";
import {
  artifactUrl, chaptersList, fileExts, laneLabel, laneSort, pickChapter, pickLane,
  type PublishedManifest,
} from "./manifest";

const manifest: PublishedManifest = {
  schema: "samagra.published.v1", generated_at: "t", publication_count: 2,
  chapters: {
    "circular-motion": {
      chapter: "circular-motion", title: "Circular Motion",
      seed_ref: "textbook:circular-motion",
      artifacts: [
        { uid: "u1", lane: "lecture", assignment_id: "a", files: [{ rel: "circular-motion/cm-thick.html", sha256: "s", bytes: 1 }, { rel: "circular-motion/cm-thick.docx", sha256: "s2", bytes: 2 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
        { uid: "u2", lane: "revision", assignment_id: "a", files: [{ rel: "circular-motion/cm-thin.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
      ],
    },
    "atoms": {
      chapter: "atoms", title: "Atoms", seed_ref: "textbook:atoms", artifacts: [],
    },
  },
};

describe("chaptersList", () => {
  it("extracts + sorts chapters by title, defensive on null", () => {
    const cs = chaptersList(manifest);
    expect(cs.map((c) => c.chapter)).toEqual(["atoms", "circular-motion"]);
    expect(chaptersList(null)).toEqual([]);
    expect(chaptersList({ ...manifest, chapters: undefined as never })).toEqual([]);
  });
});

describe("laneSort", () => {
  it("Saar-led order; unknown lanes after, alphabetical", () => {
    expect(laneSort(["lecture", "revision"])).toEqual(["revision", "lecture"]);
    expect(laneSort(["zeta", "deck", "alpha"])).toEqual(["deck", "alpha", "zeta"]);
    expect(laneSort(["revision", "revision"])).toEqual(["revision"]);  // de-duped
  });
});

describe("laneLabel", () => {
  it("maps known lanes; falls back to titlecase", () => {
    expect(laneLabel("revision").name).toBe("Saar");
    expect(laneLabel("paper").name).toBe("Pariksha");
    expect(laneLabel("mystery_lane").name).toBe("Mystery Lane");
  });
});

describe("pickChapter / pickLane", () => {
  it("returns the requested if present, else the first", () => {
    const cs = chaptersList(manifest);
    expect(pickChapter(cs, "circular-motion")?.chapter).toBe("circular-motion");
    expect(pickChapter(cs, "missing")?.chapter).toBe("atoms");      // fallback to first
    expect(pickChapter([], "x")).toBeUndefined();
    expect(pickLane(["revision", "lecture"], "lecture")).toBe("lecture");
    expect(pickLane(["revision", "lecture"], "missing")).toBe("revision");
    expect(pickLane([], undefined)).toBeUndefined();
  });
});

describe("fileExts", () => {
  it("lists lowercased extensions present on an artifact", () => {
    const cm = chaptersList(manifest).find((c) => c.chapter === "circular-motion")!;
    const lecture = cm.artifacts.find((a) => a.lane === "lecture")!;
    expect(fileExts(lecture).sort()).toEqual(["docx", "html"]);
    expect(fileExts(undefined)).toEqual([]);
  });
});

describe("artifactUrl", () => {
  it("builds the endpoint path; adds ?kind= only for non-html", () => {
    expect(artifactUrl("cm", "revision")).toBe("/api/published/cm/revision");
    expect(artifactUrl("cm", "lecture", "html")).toBe("/api/published/cm/lecture");
    expect(artifactUrl("cm", "lecture", "docx")).toBe("/api/published/cm/lecture?kind=docx");
  });
});
