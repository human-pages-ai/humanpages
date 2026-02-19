import { createContext, useContext } from 'react';

interface AdminRoleState {
  isAdmin: boolean;
  isStaff: boolean;
}

export const AdminRoleContext = createContext<AdminRoleState>({
  isAdmin: false,
  isStaff: false,
});

export function useAdminRole() {
  return useContext(AdminRoleContext);
}
