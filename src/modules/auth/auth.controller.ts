import type { RequestHandler } from 'express';
import { getInput } from '../../common/http/validate';
import type { LoginInput, RegisterInput } from './auth.schema';
import * as service from './auth.service';

export const register: RequestHandler = async (_req, res) => {
  const { body } = getInput<{ body: RegisterInput }>(res);
  res.status(201).json({ data: await service.register(body) });
};

export const login: RequestHandler = async (_req, res) => {
  const { body } = getInput<{ body: LoginInput }>(res);
  res.status(200).json({ data: await service.login(body) });
};
