# Changelog

Release-facing changes, newest first. Keep a Changelog style. Append here on any user-visible or architecture change.

## [Unreleased]

### Added
- Development environment specification: `CLAUDE.md` + `docs/` (ARCHITECTURE, DATABASE, MODULES, PRINT_ENGINE, EXPORT_ENGINE, WORKFLOW_RULES, NAMING, SECURITY, CODING_STANDARDS, UI_GUIDELINES, ROADMAP, CHANGELOG).
- MCP dev servers configured (`.mcp.json`): Serena, Context7, Sequential Thinking, Filesystem, Memory, Git.
- GitFlow branch structure: `develop` + `feature/<area>` branches.
- WhatsApp document sending: `sendWhatsAppDocument` reuses the Print Engine PDF, hosts via Supabase Storage, sends through WasenderAPI. `WhatsAppDocMenu` in Orders (Customer + Karigar documents).
- Daily Material Slip migrated to the Universal Print Engine (`daily_material_slip` docType + template + builder).
- Our Gold Stock dashboard: clickable balance cards with drill-down summaries + Export/Print; "Gold With Jewellers" card.
- Material Vault: per material×purity stock items (Add/Manage Stock) with fine-gold equivalent.
- Gold ledger: additive `jeweller` bucket; movement types Purchase / Opening Stock / Closing Stock / Transfer Between Departments.

### Changed
- "Gold & Material Vault" module renamed **Our Gold Stock**; converted to overview-only (Record Movement removed).
- Balance card labels: Vault Gold → Gold Held, Finished Stock → Finished Jewellery Stock, Customer Gold Held → Advance Gold / Customer Gold Held.
- Sidebar "Worker Gold Book" → "Material Book"; in-page hub with Coming Soon books.

### Fixed
- WasenderAPI send used the wrong credential (account PAT); now uses the per-session API Key — fixes `401 Invalid API Key`.
- WasenderAPI Connect no longer 400s on an already-connected session; surfaces the API's actual error message instead of a bare status code.

## Conventions

- Sections: Added / Changed / Fixed / Removed / Security.
- One bullet per change, user-facing language. Link the module. Cut an `[Unreleased]` into a version when a build is tagged.
