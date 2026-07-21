# Universal Export Engine

**The only data-export framework.** All CSV/XLSX exports use `src/lib/report-engine.ts`. Do not add another spreadsheet/CSV utility or a second `xlsx` integration.

## API

```ts
exportToCSV(filename: string, rows: (string | number)[][]): void
exportToXLSX(filename: string, sheets: Record<string, (string | number)[][]>): Promise<void>
```

- `exportToCSV` — synchronous, one sheet, header row first.
- `exportToXLSX` — one entry per sheet; sheet names auto-trimmed to 31 chars. The `xlsx` dependency (~280 kB) is **lazy-loaded** inside the function so it never bloats the main bundle.

`report-engine.ts` also holds the shared date-range/report helpers used by the 35+ report pages.

## Usage pattern

Build a plain array-of-arrays (or a `{ sheet: rows }` map), then call the engine:

```ts
void exportToXLSX(`${title}.xlsx`, { Summary: [columns, ...rows] });
```

Dashboards and drill-downs (e.g. Our Gold Stock) expose an **Export** button that hands the current table to `exportToXLSX`, and **Print** via the Print Engine / page print CSS. Reports use `exportToCSV`/`exportToXLSX` uniformly.

## Rules

- Format numbers at the boundary (`mgToGrams`, `paiseToRupees`) before putting them in rows — the engine writes values verbatim.
- No new export dependency. If a format is genuinely needed (PDF table export), route through the Print Engine's PDF path, not a parallel library.
