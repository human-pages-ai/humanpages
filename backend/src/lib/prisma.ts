import { PrismaClient } from '@prisma/client';
import { generateReferralCode } from './referralCode.js';

export const prisma = new PrismaClient();

/** Prisma WHERE fragment: user has verified identity via email OR WhatsApp */
export const identityVerifiedWhere = {
  OR: [{ emailVerified: true }, { whatsappVerified: true }],
};

// Auto-generate referralCode on Human creation if not provided
prisma.$use(async (params, next) => {
  if (params.model === 'Human' && params.action === 'create') {
    if (!params.args.data.referralCode) {
      params.args.data.referralCode = generateReferralCode();
    }
  }
  return next(params);
});
