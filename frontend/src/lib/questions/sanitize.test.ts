import { describe, expect, it } from "vitest";
import { sanitizeQxHtml } from "./sanitize";

describe("sanitizeQxHtml — W1.2 XSS guard for QX-rendered HTML", () => {
  it("returns empty string for nullish input", () => {
    expect(sanitizeQxHtml("")).toBe("");
    // @ts-expect-error — runtime guard for a bad payload
    expect(sanitizeQxHtml(undefined)).toBe("");
  });

  it("removes <script> elements", () => {
    const out = sanitizeQxHtml('<div class="stem">ok</div><script>alert(1)</script>');
    expect(out).toContain("ok");
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("strips event-handler attributes (the classic img onerror)", () => {
    const out = sanitizeQxHtml('<img class="fig" src="x" onerror="alert(1)">');
    expect(out).toContain('class="fig"');
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("strips javascript: URLs from href/src", () => {
    const out = sanitizeQxHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain("javascript:");
  });

  it("strips javascript: split by embedded control chars (tab/newline/CR)", () => {
    // Browsers strip ASCII tab/LF/CR before resolving the scheme, so a
    // contiguous-only regex misses these. The allowlist must still drop them.
    for (const payload of [
      '<a href="java\nscript:alert(1)">x</a>',
      '<a href="java\tscript:alert(1)">x</a>',
      '<a href="java&#10;script:alert(1)">x</a>',  // numeric entity → newline after parse
      '<a href="  javascript:alert(1)">x</a>',
    ]) {
      const out = sanitizeQxHtml(payload);
      expect(out).not.toContain("script:alert");
      expect(out).not.toContain("javascript");
    }
  });

  it("strips data:text/html and blob:/vbscript: URLs (scheme allowlist)", () => {
    expect(sanitizeQxHtml('<a href="data:text/html,<b>x</b>">x</a>')).not.toContain("data:text/html");
    expect(sanitizeQxHtml('<a href="blob:https://x/abc">x</a>')).not.toContain("blob:");
    expect(sanitizeQxHtml('<a href="vbscript:msgbox(1)">x</a>').toLowerCase()).not.toContain("vbscript:");
  });

  it("keeps safe http(s), relative, anchor and inert data:image URLs", () => {
    expect(sanitizeQxHtml('<img src="http://127.0.0.1:8783/asset?id=1">')).toContain("/asset?id=1");
    expect(sanitizeQxHtml('<img src="/asset?id=2">')).toContain("/asset?id=2");
    expect(sanitizeQxHtml('<a href="#frag">x</a>')).toContain('href="#frag"');
    const dataImg = '<img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(sanitizeQxHtml(dataImg)).toContain("data:image/png");
  });

  it("drops an SVG-namespaced <script> (case-insensitive tag drop)", () => {
    const out = sanitizeQxHtml('<svg><script>alert(1)</script></svg><p>kept</p>');
    expect(out).toContain("kept");
    expect(out.toLowerCase()).not.toContain("alert(1)");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("removes iframe/object/embed/style", () => {
    const out = sanitizeQxHtml(
      '<iframe src="evil"></iframe><object data="x"></object>' +
      '<embed src="y"><style>body{}</style><p>kept</p>');
    expect(out).toContain("kept");
    const lower = out.toLowerCase();
    expect(lower).not.toContain("<iframe");
    expect(lower).not.toContain("<object");
    expect(lower).not.toContain("<embed");
    expect(lower).not.toContain("<style");
  });

  it("keeps the KaTeX span + data-tex the engine emits", () => {
    const out = sanitizeQxHtml('<span class="ktx" data-tex="x^2"></span>');
    expect(out).toContain("ktx");
    expect(out).toContain('data-tex="x^2"');
  });

  it("keeps an absolutized figure <img> (safe src survives)", () => {
    const src = "http://127.0.0.1:8783/asset?slug=a&id=1";
    const out = sanitizeQxHtml(`<img class="fig" src="${src}">`);
    expect(out).toContain("/asset?");
    expect(out).toContain("fig");
  });

  it("keeps option/passage/matrix table markup", () => {
    const out = sanitizeQxHtml(
      '<div class="opt"><span class="opt-label">A</span>kept</div>' +
      '<table class="matrix-table"><tr><td>1</td></tr></table>');
    expect(out).toContain("opt-label");
    expect(out).toContain("matrix-table");
    expect(out).toContain("kept");
    expect(out).toContain("1");
  });
});
