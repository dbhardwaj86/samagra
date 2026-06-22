/**
 * W1.2 — sanitize QX-rendered question HTML before `dangerouslySetInnerHTML`.
 *
 * The Questions app injects HTML produced by the QX engine. QX is trusted today,
 * but it is now reachable behind a public tunnel and the HTML crosses an origin
 * boundary, so a compromised/poisoned QX payload must not be able to run script
 * in the operator console. This strips the XSS vectors while keeping everything
 * QX legitimately emits (KaTeX `data-tex` spans, figure `<img>`, option/passage
 * markup, matrix tables):
 *
 *   - removes script-family elements (script/iframe/object/embed/link/meta/style/base),
 *     case-insensitively so an SVG/MathML-namespaced `<script>` (lowercase tagName) is caught too
 *   - strips every `on*` event-handler attribute
 *   - allowlists URL schemes on href/src/xlink:href — only http(s), mailto, inert
 *     data:image, and relative/anchor URLs survive; everything else (javascript:,
 *     vbscript:, data:text/html, blob:, filesystem:, ...) is dropped
 *
 * The URL check normalizes the value first — stripping the ASCII control chars
 * (tab/LF/CR/etc.) and whitespace that browsers ignore when resolving a scheme —
 * so a split `java\nscript:` cannot slip past a contiguous-only matcher.
 *
 * Pure + DOM-based (runs under jsdom in tests and the browser in prod).
 */
const DROP_TAGS = new Set([
  "SCRIPT", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "STYLE", "BASE",
]);
const URL_ATTRS = new Set(["href", "src", "xlink:href"]);
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/;          // generic "scheme:" detector
const SAFE_SCHEME = /^(https?|mailto):/;           // explicit safe schemes
const SAFE_DATA_IMAGE = /^data:image\//;           // inert image data URIs only
// ASCII controls + space (U+0000–U+0020); browsers strip tab/LF/CR (and ignore
// leading whitespace/controls) before resolving a URL scheme, so a split
// `java\nscript:` must be normalized away here. The control-char range is the
// whole point of this guard — the no-control-regex lint is intentionally waived.
// eslint-disable-next-line no-control-regex
const STRIP_CONTROL = /[\x00-\x20]+/g;

function urlAttrIsSafe(raw: string): boolean {
  const v = raw.replace(STRIP_CONTROL, "").toLowerCase();
  if (!HAS_SCHEME.test(v)) return true;            // relative / anchor / query — safe
  return SAFE_SCHEME.test(v) || SAFE_DATA_IMAGE.test(v);
}

function clean(el: Element): void {
  for (const child of Array.from(el.children)) {
    if (DROP_TAGS.has(child.tagName.toUpperCase())) {
      child.remove();
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        child.removeAttribute(attr.name);
      } else if (URL_ATTRS.has(name) && !urlAttrIsSafe(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
    clean(child);
  }
}

export function sanitizeQxHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  clean(doc.body);
  return doc.body.innerHTML;
}
