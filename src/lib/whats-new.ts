/**
 * Release notes shown once per version in the "What's New" popup
 * (`src/components/whats-new-dialog.tsx`). Add a new entry here whenever a
 * user-visible fix or feature ships — keep it in sync with
 * `docs/CHANGELOG.md`, this is just the short in-app version.
 */
export interface WhatsNewEntry {
  version: string;
  date: string;
  fixed?: string[];
  added?: string[];
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: "2026-08-11",
    date: "11 Aug 2026",
    fixed: [
      "Closing the browser tab now signs you out — the app no longer keeps a stale session logged in.",
      "Added a Log Out / Switch Account button on the expired-license screen, so a blocked user can sign in with a different account.",
    ],
  },
];

export function getLatestWhatsNew(): WhatsNewEntry | undefined {
  return WHATS_NEW[0];
}
