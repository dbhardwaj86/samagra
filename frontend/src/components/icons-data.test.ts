// src/components/icons-data.test.ts — A-2 regression guard (ralph ship loop).
// The A-1 production-serve audit found every app glyph rendering a real <svg> (no
// empty-icon fallback). This locks that in: it asserts the ICONS data is COMPLETE
// and NON-EMPTY for every app the registry actually launches. The existing
// Icon.test.tsx only iterates `Object.keys(ICONS)` — that can't catch a newly
// registered AppId that ships WITHOUT a glyph, nor an empty-string path value
// (`""` → one empty `<path d="">`, which still passes a `paths.length > 0` check).
// Both gaps map straight to the `ICONS[name] ?? ""` empty fallback in <Icon>.
import { describe, it, expect } from "vitest";
import { ICONS } from "./icons-data";
import { APPS, ORDER } from "../registry";

describe("ICONS data — completeness vs the app registry (A-2 regression guard)", () => {
  it("has real, non-empty path data for every AppId the registry launches", () => {
    for (const id of ORDER) {
      const d = ICONS[id];
      expect(d, `ICONS["${id}"] is missing`).toBeTypeOf("string");
      expect(d.trim().length, `ICONS["${id}"] is empty → empty-icon fallback`).toBeGreaterThan(0);
      // Valid SVG path data starts with an absolute Move command.
      expect(d.trim().startsWith("M"), `ICONS["${id}"] is not valid path data`).toBe(true);
      // Every '|'-split segment must itself be non-empty — guards a stray empty
      // <path d=""> sneaking in via e.g. a trailing/double pipe.
      for (const seg of d.split("|")) {
        expect(seg.trim().length, `ICONS["${id}"] has an empty path segment`).toBeGreaterThan(0);
      }
    }
  });

  it("covers exactly the registry app set — no glyph gaps, no orphan glyphs", () => {
    expect(new Set(Object.keys(ICONS))).toEqual(new Set(Object.keys(APPS)));
    expect(Object.keys(ICONS)).toHaveLength(ORDER.length); // 17
  });
});
