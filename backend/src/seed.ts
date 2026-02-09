import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: Seed script cannot run in production. It deletes all data.');
    process.exit(1);
  }

  console.log('Seeding database...');

  // Clear existing data
  await prisma.service.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.human.deleteMany();

  // Create humans
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.human.create({
    data: {
      email: 'alice@example.com',
      passwordHash,
      name: 'Alice Smith',
      bio: 'Full-stack developer with 5 years of experience. I specialize in React and Node.js.',
      location: 'San Francisco, CA',
      skills: ['javascript', 'react', 'nodejs', 'typescript'],
      contactEmail: 'alice@example.com',
      telegram: '@alice_dev',
      isAvailable: true,
      wallets: {
        create: [
          { network: 'ethereum', address: '0x1234567890abcdef1234567890abcdef12345678', label: 'Main' },
          { network: 'solana', address: 'ABC123solana456address789', label: 'Solana Wallet' },
        ],
      },
      services: {
        create: [
          {
            title: 'Website Development',
            description: 'I can build responsive websites using React and modern CSS frameworks.',
            category: 'development',
            priceMin: 500,
            priceUnit: 'FLAT_TASK',
          },
          {
            title: 'Code Review',
            description: 'Professional code review with detailed feedback and suggestions.',
            category: 'development',
            priceMin: 50,
            priceUnit: 'HOURLY',
          },
        ],
      },
    },
  });

  const bob = await prisma.human.create({
    data: {
      email: 'bob@example.com',
      passwordHash,
      name: 'Bob Johnson',
      bio: 'Data scientist and ML engineer. I help businesses make sense of their data.',
      location: 'New York, NY',
      skills: ['python', 'machine-learning', 'data-analysis', 'sql'],
      contactEmail: 'bob@example.com',
      telegram: '@bob_data',
      isAvailable: true,
      wallets: {
        create: [
          { network: 'ethereum', address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', label: 'ETH Wallet' },
          { network: 'bitcoin', address: 'bc1qexamplebitcoinaddress123456789', label: 'BTC' },
        ],
      },
      services: {
        create: [
          {
            title: 'Data Analysis',
            description: 'Comprehensive data analysis with visualizations and actionable insights.',
            category: 'data',
            priceMin: 100,
            priceUnit: 'HOURLY',
          },
        ],
      },
    },
  });

  const carol = await prisma.human.create({
    data: {
      email: 'carol@example.com',
      passwordHash,
      name: 'Carol Williams',
      bio: 'UX/UI designer with a passion for creating intuitive user experiences.',
      location: 'Austin, TX',
      skills: ['design', 'figma', 'ux-research', 'prototyping'],
      contactEmail: 'carol.design@example.com',
      telegram: '@carol_ux',
      isAvailable: false,
      wallets: {
        create: [
          { network: 'ethereum', address: '0x9876543210fedcba9876543210fedcba98765432', label: 'Design Pay' },
        ],
      },
      services: {
        create: [
          {
            title: 'UI/UX Design',
            description: 'Complete UI/UX design from wireframes to high-fidelity prototypes.',
            category: 'design',
            priceMin: 1000,
            priceUnit: 'FLAT_TASK',
          },
        ],
      },
    },
  });

  console.log('Created humans:', { alice: alice.id, bob: bob.id, carol: carol.id });
  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
