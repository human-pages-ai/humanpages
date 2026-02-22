import { createContext, useContext } from 'react';
import type { StaffCapability } from '../types/admin';

interface AdminRoleState {
  isAdmin: boolean;
  isStaff: boolean;
  capabilities: StaffCapability[];
}

export const AdminRoleContext = createContext<AdminRoleState>({
  isAdmin: false,
  isStaff: false,
  capabilities: [],
});

export function useAdminRole() {
  return useContext(AdminRoleContext);
}

export function useHasCapability(cap: StaffCapability): boolean {
  const { capabilities } = useContext(AdminRoleContext);
  return capabilities.includes(cap);
}
