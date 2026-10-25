import { TaskPriority, TaskStatus } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../common/http/pagination';

const taskFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  dueDate: z.string().date().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
};

export const listTasksSchema = z
  .object({
    body: z.object({}),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: paginationSchema
      .extend({
        status: z.nativeEnum(TaskStatus).optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        assigneeId: z.string().uuid().optional(),
        sortBy: z
          .enum(['createdAt', 'dueDate', 'priority', 'status', 'title'])
          .default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc'),
      })
      .strict(),
  })
  .strict();

export const createTaskSchema = z
  .object({
    body: z.object(taskFields).strict(),
    params: z.object({ projectId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const taskIdSchema = z
  .object({
    body: z.object({}),
    params: z.object({ taskId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    body: z
      .object(taskFields)
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0),
    params: z.object({ taskId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const updateAssigneeSchema = z
  .object({
    body: z.object({ assigneeId: z.string().uuid().nullable() }).strict(),
    params: z.object({ taskId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export const updateStatusSchema = z
  .object({
    body: z.object({ status: z.nativeEnum(TaskStatus) }).strict(),
    params: z.object({ taskId: z.string().uuid() }).strict(),
    query: z.object({}),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>['body'];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>['body'];
export type TaskListQuery = z.infer<typeof listTasksSchema>['query'];
export type TaskRole = UserRole;
