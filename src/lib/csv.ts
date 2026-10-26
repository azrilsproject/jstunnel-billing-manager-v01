/**
 * RFC 4180 compliant CSV parser and serializer with auto delimiter detection (, or ;)
 * and UTF-8 BOM support for Microsoft Excel.
 */

export function parseCsv(content: string): string[][] {
  // Strip BOM if present
  let text = content.replace(/^\uFEFF/, '');
  if (!text.trim()) return [];

  // Detect delimiter from first non-empty line
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip CRLF
      }
      currentRow.push(currentField.trim());
      // Skip trailing empty row
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Push final field/row if not empty
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function serializeCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));

  // Prepend UTF-8 BOM so Excel opens with proper accents & Indonesian characters
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n') + '\r\n';
}
