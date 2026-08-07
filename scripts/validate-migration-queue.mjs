#!/usr/bin/env node

import { readFileSync } from "node:fs";

const file = "docs/MIGRATION_QUEUE.md";
const source = readFileSync(file, "utf8");
const lines = source.split(/\r?\n/).filter((line) => line.startsWith("|"));
const [header, separator, ...rows] = lines;

const requiredColumns = [
  "Status",
  "Migration ID",
  "Branch",
  "PR",
  "Owner",
  "Depends on",
  "Affected objects",
  "RLS/grants impact",
  "Rollback/recovery",
];
const allowedStatuses = new Set(["Reserved", "In review", "Merged", "Superseded", "Example"]);
const seenIds = new Set();
const errors = [];

if (!header || !separator) {
  errors.push(`${file} must contain a markdown table.`);
} else {
  const columns = parseRow(header);
  for (const column of requiredColumns) {
    if (!columns.includes(column)) {
      errors.push(`${file} is missing required column: ${column}`);
    }
  }

  rows
    .map(parseRow)
    .filter((row) => row.length === columns.length)
    .forEach((row, index) => {
      const record = Object.fromEntries(
        columns.map((column, columnIndex) => [column, clean(row[columnIndex])]),
      );
      const rowNumber = index + 3;
      const status = record.Status;
      const migrationId = record["Migration ID"];

      if (!allowedStatuses.has(status)) {
        errors.push(`Row ${rowNumber}: invalid status "${status}".`);
      }
      if (status !== "Example") {
        for (const column of requiredColumns) {
          if (!record[column] || record[column] === "TBD") {
            errors.push(`Row ${rowNumber}: ${column} must be filled.`);
          }
        }
      }
      if (migrationId && migrationId !== "None" && !/^\d{14}_[a-z0-9_]+\.sql$/.test(migrationId)) {
        errors.push(`Row ${rowNumber}: invalid migration ID "${migrationId}".`);
      }
      if (migrationId && migrationId !== "None") {
        if (seenIds.has(migrationId)) {
          errors.push(`Row ${rowNumber}: duplicate migration ID "${migrationId}".`);
        }
        seenIds.add(migrationId);
      }
    });
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Migration queue is valid.");

function parseRow(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function clean(value) {
  return value.replace(/^`|`$/g, "").trim();
}
