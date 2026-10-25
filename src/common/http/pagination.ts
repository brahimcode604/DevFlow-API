import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export function pagination(page: number, perPage: number) {
  return { skip: (page - 1) * perPage, take: perPage };
}

export function paginationMeta(page: number, perPage: number, total: number) {
  return { page, perPage, total, totalPages: Math.ceil(total / perPage) };
}
