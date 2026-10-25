import { describe, expect, it } from 'vitest';
import { pagination, paginationMeta, paginationSchema } from '../../src/common/http/pagination';

describe('pagination', () => {
  it('calculates skip/take and response metadata', () => {
    expect(pagination(3, 25)).toEqual({ skip: 50, take: 25 });
    expect(paginationMeta(2, 20, 41)).toEqual({ page: 2, perPage: 20, total: 41, totalPages: 3 });
  });

  it('uses defaults and rejects unsafe page sizes', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, perPage: 20 });
    expect(() => paginationSchema.parse({ page: '0', perPage: '101' })).toThrow();
  });
});
