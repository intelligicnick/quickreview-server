import { Types } from 'mysql2';

type MysqlField = {
  type: string;
  columnType: number;
  name: string;
  string: (encoding?: string) => string | null;
};

/** mysql2 JSON.parse on empty/invalid values throws before TypeORM can run. */
export function safeMysqlTypeCast(field: MysqlField, next: () => unknown): unknown {
  const isJson = field.type === 'JSON' || field.columnType === Types.JSON;
  if (!isJson) return next();

  const raw = field.string('utf8');
  if (raw == null || raw === '') {
    return field.name === 'businessSubcategories' ? [] : null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return field.name === 'businessSubcategories' ? [] : null;
  }
}
