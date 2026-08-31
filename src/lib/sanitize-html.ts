/**
 * Sanitize tenant-edited email HTML — strip scripts, iframes, event handlers.
 */
const BLOCKED_TAGS =
  /<\s*\/?\s*(script|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>/gi;
const ON_EVENT_ATTRS = /\s+on\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const JAVASCRIPT_URL =
  /\s+(href|src|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi;

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(ON_EVENT_ATTRS, "")
    .replace(JAVASCRIPT_URL, "")
    .trim();
}
