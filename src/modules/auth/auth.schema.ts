import { z } from 'zod';

export const registerSchema = z
  .object({
    body: z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(12).max(128),
        name: z.string().trim().min(2).max(100),
      })
      .strict(),
    params: z.object({}),
    query: z.object({}),
  })
  .strict();

export const loginSchema = z
  .object({
    body: z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(1).max(128),
      })
      .strict(),
    params: z.object({}),
    query: z.object({}),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
