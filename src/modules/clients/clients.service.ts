import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { pagination, paginationMeta } from '../../common/http/pagination';
import { recordActivity } from '../../common/activity/activity.service';
import type { ClientFields } from './clients.schema';

type ClientList = {
  page: number;
  perPage: number;
  search?: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
};

export async function list(input: ClientList, userId: string, role: UserRole) {
  const where: Prisma.ClientWhereInput = {
    ...(input.search ? { name: { contains: input.search, mode: 'insensitive' } } : {}),
    ...(role === UserRole.MEMBER ? { projects: { some: { members: { some: { userId } } } } } : {}),
  };
  const [clients, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      ...pagination(input.page, input.perPage),
      orderBy: { [input.sortBy]: input.sortOrder },
    }),
    prisma.client.count({ where }),
  ]);
  return { data: clients, meta: paginationMeta(input.page, input.perPage, total) };
}

export async function get(clientId: string, userId: string, role: UserRole) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      ...(role === UserRole.MEMBER
        ? { projects: { some: { members: { some: { userId } } } } }
        : {}),
    },
  });
  if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
  return client;
}

export async function create(data: ClientFields, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data });
    await recordActivity(
      { actorUserId: actorId, action: 'CLIENT_CREATED', targetType: 'Client', targetId: client.id },
      tx,
    );
    return client;
  });
}

export async function update(clientId: string, data: Partial<ClientFields>, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: clientId } });
    if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
    const updated = await tx.client.update({ where: { id: clientId }, data });
    await recordActivity(
      { actorUserId: actorId, action: 'CLIENT_UPDATED', targetType: 'Client', targetId: clientId },
      tx,
    );
    return updated;
  });
}

export async function remove(clientId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, _count: { select: { projects: true } } },
    });
    if (!client) throw new AppError(404, 'NOT_FOUND', 'Client not found.');
    if (client._count.projects > 0) {
      throw new AppError(409, 'CLIENT_HAS_PROJECTS', 'A client with projects cannot be deleted.');
    }
    await tx.client.delete({ where: { id: clientId } });
    await recordActivity(
      { actorUserId: actorId, action: 'CLIENT_DELETED', targetType: 'Client', targetId: clientId },
      tx,
    );
  });
}
