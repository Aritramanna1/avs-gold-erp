# Translations

The renderer uses file-based dictionaries under `src/i18n`. English is the eager baseline; Hindi, Marathi, and Bengali dictionaries are lazy-loaded only when selected.

## Behavior

- The active application language is persisted in Settings and local startup metadata.
- The document `lang` attribute follows the selected language.
- Missing localized keys fall back to English, so a screen never renders an empty or raw key.
- Application, print, WhatsApp, and staff languages are configured independently in Settings.
- Settings displays honest localized-key coverage for each language.

Notifications and Catalog have complete English, Hindi, Marathi, and Bengali dictionaries. Other modules continue to use their existing localized coverage with English fallback.

## Rules

- New user-visible strings in translated modules require keys in all four dictionaries.
- Do not use runtime sentence matching or duplicate translation systems.
- Financial values, gold weights, document identifiers, and audit data are never translated or reformatted in a way that changes meaning.
