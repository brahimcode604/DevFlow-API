import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';

const app = createApp();
const suffix = randomUUID();
const email = `admin-${suffix}@example.test`;
let token = '';
let managerToken = '';
let memberId = '';
let accessibleClientId = '';
let inaccessibleClientId = '';
let projectId = '';
let otherProjectId = '';
let inaccessibleTaskId = '';

beforeAll(async () => {
  await prisma.$connect();
  const passwordHash = await bcrypt.hash('test-password-with-12-chars', 4);
  const member = await prisma.user.create({
    data: { email, name: 'Test Member', role: UserRole.MEMBER, passwordHash },
  });
  memberId = member.id;
  const managerEmail = `manager-${suffix}@example.test`;
  await prisma.user.create({
    data: {
      email: managerEmail,
      name: 'Test Manager',
      role: UserRole.MANAGER,
      passwordHash,
    },
  });
  const client = await prisma.client.create({ data: { name: `Test Client ${suffix}` } });
  const otherClient = await prisma.client.create({ data: { name: `Other Client ${suffix}` } });
  accessibleClientId = client.id;
  inaccessibleClientId = otherClient.id;
  const project = await prisma.project.create({
    data: { clientId: client.id, name: `Project ${suffix}` },
  });
  const otherProject = await prisma.project.create({
    data: { clientId: otherClient.id, name: `Other ${suffix}` },
  });
  projectId = project.id;
  otherProjectId = otherProject.id;
  await prisma.projectMember.create({ data: { projectId: project.id, userId: member.id } });
  const inaccessibleTask = await prisma.task.create({
    data: {
      projectId: otherProject.id,
      createdByUserId: member.id,
      title: `Private task ${suffix}`,
    },
  });
  inaccessibleTaskId = inaccessibleTask.id;
  const login = await request(app).post('/api/v1/auth/login').send({
    email,
    password: 'test-password-with-12-chars',
  });
  token = login.body.data.accessToken as string;
  const managerLogin = await request(app).post('/api/v1/auth/login').send({
    email: managerEmail,
    password: 'test-password-with-12-chars',
  });
  managerToken = managerLogin.body.data.accessToken as string;
});

afterAll(async () => {
  await prisma.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.activityLog.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.projectMember.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await prisma.client.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.user.deleteMany({ where: { email: `manager-${suffix}@example.test` } });
  await prisma.$disconnect();
});

describe('HTTP API', () => {
  it('registers a member without returning or storing a plaintext password', async () => {
    const registrationEmail = `member-${randomUUID()}@example.test`;
    const response = await request(app).post('/api/v1/auth/register').send({
      email: registrationEmail,
      password: 'member-password-secure',
      name: 'Test Member',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('MEMBER');
    expect(response.body.data.user.passwordHash).toBeUndefined();
    const stored = await prisma.user.findUnique({ where: { email: registrationEmail } });
    expect(stored?.passwordHash).not.toBe('member-password-secure');
    await prisma.user.delete({ where: { email: registrationEmail } });
  });

  it('rejects role escalation and unknown registration fields', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `elevated-${randomUUID()}@example.test`,
        password: 'member-password-secure',
        name: 'Attempted Admin',
        role: 'ADMIN',
      });
    expect(response.status).toBe(400);
  });

  it('rejects duplicate registration and invalid pagination', async () => {
    const duplicate = await request(app).post('/api/v1/auth/register').send({
      email,
      password: 'different-password-123',
      name: 'Duplicate User',
    });
    expect(duplicate.status).toBe(409);

    const invalid = await request(app)
      .get('/api/v1/clients?page=0&perPage=200')
      .set('Authorization', `Bearer ${token}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const unknownFilter = await request(app)
      .get('/api/v1/analytics/overview?unexpected=true')
      .set('Authorization', `Bearer ${token}`);
    expect(unknownFilter.status).toBe(400);

    const invalidId = await request(app)
      .get('/api/v1/projects/not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(invalidId.status).toBe(400);
  });

  it('rejects assignment to a user who is not a member of the task project', async () => {
    const response = await request(app)
      .patch(`/api/v1/tasks/${inaccessibleTaskId}/assignee`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ assigneeId: memberId });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_ASSIGNEE');
  });

  it('prevents a user from reading a project outside their membership', async () => {
    const response = await request(app)
      .get(`/api/v1/projects/${otherProjectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);

    const task = await request(app)
      .get(`/api/v1/tasks/${inaccessibleTaskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(task.status).toBe(404);
  });

  it('rejects unauthenticated access and returns the caller profile', async () => {
    const unauthorized = await request(app).get('/api/v1/users/me');
    expect(unauthorized.status).toBe(401);

    const profile = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);
  });

  it('reports API and database readiness', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ status: 'ok', database: 'ok' });
  });

  it('serves the OpenAPI contract', async () => {
    const response = await request(app).get('/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.3');
    expect(response.body.paths['/projects/{projectId}/tasks']).toBeDefined();
    expect(response.body.components.schemas.PaginatedResponse).toBeDefined();
  });

  it('scopes member client reads and rejects member writes', async () => {
    const list = await request(app).get('/api/v1/clients').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((client: { id: string }) => client.id)).toContain(accessibleClientId);
    expect(list.body.data.map((client: { id: string }) => client.id)).not.toContain(
      inaccessibleClientId,
    );

    const create = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized client' });
    expect(create.status).toBe(403);
  });

  it('supports manager client and project operations', async () => {
    const clientResponse = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: `CRUD Client ${suffix}` });
    expect(clientResponse.status).toBe(201);
    const clientId = clientResponse.body.data.id as string;

    const clientUpdate = await request(app)
      .patch(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: `Updated Client ${suffix}` });
    expect(clientUpdate.status).toBe(200);

    const projectResponse = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ clientId, name: `CRUD Project ${suffix}` });
    expect(projectResponse.status).toBe(201);
    const newProjectId = projectResponse.body.data.id as string;

    const addMember = await request(app)
      .post(`/api/v1/projects/${newProjectId}/members`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ userId: memberId });
    expect(addMember.status).toBe(201);

    const members = await request(app)
      .get(`/api/v1/projects/${newProjectId}/members`)
      .set('Authorization', `Bearer ${token}`);
    expect(members.status).toBe(200);
    expect(members.body.data).toHaveLength(1);

    const projectUpdate = await request(app)
      .patch(`/api/v1/projects/${newProjectId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'ACTIVE' });
    expect(projectUpdate.status).toBe(200);

    const projectDelete = await request(app)
      .delete(`/api/v1/projects/${newProjectId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(projectDelete.status).toBe(204);

    const clientDelete = await request(app)
      .delete(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(clientDelete.status).toBe(204);
  });

  it('supports task creation, status changes, reads, and assignment', async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `Lifecycle task ${suffix}`, assigneeId: memberId });
    expect(created.status).toBe(201);
    const taskId = created.body.data.id as string;

    const status = await request(app)
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(status.status).toBe(200);

    const assignment = await request(app)
      .patch(`/api/v1/tasks/${taskId}/assignee`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ assigneeId: null });
    expect(assignment.status).toBe(200);

    const task = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(task.status).toBe(200);
    expect(task.body.data.status).toBe('IN_PROGRESS');

    const activity = await prisma.activityLog.findMany({ where: { targetId: taskId } });
    expect(activity.map(({ action }) => action)).toContain('TASK_STATUS_CHANGED');
    expect(activity.map(({ action }) => action)).toContain('TASK_ASSIGNED');
  });

  it('lets the user list tasks only inside their accessible project', async () => {
    const allowed = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);

    const denied = await request(app)
      .get(`/api/v1/projects/${otherProjectId}/tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(denied.status).toBe(404);

    const createDenied = await request(app)
      .post(`/api/v1/projects/${otherProjectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Forbidden task creation' });
    expect(createDenied.status).toBe(404);
  });
});
