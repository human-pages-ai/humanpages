import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AdminPerson, PeopleFilterOptions, Pagination } from '../../types/admin';

export default function AdminPeople() {
  const navigate = useNavigate();
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [filterOptions, setFilterOptions] = useState<PeopleFilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [hasCareerApplication, setHasCareerApplication] = useState(false);
  const [careerPositionId, setCareerPositionId] = useState('');
  const [hasReferrals, setHasReferrals] = useState(false);
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);

  const skillDropdownRef = useRef<HTMLDivElement>(null);

  // Load filter options once
  useEffect(() => {
    api.getAdminPeopleFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  // Close skill dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (skillDropdownRef.current && !skillDropdownRef.current.contains(e.target as Node)) {
        setShowSkillDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const buildParams = useCallback(() => ({
    search: search || undefined,
    country: country || undefined,
    skills: selectedSkills.length > 0 ? selectedSkills.join(',') : undefined,
    hasCareerApplication: hasCareerApplication || undefined,
    careerPositionId: careerPositionId || undefined,
    hasReferrals: hasReferrals || undefined,
    sort,
    order,
  }), [search, country, selectedSkills, hasCareerApplication, careerPositionId, hasReferrals, sort, order]);

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminPeople({ page, limit: 25, ...buildParams() });
      setPeople(res.people);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  // Debounced load on filter change
  useEffect(() => {
    const timer = setTimeout(() => load(1), 300);
    return () => clearTimeout(timer);
  }, [load]);

  function toggleSort(field: string) {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('desc');
    }
  }

  function sortIndicator(field: string) {
    if (sort !== field) return '';
    return order === 'asc' ? ' \u2191' : ' \u2193';
  }

  function clearFilters() {
    setSearch('');
    setCountry('');
    setSelectedSkills([]);
    setSkillSearch('');
    setHasCareerApplication(false);
    setCareerPositionId('');
    setHasReferrals(false);
  }

  const hasActiveFilters = search || country || selectedSkills.length > 0 || hasCareerApplication || careerPositionId || hasReferrals;

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportAdminPeople(buildParams());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `people-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  function addSkill(skill: string) {
    if (!selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
    }
    setSkillSearch('');
    setShowSkillDropdown(false);
  }

  function removeSkill(skill: string) {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill));
  }

  const filteredSkillOptions = filterOptions?.skills.filter(
    (s) => !selectedSkills.includes(s) && s.toLowerCase().includes(skillSearch.toLowerCase())
  ).slice(0, 20) || [];

  function extractCountry(location: string | null) {
    if (!location) return '';
    const parts = location.split(',').map((s) => s.trim());
    return parts.length >= 2 ? parts[parts.length - 1] : '';
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              placeholder="Name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Country */}
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All countries</option>
              {filterOptions?.countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Career Application filter */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Career Application</label>
            <select
              value={hasCareerApplication ? (careerPositionId || '__any__') : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setHasCareerApplication(false);
                  setCareerPositionId('');
                } else if (v === '__any__') {
                  setHasCareerApplication(true);
                  setCareerPositionId('');
                } else {
                  setHasCareerApplication(true);
                  setCareerPositionId(v);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No filter</option>
              <option value="__any__">Any role</option>
              {filterOptions?.careerPositions.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.count})</option>
              ))}
            </select>
          </div>

          {/* Has Referrals toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Referrals</label>
            <button
              onClick={() => setHasReferrals(!hasReferrals)}
              className={`px-3 py-2 border rounded-md text-sm transition-colors ${
                hasReferrals
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Has referrals
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-auto">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Skills filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Skills:</span>
          {selectedSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              {s}
              <button onClick={() => removeSkill(s)} className="hover:text-blue-900">&times;</button>
            </span>
          ))}
          <div className="relative" ref={skillDropdownRef}>
            <input
              type="text"
              placeholder="Add skill filter..."
              value={skillSearch}
              onChange={(e) => {
                setSkillSearch(e.target.value);
                setShowSkillDropdown(true);
              }}
              onFocus={() => setShowSkillDropdown(true)}
              className="px-2 py-1 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            {showSkillDropdown && filteredSkillOptions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {filteredSkillOptions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => addSkill(s)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-gray-700"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${pagination.total} people found`}
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('name')}>
                Person{sortIndicator('name')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Career Apps</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrals</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('createdAt')}>
                Joined{sortIndicator('createdAt')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => toggleSort('lastActiveAt')}>
                Last Active{sortIndicator('lastActiveAt')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : people.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No people found</td></tr>
            ) : (
              people.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/users/${p.id}`)}>
                  {/* Person */}
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      <Link
                        to={`/admin/users/${p.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {p.name}
                      </Link>
                      {p.username && <span className="ml-1 text-gray-400 text-xs">@{p.username}</span>}
                    </div>
                    <div className="text-xs text-gray-500">{p.email}</div>
                    <div className="flex gap-1 mt-0.5">
                      {p.emailVerified && <span className="text-[10px] px-1 py-0.5 bg-green-100 text-green-700 rounded">email</span>}
                      {p.linkedinVerified && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">linkedin</span>}
                      {p.githubVerified && <span className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-700 rounded">github</span>}
                    </div>
                  </td>
                  {/* Location */}
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.location ? (
                      <div>
                        <div className="text-xs text-gray-900">{p.location}</div>
                        <div className="text-[10px] text-gray-400">{extractCountry(p.location)}</div>
                      </div>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  {/* Skills */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {p.skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {s}
                        </span>
                      ))}
                      {p.skills.length > 4 && (
                        <span className="text-[10px] text-gray-400">+{p.skills.length - 4}</span>
                      )}
                    </div>
                  </td>
                  {/* Career Apps */}
                  <td className="px-4 py-3">
                    {p.careerApplications.length > 0 ? (
                      <div className="space-y-0.5">
                        {p.careerApplications.map((a) => (
                          <div key={a.positionId} className="text-[10px]">
                            <span className="text-gray-700">{a.positionTitle}</span>
                            <span className={`ml-1 px-1 py-0.5 rounded ${
                              a.status === 'HIRED' ? 'bg-green-100 text-green-700' :
                              a.status === 'CONTACTED' ? 'bg-blue-100 text-blue-700' :
                              a.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                              a.status === 'REVIEWED' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{a.status.toLowerCase()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                  {/* Referrals */}
                  <td className="px-4 py-3 text-sm">
                    <div className="text-xs">
                      {p.referralCount > 0 && (
                        <span className="text-blue-600 font-medium">{p.referralCount} referred</span>
                      )}
                      {p.referredByName && (
                        <div className="text-[10px] text-gray-400">by {p.referredByName}</div>
                      )}
                      {!p.referralCount && !p.referredByName && (
                        <span className="text-gray-300">-</span>
                      )}
                    </div>
                  </td>
                  {/* Joined */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  {/* Last Active */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(p.lastActiveAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
