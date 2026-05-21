import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaService();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }

  const existing = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existing) {
    console.log('✅ Super Admin already exists, skipping seed.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Super Admin',
      role: Role.ADMIN,
      isVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log('🌱 Super Admin seeded:', admin.email);
}

seedAdmin()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });