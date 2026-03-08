export const STAFF_CAPABILITIES = [
  'CONTENT_REVIEWER',
  'POSTER',
  'CREATIVE',
  'LEAD_GEN',
  'VIDEO_MANAGER',
  'CAREER_MANAGER',
  'PHOTO_MANAGER',
] as const;

export type StaffCapability = (typeof STAFF_CAPABILITIES)[number];

export function isValidCapability(cap: string): cap is StaffCapability {
  return (STAFF_CAPABILITIES as readonly string[]).includes(cap);
}

/**
 * ADMIN gets all capabilities, STAFF gets their assigned ones, USER gets none.
 */
export function getEffectiveCapabilities(
  role: 'USER' | 'STAFF' | 'ADMIN',
  dbCapabilities: string[],
): StaffCapability[] {
  if (role === 'ADMIN') return [...STAFF_CAPABILITIES];
  if (role === 'STAFF') return dbCapabilities.filter(isValidCapability);
  return [];
}

export function hasCapability(
  role: 'USER' | 'STAFF' | 'ADMIN',
  dbCapabilities: string[],
  required: StaffCapability,
): boolean {
  return getEffectiveCapabilities(role, dbCapabilities).includes(required);
}
