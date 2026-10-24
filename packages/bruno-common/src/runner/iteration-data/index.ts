export type T_IterationRow = Record<string, unknown>;

type T_CsvCell = { value: string; quoted: boolean };

const stripBom = (text: string): string => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

const isWhitespace = (ch: string): boolean => ch === ' ' || ch === '\t';

// RFC 4180 with the leniencies newman's csv-parse options allow: trimmed unquoted cells,
// any of CRLF/LF/CR as row separators, blank lines skipped.
const readCsvRecords = (text: string): T_CsvCell[][] => {
  const records: T_CsvCell[][] = [];
  let row: T_CsvCell[] = [];
  let cell = '';
  let quoted = false;
  let inQuotes = false;

  const endCell = () => {
    row.push({ value: quoted ? cell : cell.trim(), quoted });
    cell = '';
    quoted = false;
  };
  const endRow = () => {
    const isBlankLine = row.length === 1 && !row[0].quoted && row[0].value === '';
    if (!isBlankLine) {
      records.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch !== '"') {
        cell += ch;
      } else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (ch === '"' && !quoted && cell.trim() === '') {
      inQuotes = true;
      quoted = true;
      cell = '';
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\r' || ch === '\n') {
      endCell();
      endRow();
      if (ch === '\r' && text[i + 1] === '\n') {
        i++;
      }
    } else if (!(quoted && isWhitespace(ch))) {
      cell += ch;
    }
  }

  if (inQuotes) {
    throw new Error('CSV has an unclosed quote');
  }
  if (cell !== '' || quoted || row.length) {
    endCell();
    endRow();
  }

  return records;
};

// Like newman, unquoted numbers become numbers; unlike newman, only when nothing is lost (`007`, `1.50` stay strings).
const castCell = ({ value, quoted }: T_CsvCell): unknown => {
  if (quoted || value === '') {
    return value;
  }
  const number = Number(value);
  return Number.isFinite(number) && String(number) === value ? number : value;
};

const parseCsv = (text: string): T_IterationRow[] => {
  const [header, ...records] = readCsvRecords(text);
  if (!header) {
    return [];
  }

  const columns = header.map((cell) => cell.value);
  columns.forEach((column, index) => {
    if (column === '') {
      throw new Error(`CSV header has an empty column name (column ${index + 1})`);
    }
    if (columns.indexOf(column) !== index) {
      throw new Error(`CSV header has a duplicate column "${column}"`);
    }
  });

  return records.map((record) =>
    Object.fromEntries(columns.map((column, index) => [column, record[index] ? castCell(record[index]) : '']))
  );
};

const isPlainObject = (value: unknown): value is T_IterationRow =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJson = (text: string): T_IterationRow[] => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`JSON data file is not valid JSON: ${(error as Error).message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error('JSON data file must be an array of objects');
  }
  data.forEach((row, index) => {
    if (!isPlainObject(row)) {
      throw new Error(`JSON data file must be an array of objects (row ${index + 1} is not an object)`);
    }
  });
  return data;
};

export const parseIterationData = (text: string, fileName: string): T_IterationRow[] => {
  const extension = fileName.toLowerCase().split('.').pop();
  let rows: T_IterationRow[];
  if (extension === 'csv') {
    rows = parseCsv(stripBom(text));
  } else if (extension === 'json') {
    rows = parseJson(stripBom(text).trim());
  } else {
    throw new Error('Data file must be a .csv or .json file');
  }

  if (!rows.length) {
    throw new Error('Data file has no data rows');
  }
  return rows;
};

// Past the last row Postman keeps using the last row (postman-runtime getIterationData).
export const getIterationRow = (rows: T_IterationRow[], index: number): T_IterationRow =>
  rows.length ? rows[Math.min(index, rows.length - 1)] : {};

export const resolveIterationCount = (rows: T_IterationRow[], requested?: number | null): number => {
  if (requested === null || requested === undefined) {
    return rows.length || 1;
  }
  if (!Number.isInteger(requested) || requested < 1) {
    throw new Error('Iteration count must be a positive whole number');
  }
  return requested;
};

// Where a runner goes after a request: the jump target, the end of the iteration
// (`setNextRequest(null)` ends only the current iteration, as in postman-runtime), or the
// next request; past the last request it starts the next iteration. A returned
// `requestIndex` equal to `requestCount` means the run is over.
export const nextRunnerPosition = ({
  requestIndex,
  requestCount,
  iterationIndex,
  iterationCount,
  nextRequestIndex
}: {
  requestIndex: number;
  requestCount: number;
  iterationIndex: number;
  iterationCount: number;
  nextRequestIndex?: number | null;
}): { requestIndex: number; iterationIndex: number } => {
  const next = nextRequestIndex === null ? requestCount : nextRequestIndex ?? requestIndex + 1;
  if (next < requestCount) {
    return { requestIndex: next, iterationIndex };
  }
  if (iterationIndex + 1 < iterationCount) {
    return { requestIndex: 0, iterationIndex: iterationIndex + 1 };
  }
  return { requestIndex: requestCount, iterationIndex };
};
