import { z } from 'zod';

// Building blocks shared by all DTOs (PLAN.md §10). Wire format is snake_case
// JSON, timestamps are ISO-8601 strings (UTC), money is integer paise.

export const uuidSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const paiseSchema = z.int().nonnegative();

/** Optional free-text field: absent, null, or a trimmed string. */
export const optionalTextSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional();
