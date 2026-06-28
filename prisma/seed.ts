import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const saltRounds = 12;

  const adminPassword = await bcrypt.hash('Admin@12345', saltRounds);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@musicstream.dev' },
    update: {},
    create: {
      email: 'admin@musicstream.dev',
      username: 'admin',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      isEmailVerified: true,
      firstName: 'Platform',
      lastName: 'Admin',
    },
  });

  const artistPassword = await bcrypt.hash('Artist@12345', saltRounds);
  const artistUser = await prisma.user.upsert({
    where: { email: 'artist@musicstream.dev' },
    update: {},
    create: {
      email: 'artist@musicstream.dev',
      username: 'demoartist',
      passwordHash: artistPassword,
      role: Role.ARTIST,
      status: AccountStatus.ACTIVE,
      isEmailVerified: true,
      firstName: 'Demo',
      lastName: 'Artist',
      artistProfile: {
        create: {
          stageName: 'Demo Artist',
          bio: 'A seeded demo artist for local development.',
          isVerified: true,
        },
      },
    },
  });

  const genres = await Promise.all(
    ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz'].map((name) =>
      prisma.genre.upsert({
        where: { slug: name.toLowerCase().replace(/\s+/g, '-') },
        update: {},
        create: {
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
        },
      }),
    ),
  );

  console.log('Seeded:', {
    admin: admin.email,
    artist: artistUser.email,
    genres: genres.map((g) => g.name),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
