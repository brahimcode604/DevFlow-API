import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';

type ActivityArgs = {
  actorUserId?: string;
  projectId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordActivity(
  data: ActivityArgs,
  client: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<void> {
  await client.activityLog.create({
    data: {
      actorUserId: data.actorUserId,
      projectId: data.projectId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata ?? {},
    },
  });
}
