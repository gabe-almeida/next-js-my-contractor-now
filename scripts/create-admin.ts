/**
 * Create Admin User Script
 *
 * WHY: Set up the first SUPER_ADMIN user for the system
 * WHEN: Initial setup or when adding new admin users
 * HOW: Run with: npx ts-node scripts/create-admin.ts
 *
 * Usage:
 *   npx ts-node scripts/create-admin.ts
 *   # or
 *   npm run create-admin
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n=== Create Admin User ===\n');

  // Get user input
  const email = await question('Email: ');
  const name = await question('Name: ');
  const password = await question('Password (min 8 chars): ');
  const roleInput = await question('Role (SUPER_ADMIN/ADMIN/SUPPORT) [SUPER_ADMIN]: ');
  const role = roleInput || 'SUPER_ADMIN';

  // Validate
  if (!email || !name || !password) {
    console.error('\nError: All fields are required');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\nError: Password must be at least 8 characters');
    process.exit(1);
  }

  // Check if user exists
  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    console.error(`\nError: User with email ${email} already exists`);
    process.exit(1);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      active: true,
    },
  });

  console.log('\n=== Admin User Created ===');
  console.log(`ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Name: ${user.name}`);
  console.log(`Role: ${user.role}`);
  console.log('\nYou can now login at /admin/login\n');

  rl.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  rl.close();
  prisma.$disconnect();
  process.exit(1);
});
