import { UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../common/errors/app-error';
import { pagination, paginationMeta } from '../../common/http/pagination';
import { recordActivity } from '../../common/activity/activity.service';

export async function listUsers(
  page: number,
  perPage: number,
  role?: UserRole,
  isActive?: boolean,
) {
  const where = { ...(role ? { role } : {}), ...(isActive === undefined ? {} : { isActive }) };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      ...pagination(page, perPage),
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ]);
  return { data: users, meta: paginationMeta(page, perPage, total) };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  return user;
}

export async function updateRole(userId: string, role: UserRole, actorId: string) {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
      if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
        const adminCount = await tx.user.count({ where: { role: UserRole.ADMIN, isActive: true } });
        if (adminCount <= 1) {
          throw new AppError(
            409,
            'LAST_ADMIN_PROTECTION',
            'At least one active administrator must remain.',
          );
        }
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, email: true, name: true, role: true, isActive: true, updatedAt: true },
      });
      await recordActivity(
        {
          actorUserId: actorId,
          action: 'USER_ROLE_CHANGED',
          targetType: 'User',
          targetId: userId,
          metadata: { role },
        },
        tx,
      );
      return updated;
    },
    { isolationLevel: 'Serializable' },
  );
}
