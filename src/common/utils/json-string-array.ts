import { ValueTransformer } from 'typeorm';

/** TEXT column storage for string[]; tolerates legacy empty/invalid JSON in DB. */
export const jsonStringArrayTransformer: ValueTransformer = {
  from(value: unknown): string[] {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value as string[];
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  },
  to(value: string[] | null | undefined): string {
    return JSON.stringify(value ?? []);
  },
};
