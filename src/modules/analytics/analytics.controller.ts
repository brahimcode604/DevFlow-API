import type { RequestHandler } from 'express';
import { TaskStatus, UserRole } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { getInput } from '../../common/http/validate';
import type { OverviewQuery } from './analytics.schema';

export const overview: RequestHandler = async (req, res) => {
  const { query } = getInput<{ query: OverviewQuery }>(res);
  const createdAt = {
    ...(query.from ? { gte: new Date(query.from) } : {}),
    ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
  };
  const projectScope =
    req.user!.role === UserRole.MEMBER ? { members: { some: { userId: req.user!.id } } } : {};
  const projectWhere = { ...projectScope, ...(Object.keys(createdAt).length ? { createdAt } : {}) };
  const taskWhere = {
    project: projectScope,
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
  };
  const [projects, tasks, tasksByStatus, overdueTasks] = await Promise.all([
    prisma.project.count({ where: projectWhere }),
    prisma.task.count({ where: taskWhere }),
    prisma.task.groupBy({ by: ['status'], where: taskWhere, _count: { _all: true } }),
    prisma.task.count({
      where: {
        ...taskWhere,
        dueDate: { lt: new Date(new Date().toISOString().slice(0, 10)) },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      },
    }),
  ]);
  res.status(200).json({
    data: {
      projects,
      tasks,
      overdueTasks,
      tasksByStatus: Object.fromEntries(
        tasksByStatus.map(({ status, _count }) => [status, _count._all]),
      ),
    },
  });
};
