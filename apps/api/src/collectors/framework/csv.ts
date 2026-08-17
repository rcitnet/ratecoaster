/**
 * Minimal RFC 4180 CSV/TSV parser.
 *
 * Deliberately hand-written rather than a dependency. Affiliate product feeds
 * are the one place quoting genuinely matters — a ticket name with a comma, a
 * buy URL with an encoded quote — and a parser that can evaluate nothing is a
 * smaller liability than a library that can. Handles quoted fields, escaped
 * quotes (`""`), delimiters and newlines inside quotes, a leading UTF-8 BOM,
 * and both CRLF and LF line endings.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Strip a UTF-8 BOM if present, or the first header cell carries it.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // CRLF: let the following \n close the row. Bare CR (old Mac): close now.
      if (text[i + 1] !== "\n") pushRow();
    } else {
      field += c;
    }
  }

  // Flush a final field/row that had no trailing newline.
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop blank lines (a trailing newline yields a one-empty-field row).
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface CsvTable {
  header: string[];
  records: Array<Record<string, string>>;
}

/**
 * Parse a feed into header-keyed records. Header cells and values are trimmed,
 * because feeds are notoriously inconsistent about whitespace around columns.
 */
export function csvToObjects(text: string, delimiter = ","): CsvTable {
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0) return { header: [], records: [] };

  const header = rows[0]!.map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });

  return { header, records };
}
