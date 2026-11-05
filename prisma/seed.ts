import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is disabled in production. Set ALLOW_DEMO_SEED=true only for a deliberate, isolated seed run.');
  }

  const adminPasswordPlain =
    process.env.SEED_ADMIN_PASSWORD ??
    (process.env.NODE_ENV === 'development' ? 'Admin@12345' : undefined);
  const artistPasswordPlain =
    process.env.SEED_ARTIST_PASSWORD ??
    (process.env.NODE_ENV === 'development' ? 'Artist@12345' : undefined);

  if (!adminPasswordPlain || !artistPasswordPlain) {
    throw new Error('SEED_ADMIN_PASSWORD and SEED_ARTIST_PASSWORD are required outside development.');
  }

  const saltRounds = 12;

  const adminPassword = await bcrypt.hash(adminPasswordPlain, saltRounds);
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

  const artistPassword = await bcrypt.hash(artistPasswordPlain, saltRounds);
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
