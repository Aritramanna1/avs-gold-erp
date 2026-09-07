import DOMPurify from "dompurify";

/**
 * Sanitize tenant-edited email HTML — strip scripts, iframes, event handlers using DOMPurify.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "link", "meta", "base"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: false,
  }).trim();
}

