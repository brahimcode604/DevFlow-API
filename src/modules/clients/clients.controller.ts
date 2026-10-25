import type { RequestHandler } from 'express';
import { getInput } from '../../common/http/validate';
import type { ClientFields } from './clients.schema';
import * as service from './clients.service';

export const list: RequestHandler = async (req, res) => {
  const { query } = getInput<{ query: Parameters<typeof service.list>[0] }>(res);
  res.status(200).json(await service.list(query, req.user!.id, req.user!.role));
};

export const get: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { clientId: string } }>(res);
  res.status(200).json({ data: await service.get(params.clientId, req.user!.id, req.user!.role) });
};

export const create: RequestHandler = async (req, res) => {
  const { body } = getInput<{ body: ClientFields }>(res);
  res.status(201).json({ data: await service.create(body, req.user!.id) });
};

export const update: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { clientId: string }; body: Partial<ClientFields> }>(
    res,
  );
  res.status(200).json({ data: await service.update(params.clientId, body, req.user!.id) });
};

export const remove: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { clientId: string } }>(res);
  await service.remove(params.clientId, req.user!.id);
  res.status(204).end();
};
