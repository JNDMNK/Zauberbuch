import type { ZodType, ZodTypeDef } from 'zod';
import { badRequest } from './errors';

/** Validiert Eingaben und wirft bei Fehlern einen 400 mit den zod-Issues. */
export function validate<T>(schema: ZodType<T, ZodTypeDef, unknown>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'validation_error',
      'Invalid input',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
