import { ProjectStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../common/http/pagination';

const dateField = z.string().date().optional().nullable();
const projectFields = {
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(150),
  description: z.string().max(5000).nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: dateField,
  dueDate: dateField,
};

export const listProjectsSchema = z
  .object({
    body: z.object({}),
    params: z.object({}),
    query: paginationSchema
      .extend({
        clientId: z.string().uuid().optional(),
        status: z.nativeEnum(ProjectStatus).optional(),
        sortBy: z.enum(['name', 'createdAt', 'dueDate', 'status']).default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
      .strict(),
  })
  .strict();

export const createProjectSchema = z
  .object({
    body: z
      .object(projectFields)
      .strict()
      .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
        message: 'dueDate must not precede startDate.',
        path: ['dueDate'],
      }),
    params: z.object({}),
    query: z.object({}),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    body: z
      .object(projectFields)
      .partial()
      .strict()
      .refine((v) => Object.keys(v).length > 0),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const projectIdSchema = z
  .object({
    body: z.object({}),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const addMemberSchema = z
  .object({
    body: z.object({ userId: z.string().uuid() }).strict(),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const removeMemberSchema = z
  .object({
    body: z.object({}),
    params: z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const listMembersSchema = z
  .object({
    body: z.object({}),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: paginationSchema.strict(),
  })
  .strict();

export type ProjectFields = z.infer<typeof createProjectSchema>['body'];
