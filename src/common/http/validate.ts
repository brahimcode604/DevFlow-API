import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error';

export type RequestInput = {
  body?: unknown;
  params?: unknown;
  query?: unknown;
};

export function validate(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const input = {
      body: req.body ?? {},
      params: req.params,
      query: req.query,
    };
    const parsed = schema.parse(input);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new AppError(
        500,
        'INVALID_VALIDATION_SCHEMA',
        'Request validation configuration is invalid.',
      );
    }
    const parsedRecord = parsed as Record<string, unknown>;
    const unrecognized = (['body', 'params', 'query'] as const).flatMap((section) => {
      const rawValue = input[section];
      const parsedValue = parsedRecord[section];
      if (
        typeof rawValue !== 'object' ||
        rawValue === null ||
        typeof parsedValue !== 'object' ||
        parsedValue === null
      ) {
        return [];
      }
      const keys = Object.keys(rawValue).filter((key) => !Object.hasOwn(parsedValue, key));
      return keys.length ? [{ path: section, keys, code: 'unrecognized_keys' }] : [];
    });
    if (unrecognized.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', unrecognized);
    }
    res.locals.input = parsedRecord;
    next();
  };
}

export function getInput<T>(res: Response): T {
  return res.locals.input as T;
}
