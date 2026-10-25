import type { RequestHandler } from 'express';
import type { TaskStatus } from '@prisma/client';
import { getInput } from '../../common/http/validate';
import type { CreateTaskInput, TaskListQuery, UpdateTaskInput } from './tasks.schema';
import * as service from './tasks.service';

export const list: RequestHandler = async (req, res) => {
  const { params, query } = getInput<{ params: { projectId: string }; query: TaskListQuery }>(res);
  res.status(200).json(await service.list(params.projectId, query, req.user!.id, req.user!.role));
};

export const get: RequestHandler = async (req, res) => {
  const { params } = getInput<{ params: { taskId: string } }>(res);
  res.status(200).json({ data: await service.get(params.taskId, req.user!.id, req.user!.role) });
};

export const create: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { projectId: string }; body: CreateTaskInput }>(res);
  res
    .status(201)
    .json({ data: await service.create(params.projectId, body, req.user!.id, req.user!.role) });
};

export const update: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { taskId: string }; body: UpdateTaskInput }>(res);
  res
    .status(200)
    .json({ data: await service.update(params.taskId, body, req.user!.id, req.user!.role) });
};

export const assign: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{
    params: { taskId: string };
    body: { assigneeId: string | null };
  }>(res);
  res
    .status(200)
    .json({ data: await service.assign(params.taskId, body.assigneeId, req.user!.id) });
};

export const updateStatus: RequestHandler = async (req, res) => {
  const { params, body } = getInput<{ params: { taskId: string }; body: { status: TaskStatus } }>(
    res,
  );
  res.status(200).json({
    data: await service.updateStatus(params.taskId, body.status, req.user!.id, req.user!.role),
  });
};
