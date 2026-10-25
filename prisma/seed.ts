import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The demo seed is disabled in production.');
  }

  const clientId = '10000000-0000-4000-8000-000000000001';
  const projectId = '20000000-0000-4000-8000-000000000001';
  const taskId = '30000000-0000-4000-8000-000000000001';
  await prisma.client.upsert({
    where: { id: clientId },
    update: { name: 'DevFlow Demo Client', email: 'client@example.test', phone: null },
    create: { id: clientId, name: 'DevFlow Demo Client', email: 'client@example.test' },
  });
  await prisma.project.upsert({
    where: { id: projectId },
    update: {
      clientId,
      name: 'Demo Agency Website',
      description: 'Synthetic sample project for local development.',
      status: 'ACTIVE',
    },
    create: {
      id: projectId,
      clientId,
      name: 'Demo Agency Website',
      description: 'Synthetic sample project for local development.',
      status: 'ACTIVE',
    },
  });

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? 'DevFlow Administrator';

  if (!email || !password) {
    console.info(
      'Demo client and project seeded. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create an admin and sample task.',
    );
    return;
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must contain at least 12 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: UserRole.ADMIN, isActive: true, passwordHash },
    create: { email, name, role: UserRole.ADMIN, passwordHash },
    select: { id: true },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: admin.id } },
    update: {},
    create: { projectId, userId: admin.id },
  });
  await prisma.task.upsert({
    where: { id: taskId },
    update: {
      projectId,
      createdByUserId: admin.id,
      title: 'Review the demo project brief',
      status: 'TODO',
      priority: 'MEDIUM',
    },
    create: {
      id: taskId,
      projectId,
      createdByUserId: admin.id,
      title: 'Review the demo project brief',
      status: 'TODO',
      priority: 'MEDIUM',
    },
  });
  console.info(`Administrator seed ensured for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
