import type { RequestHandler } from 'express';
import { getInput } from '../../common/http/validate';
import type { ProjectFields } from './projects.schema';
import * as service from './projects.service';

export const list: RequestHandler = async (req, res) => {
  const { query } = getInput<{ query: Parameters<typeof service.list>[0] }>(res);
  res.status(200).json(await service.list(query, req.user!.id, req.user!.role));
};

export const get: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { projectId: string } }>(res);
  res.status(200).json({ data: await service.get(params.projectId, req.user!.id, req.user!.role) });
};

export const create: RequestHandler = async (req, res) => {
  const { body } = getInput<{ body: ProjectFields }>(res);
  res.status(201).json({ data: await service.create(body, req.user!.id) });
};

export const update: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{
    params: { projectId: string };
    body: Partial<ProjectFields>;
  }>(res);
  res.status(200).json({ data: await service.update(params.projectId, body, req.user!.id) });
};

export const remove: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { projectId: string } }>(res);
  await service.remove(params.projectId, req.user!.id);
  res.status(204).end();
};

export const listMembers: RequestHandler = async (req, res) => {
  const { params, query } = getInput<{
    params: { projectId: string };
    query: { page: number; perPage: number };
  }>(res);
  res
    .status(200)
    .json(
      await service.listMembers(
        params.projectId,
        query.page,
        query.perPage,
        req.user!.id,
        req.user!.role,
      ),
    );
};

export const addMember: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { projectId: string }; body: { userId: string } }>(
    res,
  );
  res
    .status(201)
    .json({ data: await service.addMember(params.projectId, body.userId, req.user!.id) });
};

export const removeMember: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { projectId: string; userId: string } }>(res);
  await service.removeMember(params.projectId, params.userId, req.user!.id);
  res.status(204).end();
};
