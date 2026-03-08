import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import type { CareerApplication, CareerApplicationStats } from '../../types/admin';
import {
  MagnifyingGlassIcon,
  CheckIcon,
  XMarkIcon,
  EnvelopeIcon,
  CalendarIcon,
  MapPinIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const POSITIONS = [
  'digital-marketer',
  'content-creator',
  'virtual-assistant',
  'influencer-outreach',
  'customer-relations',
  'community-manager',
  'graphic-designer',
  'copywriter',
  'sales-development',
  'software-engineer',
  'video-editor',
  'general',
];

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'REVIEWED', label: 'Reviewed', color: 'bg-blue-100 text-blue-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  { value: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-800' },
  { value: 'HIRED', label: 'Hired', color: 'bg-green-100 text-green-800' },
];

function getStatusColor(status: string): string {
  const option = STATUS_OPTIONS.find((s) => s.value === status);
  return option?.color || 'bg-gray-100 text-gray-800';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DetailModal({
  application,
  isOpen,
  onClose,
  onUpdate,
}: {
  application: CareerApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
}) {
  const [status, setStatus] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setNotes(application.adminNotes || '');
    }
  }, [application]);

  const handleSave = async () => {
    if (!application) return;
    setIsSaving(true);

    try {
      await onUpdate(application.id, {
        status,
        adminNotes: notes,
      });
      toast.success('Application updated successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to update application');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !application) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="sticky top-0 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Application Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Applicant Info */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Applicant Info</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Name</p>
                <p className="text-gray-900">{application.human.name}</p>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <a
                    href={`mailto:${application.human.email}`}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                  >
                    <EnvelopeIcon className="h-4 w-4" />
                    {application.human.email}
                  </a>
                </div>
                {application.human.location && (
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Location</p>
                    <div className="flex items-center gap-2 text-gray-900">
                      <MapPinIcon className="h-4 w-4" />
                      {application.human.location}
                    </div>
                  </div>
                )}
              </div>
              {application.human.bio && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Bio</p>
                  <p className="text-gray-900">{application.human.bio}</p>
                </div>
              )}
              {application.human.skills && application.human.skills.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Skills</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {application.human.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Social Links */}
            {(application.human.linkedinUrl ||
              application.human.githubUrl ||
              application.human.websiteUrl) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Links</p>
                <div className="flex flex-wrap gap-3">
                  {application.human.linkedinUrl && (
                    <a
                      href={application.human.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <LinkIcon className="h-4 w-4" />
                      LinkedIn
                      {application.human.linkedinVerified && (
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      )}
                    </a>
                  )}
                  {application.human.githubUrl && (
                    <a
                      href={application.human.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
                    >
                      <LinkIcon className="h-4 w-4" />
                      GitHub
                      {application.human.githubVerified && (
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      )}
                    </a>
                  )}
                  {application.human.websiteUrl && (
                    <a
                      href={application.human.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Application Details */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Application</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Position</p>
                <p className="text-gray-900">{application.positionTitle}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">About</p>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {application.about}
                </p>
              </div>
              {application.portfolioUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Portfolio</p>
                  <a
                    href={application.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 break-all"
                  >
                    {application.portfolioUrl}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">Availability</p>
                <p className="text-gray-900">{application.availability}</p>
              </div>
              <div className="flex gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4" />
                  Applied: {formatDate(application.createdAt)}
                </div>
                {application.updatedAt !== application.createdAt && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-4 w-4" />
                    Updated: {formatDate(application.updatedAt)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status and Notes */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Admin Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Add notes about this application..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCareerApplications() {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [stats, setStats] = useState<CareerApplicationStats | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailApplication, setDetailApplication] =
    useState<CareerApplication | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [bulkStatusDropdown, setBulkStatusDropdown] = useState('');

  // Load applications
  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(statusFilter && { status: statusFilter }),
        ...(positionFilter && { positionId: positionFilter }),
        ...(searchQuery && { search: searchQuery }),
      };

      const response = await api.getCareerApplications(params);
      setApplications(response.applications);
      setPagination(response.pagination);
      setStats(response.stats);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [pagination.page, statusFilter, positionFilter, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === applications.length && applications.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(applications.map((a) => a.id)));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      toast.error('Please select applications');
      return;
    }

    try {
      await api.bulkUpdateCareerApplications(Array.from(selectedIds), newStatus);
      toast.success(`Updated ${selectedIds.size} applications`);
      setBulkStatusDropdown('');
      loadApplications();
    } catch (error) {
      console.error('Failed to bulk update:', error);
      toast.error('Failed to update applications');
    }
  };

  const handleUpdateApplication = async (
    id: string,
    updates: Record<string, unknown>
  ) => {
    await api.updateCareerApplication(id, updates);
    loadApplications();
  };

  const handleOpenDetail = async (application: CareerApplication) => {
    try {
      const fullApp = await api.getCareerApplication(application.id);
      setDetailApplication(fullApp);
      setIsDetailOpen(true);
    } catch (error) {
      console.error('Failed to load application detail:', error);
      toast.error('Failed to load application details');
    }
  };

  const filteredApplications = useMemo(() => {
    return applications;
  }, [applications]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-8">
        <h1 className="text-3xl font-bold text-gray-900">Career Applications</h1>
        <p className="mt-1 text-gray-600">
          Manage and review career application submissions
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-600">Total Applications</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {stats.pending}
              </p>
            </div>
            {STATUS_OPTIONS.map((option) => {
              const count = stats.byStatus[option.value] || 0;
              return (
                <div key={option.value} className="bg-white rounded-lg shadow p-6">
                  <p className="text-sm font-medium text-gray-600">{option.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, position..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Position Filter */}
            <select
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Positions</option>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={bulkStatusDropdown}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkStatusChange(e.target.value);
                      }
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Change status...</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Loading applications...</p>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="p-12 text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No applications found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.size === filteredApplications.length &&
                            filteredApplications.length > 0
                          }
                          onChange={handleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Applicant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Availability
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Applied
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredApplications.map((application) => (
                      <tr key={application.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(application.id)}
                            onChange={() => handleToggleSelect(application.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {application.human.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {application.human.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {application.positionTitle}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {application.availability}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(application.status)}`}>
                            {STATUS_OPTIONS.find((s) => s.value === application.status)
                              ?.label || application.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(application.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => handleOpenDetail(application)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        page: Math.max(1, p.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                      (page) => (
                        <button
                          key={page}
                          onClick={() => setPagination((p) => ({ ...p, page }))}
                          className={`px-3 py-2 rounded-lg ${
                            pagination.page === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setPagination((p) => ({
                        ...p,
                        page: Math.min(p.totalPages, p.page + 1),
                      }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <DetailModal
        application={detailApplication}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailApplication(null);
        }}
        onUpdate={handleUpdateApplication}
      />
    </div>
  );
}
