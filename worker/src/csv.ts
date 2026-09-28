// Minimal CSV parsing/escaping for the flat-eligibility import and generated
// CSV exports/downloads — deliberately not a general-purpose CSV library.
import { FLAT_CSV_HEADERS } from './constants';

/** Accepts a "flat_no" header row, or one bare flat number per line. Blank lines/dupes ignored by the caller. */
export function parseFlatsCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const flatIdx = header.indexOf(FLAT_CSV_HEADERS.FLAT_NO);
  const hasHeader = flatIdx !== -1;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const flatNumbers: string[] = [];
  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const flatNo = hasHeader ? cells[flatIdx] : cells[0];
    if (flatNo?.trim()) flatNumbers.push(flatNo.trim());
  }
  return flatNumbers;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
