import { NavLink, Outlet } from 'react-router-dom';
import { useAdminRole } from '../../hooks/useAdminRole';
import type { StaffCapability } from '../../types/admin';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  capability?: StaffCapability;
}

const adminOnlyItems: NavItem[] = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/features', label: 'Features' },
  { to: '/admin/people', label: 'People' },
  { to: '/admin/agents', label: 'Agents' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/listings', label: 'Listings' },
  { to: '/admin/activity', label: 'Activity' },
  { to: '/admin/feedback', label: 'Feedback' },
  { to: '/admin/video', label: 'Videos' },
  { to: '/admin/schedule', label: 'Schedule' },
  { to: '/admin/photos', label: 'Photos' },
  { to: '/admin/careers', label: 'Careers' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/productivity', label: 'Productivity' },
  { to: '/admin/leads', label: 'Lead Gen' },
  { to: '/admin/logs', label: 'Logs' },
  { to: '/admin/emails', label: 'Email' },
  { to: '/admin/link-codes', label: 'Link Codes' },
  { to: '/admin/moderation', label: 'Moderation' },
  { to: '/admin/watchdog', label: 'Watch Dog' },
  { to: '/admin/marketing-ops', label: 'Marketing Ops' },
  { to: '/admin/solver', label: 'Solver' },
  { to: '/admin/arbitrators', label: 'Arbitrators' },
  { to: '/admin/mcp-funnel', label: 'MCP Funnel' },
  { to: '/admin/mcp-sessions', label: 'MCP Sessions' },
];

const sharedItems: NavItem[] = [
  { to: '/admin/tasks', label: 'Task Central' },
  { to: '/admin/time-tracking', label: 'Time Tracking' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/posting', label: 'Posting Queue' },
  { to: '/admin/posting/work', label: 'Work Mode' },
  { to: '/admin/ad-copy', label: 'Ad Copy' },
  { to: '/admin/video', label: 'Videos', capability: 'VIDEO_MANAGER' },
  { to: '/admin/careers', label: 'Careers', capability: 'CAREER_MANAGER' },
  { to: '/admin/photos', label: 'Photos', capability: 'PHOTO_MANAGER' },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'px-3 py-2 text-sm font-medium rounded-md bg-blue-50 text-blue-700'
    : 'px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50';
}

export default function AdminLayout() {
  const { isAdmin, capabilities } = useAdminRole();
  const staffItems = sharedItems.filter(
    (item) => !item.capability || capabilities.includes(item.capability),
  );
  const navItems = isAdmin ? [...adminOnlyItems, ...staffItems.filter((i) => !adminOnlyItems.some((a) => a.to === i.to))] : staffItems;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-semibold text-gray-900">
              {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'}
            </h1>
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              Back to app
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={(item as any).end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
