/** Bcrypt cost factor — defaults to 12 in production, overridable via BCRYPT_ROUNDS for tests */
export const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
