import { z } from 'zod';

export const overviewSchema = z
  .object({
    body: z.object({}).strict(),
    params: z.object({}).strict(),
    query: z
      .object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
      })
      .strict()
      .refine((query) => !query.from || !query.to || query.from <= query.to, {
        message: 'from must not be later than to.',
        path: ['from'],
      }),
  })
  .strict();

export type OverviewQuery = z.infer<typeof overviewSchema>['query'];
