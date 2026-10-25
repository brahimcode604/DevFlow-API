import type { RequestHandler } from 'express';
import { getInput } from '../../common/http/validate';
import type { UserRole } from '@prisma/client';
import * as service from './users.service';

export const me: RequestHandler = async (req, res) => {
  res.status(200).json({ data: await service.getMe(req.user!.id) });
};

export const list: RequestHandler = async (_req, res) => {
  const { query } = getInput<{
    query: { page: number; perPage: number; role?: UserRole; isActive?: 'true' | 'false' };
  }>(res);
  res
    .status(200)
    .json(
      await service.listUsers(
        query.page,
        query.perPage,
        query.role,
        query.isActive === undefined ? undefined : query.isActive === 'true',
      ),
    );
};

export const updateRole: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { userId: string }; body: { role: UserRole } }>(res);
  res.status(200).json({ data: await service.updateRole(params.userId, body.role, req.user!.id) });
};
