import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import type { ProjectStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { pagination, paginationMeta } from '../../common/http/pagination';
import { recordActivity } from '../../common/activity/activity.service';
import type { ProjectFields } from './projects.schema';

type ListInput = {
  page: number;
  perPage: number;
  clientId?: string;
  status?: ProjectStatus;
  sortBy: 'name' | 'createdAt' | 'dueDate' | 'status';
  sortOrder: 'asc' | 'desc';
};

function projectUpdateData(input: Partial<ProjectFields>): Prisma.ProjectUncheckedUpdateInput {
  return {
    ...input,
    ...(input.startDate === undefined
      ? {}
      : { startDate: input.startDate ? new Date(input.startDate) : null }),
    ...(input.dueDate === undefined
      ? {}
      : { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
  };
}

function accessibleProjectWhere(
  projectId: string,
  userId: string,
  role: UserRole,
): Prisma.ProjectWhereInput {
  return {
    id: projectId,
    ...(role === UserRole.MEMBER ? { members: { some: { userId } } } : {}),
  };
}

export async function ensureAccess(projectId: string, userId: string, role: UserRole) {
  const project = await prisma.project.findFirst({
    where: accessibleProjectWhere(projectId, userId, role),
    select: { id: true, clientId: true, name: true },
  });
  if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
  return project;
}

export async function list(input: ListInput, userId: string, role: UserRole) {
  const where: Prisma.ProjectWhereInput = {
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(role === UserRole.MEMBER ? { members: { some: { userId } } } : {}),
  };
  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      ...pagination(input.page, input.perPage),
      orderBy: { [input.sortBy]: input.sortOrder },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { members: true, tasks: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);
  return { data: projects, meta: paginationMeta(input.page, input.perPage, total) };
}

export async function get(projectId: string, userId: string, role: UserRole) {
  const project = await prisma.project.findFirst({
    where: accessibleProjectWhere(projectId, userId, role),
    include: { client: true, _count: { select: { members: true, tasks: true } } },
  });
  if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
  return project;
}

export async function create(input: ProjectFields, actorId: string) {
  if (input.startDate && input.dueDate && input.dueDate < input.startDate) {
    throw new AppError(400, 'INVALID_DATE_RANGE', 'Project dueDate must not precede startDate.');
  }
  const client = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: { id: true },
  });
  if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId: input.clientId,
        name: input.name,
        description: input.description,
        status: input.status,
        startDate: input.startDate ? new Date(input.startDate) : null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
    });
    await recordActivity(
      {
        actorUserId: actorId,
        projectId: project.id,
        action: 'PROJECT_CREATED',
        targetType: 'Project',
        targetId: project.id,
      },
      tx,
    );
    return project;
  });
}

export async function update(projectId: string, input: Partial<ProjectFields>, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.project.findUnique({ where: { id: projectId } });
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
    if (input.clientId && input.clientId !== current.clientId) {
      const client = await tx.client.findUnique({
        where: { id: input.clientId },
        select: { id: true },
      });
      if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
    }
    const start =
      input.startDate === undefined
        ? current.startDate
        : input.startDate
          ? new Date(input.startDate)
          : null;
    const due =
      input.dueDate === undefined
        ? current.dueDate
        : input.dueDate
          ? new Date(input.dueDate)
          : null;
    if (start && due && due < start) {
      throw new AppError(400, 'INVALID_DATE_RANGE', 'Project dueDate must not precede startDate.');
    }
    const updated = await tx.project.update({
      where: { id: projectId },
      data: projectUpdateData(input),
    });
    await recordActivity(
      {
        actorUserId: actorId,
        projectId,
        action: 'PROJECT_UPDATED',
        targetType: 'Project',
        targetId: projectId,
      },
      tx,
    );
    return updated;
  });
}

export async function remove(projectId: string, actorId: string) {
  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
    await recordActivity(
      {
        actorUserId: actorId,
        projectId,
        action: 'PROJECT_DELETED',
        targetType: 'Project',
        targetId: projectId,
      },
      tx,
    );
    await tx.project.delete({ where: { id: projectId } });
  });
}

export async function listMembers(
  projectId: string,
  page: number,
  perPage: number,
  userId: string,
  role: UserRole,
) {
  await ensureAccess(projectId, userId, role);
  const where = { projectId };
  const [members, total] = await prisma.$transaction([
    prisma.projectMember.findMany({
      where,
      ...pagination(page, perPage),
      orderBy: { joinedAt: 'asc' },
      select: {
        projectId: true,
        userId: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.projectMember.count({ where }),
  ]);
  return { data: members, meta: paginationMeta(page, perPage, total) };
}

export async function addMember(projectId: string, userId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true } });
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!project) throw new AppError(404, 'NOT_FOUND', 'Project not found.');
    if (!user?.isActive) throw new AppError(404, 'NOT_FOUND', 'Active user not found.');
    const membership = await tx.projectMember.create({ data: { projectId, userId } });
    await recordActivity(
      {
        actorUserId: actorId,
        projectId,
        action: 'PROJECT_MEMBER_ADDED',
        targetType: 'ProjectMember',
        targetId: userId,
        metadata: { userId },
      },
      tx,
    );
    return membership;
  });
}

export async function removeMember(projectId: string, userId: string, actorId: string) {
  await prisma.$transaction(
    async (tx) => {
      const membership = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });
      if (!membership) throw new AppError(404, 'NOT_FOUND', 'Project membership not found.');
      const assigned = await tx.task.count({ where: { projectId, assigneeId: userId } });
      if (assigned > 0) {
        throw new AppError(
          409,
          'MEMBER_HAS_ASSIGNED_TASKS',
          'Reassign the member’s tasks before removing them.',
        );
      }
      await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
      await recordActivity(
        {
          actorUserId: actorId,
          projectId,
          action: 'PROJECT_MEMBER_REMOVED',
          targetType: 'ProjectMember',
          targetId: userId,
          metadata: { userId },
        },
        tx,
      );
    },
    { isolationLevel: 'Serializable' },
  );
}
