import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/agents', label: 'Agents' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/listings', label: 'Listings' },
  { to: '/admin/activity', label: 'Activity' },
  { to: '/admin/feedback', label: 'Feedback' },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'px-3 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-700'
    : 'px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50';
}

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
            <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              Back to app
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
