import type { Prisma } from '@prisma/client';
import { TaskPriority, UserRole } from '@prisma/client';
import type { TaskStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { pagination, paginationMeta } from '../../common/http/pagination';
import { recordActivity } from '../../common/activity/activity.service';
import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from './tasks.schema';

function taskDate(value: string | null | undefined) {
  return value === undefined ? undefined : value === null ? null : new Date(value);
}

function taskAccessWhere(taskId: string, userId: string, role: UserRole): Prisma.TaskWhereInput {
  return {
    id: taskId,
    ...(role === UserRole.MEMBER ? { project: { members: { some: { userId } } } } : {}),
  };
}

async function getAccessibleTask(taskId: string, userId: string, role: UserRole) {
  const task = await prisma.task.findFirst({ where: taskAccessWhere(taskId, userId, role) });
  if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found.');
  return task;
}

export async function list(
  projectId: string,
  query: TaskListQuery,
  userId: string,
  role: UserRole,
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(role === UserRole.MEMBER ? { members: { some: { userId } } } : {}),
    },
    select: { id: true },
  });
  if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
  const where: Prisma.TaskWhereInput = {
    projectId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
  };
  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      ...pagination(query.page, query.perPage),
      orderBy: { [query.sortBy]: query.sortOrder },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);
  return { data: tasks, meta: paginationMeta(query.page, query.perPage, total) };
}

export async function get(taskId: string, userId: string, role: UserRole) {
  const task = await prisma.task.findFirst({
    where: taskAccessWhere(taskId, userId, role),
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, clientId: true } },
    },
  });
  if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found.');
  return task;
}

async function ensureAssignee(
  projectId: string,
  assigneeId: string | null | undefined,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (assigneeId == null) return;
  const membership = await client.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    select: { userId: true },
  });
  if (!membership)
    throw new AppError(409, 'INVALID_ASSIGNEE', 'The assignee must be a member of the project.');
}

export async function create(
  projectId: string,
  input: CreateTaskInput,
  actorId: string,
  role: UserRole,
) {
  if (role === UserRole.MEMBER && input.assigneeId && input.assigneeId !== actorId) {
    throw new AppError(403, 'FORBIDDEN', 'Members may only assign tasks to themselves.');
  }
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      const membership =
        role === UserRole.MEMBER
          ? await tx.projectMember.findUnique({
              where: { projectId_userId: { projectId, userId: actorId } },
              select: { userId: true },
            })
          : true;
      if (!project || !membership) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
      await ensureAssignee(projectId, input.assigneeId, tx);
      const task = await tx.task.create({
        data: {
          projectId,
          createdByUserId: actorId,
          title: input.title,
          description: input.description,
          priority: input.priority ?? TaskPriority.MEDIUM,
          dueDate: taskDate(input.dueDate),
          assigneeId: input.assigneeId,
        },
      });
      await recordActivity(
        {
          actorUserId: actorId,
          projectId,
          action: 'TASK_CREATED',
          targetType: 'Task',
          targetId: task.id,
        },
        tx,
      );
      return task;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function update(
  taskId: string,
  input: UpdateTaskInput,
  actorId: string,
  role: UserRole,
) {
  const task = await getAccessibleTask(taskId, actorId, role);
  if (role === UserRole.MEMBER && task.createdByUserId !== actorId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the task creator can edit task details.');
  }
  if (input.assigneeId !== undefined) {
    if (role === UserRole.MEMBER && input.assigneeId !== null && input.assigneeId !== actorId) {
      throw new AppError(403, 'FORBIDDEN', 'Members may only assign tasks to themselves.');
    }
  }
  const data: Prisma.TaskUpdateInput = {
    ...input,
    ...(input.dueDate === undefined ? {} : { dueDate: taskDate(input.dueDate) }),
  };
  return prisma.$transaction(
    async (tx) => {
      if (input.assigneeId !== undefined) {
        await ensureAssignee(task.projectId, input.assigneeId, tx);
      }
      const updated = await tx.task.update({ where: { id: taskId }, data });
      await recordActivity(
        {
          actorUserId: actorId,
          projectId: task.projectId,
          action: input.assigneeId === undefined ? 'TASK_UPDATED' : 'TASK_ASSIGNED',
          targetType: 'Task',
          targetId: taskId,
          ...(input.assigneeId === undefined ? {} : { metadata: { assigneeId: input.assigneeId } }),
        },
        tx,
      );
      return updated;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function assign(taskId: string, assigneeId: string | null, actorId: string) {
  const task = await getAccessibleTask(taskId, actorId, UserRole.MANAGER);
  return prisma.$transaction(
    async (tx) => {
      await ensureAssignee(task.projectId, assigneeId, tx);
      const updated = await tx.task.update({ where: { id: taskId }, data: { assigneeId } });
      await recordActivity(
        {
          actorUserId: actorId,
          projectId: task.projectId,
          action: 'TASK_ASSIGNED',
          targetType: 'Task',
          targetId: taskId,
          metadata: { assigneeId },
        },
        tx,
      );
      return updated;
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function updateStatus(
  taskId: string,
  status: TaskStatus,
  actorId: string,
  role: UserRole,
) {
  const task = await getAccessibleTask(taskId, actorId, role);
  if (role === UserRole.MEMBER && task.assigneeId !== actorId && task.createdByUserId !== actorId) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Only the assignee or task creator can change task status.',
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: taskId }, data: { status } });
    await recordActivity(
      {
        actorUserId: actorId,
        projectId: task.projectId,
        action: 'TASK_STATUS_CHANGED',
        targetType: 'Task',
        targetId: taskId,
        metadata: { status },
      },
      tx,
    );
    return updated;
  });
}
