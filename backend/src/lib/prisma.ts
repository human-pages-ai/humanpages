import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from './referralCode.js';

export const prisma = new PrismaClient();

// Auto-generate referralCode on Human creation if not provided
prisma.$use(async (params, next) => {
  if (params.model === 'Human' && params.action === 'create') {
    if (!params.args.data.referralCode) {
      params.args.data.referralCode = generateReferralCode();
    }
  }
  return next(params);
});
