import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import ProfileCompleteness from '../components/ProfileCompleteness';

interface Wallet {
  id: string;
  network: string;
  address: string;
  label?: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  priceRange?: string;
  isActive: boolean;
}

interface Profile {
  id: string;
  name: string;
  email: string;
  bio?: string;
  location?: string;
  skills: string[];
  contactEmail?: string;
  telegram?: string;
  isAvailable: boolean;
  linkedinUrl?: string;
  twitterUrl?: string;
  githubUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  websiteUrl?: string;
  wallets: Wallet[];
  services: Service[];
}

interface Job {
  id: string;
  agentId: string;
  agentName?: string;
  title: string;
  description: string;
  category?: string;
  priceUsdc: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
  createdAt: string;
  acceptedAt?: string;
  paidAt?: string;
  completedAt?: string;
  review?: {
    id: string;
    rating: number;
    comment?: string;
  };
}

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  completedJobs: number;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    location: '',
    skills: '',
    contactEmail: '',
    telegram: '',
    linkedinUrl: '',
    twitterUrl: '',
    githubUrl: '',
    instagramUrl: '',
    youtubeUrl: '',
    websiteUrl: '',
  });

  // Wallet form state
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState({ network: 'ethereum', address: '', label: '' });

  // Service form state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ title: '', description: '', category: '', priceRange: '' });

  // Jobs state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobFilter, setJobFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);

  useEffect(() => {
    loadProfile();
    loadJobs();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfile(data);
      setProfileForm({
        name: data.name || '',
        bio: data.bio || '',
        location: data.location || '',
        skills: data.skills?.join(', ') || '',
        contactEmail: data.contactEmail || '',
        telegram: data.telegram || '',
        linkedinUrl: data.linkedinUrl || '',
        twitterUrl: data.twitterUrl || '',
        githubUrl: data.githubUrl || '',
        instagramUrl: data.instagramUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        websiteUrl: data.websiteUrl || '',
      });
      // Load review stats
      if (data.id) {
        try {
          const reviewData = await api.getMyReviews(data.id);
          setReviewStats(reviewData.stats);
        } catch (e) {
          console.error('Failed to load reviews:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setJobsLoading(false);
    }
  };

  const acceptJob = async (jobId: string) => {
    try {
      await api.acceptJob(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const rejectJob = async (jobId: string) => {
    if (!confirm('Reject this job offer?')) return;
    try {
      await api.rejectJob(jobId);
      await loadJobs();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const completeJob = async (jobId: string) => {
    try {
      await api.completeJob(jobId);
      await loadJobs();
      // Reload profile to update review stats
      await loadProfile();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const getFilteredJobs = () => {
    switch (jobFilter) {
      case 'pending':
        return jobs.filter(j => j.status === 'PENDING');
      case 'active':
        return jobs.filter(j => ['ACCEPTED', 'PAID'].includes(j.status));
      case 'completed':
        return jobs.filter(j => j.status === 'COMPLETED');
      default:
        return jobs;
    }
  };

  const getStatusBadge = (status: Job['status']) => {
    const styles: Record<Job['status'], string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      ACCEPTED: 'bg-blue-100 text-blue-700',
      REJECTED: 'bg-gray-100 text-gray-700',
      PAID: 'bg-green-100 text-green-700',
      COMPLETED: 'bg-purple-100 text-purple-700',
      CANCELLED: 'bg-gray-100 text-gray-700',
      DISPUTED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  const toggleAvailability = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ isAvailable: !profile.isAvailable });
      setProfile(updated);
    } catch (error) {
      console.error('Failed to update availability:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: profileForm.name,
        bio: profileForm.bio || null,
        location: profileForm.location || null,
        skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        contactEmail: profileForm.contactEmail || null,
        telegram: profileForm.telegram || null,
        linkedinUrl: profileForm.linkedinUrl || null,
        twitterUrl: profileForm.twitterUrl || null,
        githubUrl: profileForm.githubUrl || null,
        instagramUrl: profileForm.instagramUrl || null,
        youtubeUrl: profileForm.youtubeUrl || null,
        websiteUrl: profileForm.websiteUrl || null,
      });
      setProfile(updated);
      setEditingProfile(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const addWallet = async () => {
    setSaving(true);
    try {
      await api.addWallet(walletForm);
      await loadProfile();
      setWalletForm({ network: 'ethereum', address: '', label: '' });
      setShowWalletForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteWallet = async (id: string) => {
    if (!confirm('Delete this wallet?')) return;
    try {
      await api.deleteWallet(id);
      await loadProfile();
    } catch (error) {
      console.error('Failed to delete wallet:', error);
    }
  };

  const addService = async () => {
    setSaving(true);
    try {
      await api.createService(serviceForm);
      await loadProfile();
      setServiceForm({ title: '', description: '', category: '', priceRange: '' });
      setShowServiceForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceActive = async (service: Service) => {
    try {
      await api.updateService(service.id, { isActive: !service.isActive });
      await loadProfile();
    } catch (error) {
      console.error('Failed to update service:', error);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    try {
      await api.deleteService(id);
      await loadProfile();
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Failed to load profile</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Humans</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Profile Completeness */}
        <ProfileCompleteness profile={profile} onEditProfile={() => setEditingProfile(true)} />

        {/* Availability Toggle */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Availability</h2>
              <p className="text-gray-600 text-sm">
                {profile.isAvailable ? 'You are visible to AI agents' : 'You are hidden from searches'}
              </p>
            </div>
            <button
              onClick={toggleAvailability}
              disabled={saving}
              className={`px-4 py-2 rounded-lg font-medium ${
                profile.isAvailable
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {profile.isAvailable ? 'Available' : 'Unavailable'}
            </button>
          </div>
        </div>

        {/* Jobs Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Jobs</h2>
              {reviewStats && (
                <p className="text-gray-600 text-sm">
                  {reviewStats.completedJobs} completed · {reviewStats.totalReviews} reviews ·
                  {reviewStats.averageRating > 0 ? ` ${reviewStats.averageRating.toFixed(1)}★ avg` : ' No ratings yet'}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              {(['all', 'pending', 'active', 'completed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setJobFilter(filter)}
                  className={`px-3 py-1 text-sm rounded-md capitalize ${
                    jobFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {jobsLoading ? (
            <p className="text-gray-500 text-sm">Loading jobs...</p>
          ) : getFilteredJobs().length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {jobFilter === 'all'
                  ? 'No job offers yet. When AI agents want to hire you, their offers will appear here.'
                  : `No ${jobFilter} jobs.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredJobs().map((job) => (
                <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{job.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="font-medium text-green-600">${job.priceUsdc} USDC</span>
                        {job.agentName && <span>From: {job.agentName}</span>}
                        {job.category && <span className="bg-gray-100 px-2 py-0.5 rounded">{job.category}</span>}
                        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Review display */}
                      {job.review && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-500">{'★'.repeat(job.review.rating)}{'☆'.repeat(5 - job.review.rating)}</span>
                            <span className="text-sm text-gray-600">Review received</span>
                          </div>
                          {job.review.comment && (
                            <p className="text-sm text-gray-700 mt-1">"{job.review.comment}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 ml-4">
                      {job.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => acceptJob(job.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => rejectJob(job.id)}
                            className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {job.status === 'PAID' && (
                        <button
                          onClick={() => completeJob(job.id)}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                        >
                          Mark Complete
                        </button>
                      )}
                      {job.status === 'ACCEPTED' && (
                        <span className="text-sm text-blue-600">Awaiting payment...</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Profile</h2>
            <button
              onClick={() => setEditingProfile(!editingProfile)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {editingProfile ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editingProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input
                  type="text"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Skills (comma-separated)</label>
                <input
                  type="text"
                  value={profileForm.skills}
                  onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  placeholder="javascript, react, nodejs"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                <input
                  type="email"
                  value={profileForm.contactEmail}
                  onChange={(e) => setProfileForm({ ...profileForm, contactEmail: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telegram</label>
                <input
                  type="text"
                  value={profileForm.telegram}
                  onChange={(e) => setProfileForm({ ...profileForm, telegram: e.target.value })}
                  placeholder="@username"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Social Profiles Section */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Social Profiles (for trust)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
                    <input
                      type="url"
                      value={profileForm.linkedinUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Twitter / X</label>
                    <input
                      type="url"
                      value={profileForm.twitterUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, twitterUrl: e.target.value })}
                      placeholder="https://twitter.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">GitHub</label>
                    <input
                      type="url"
                      value={profileForm.githubUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, githubUrl: e.target.value })}
                      placeholder="https://github.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Instagram</label>
                    <input
                      type="url"
                      value={profileForm.instagramUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/username"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">YouTube</label>
                    <input
                      type="url"
                      value={profileForm.youtubeUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, youtubeUrl: e.target.value })}
                      placeholder="https://youtube.com/@channel"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      value={profileForm.websiteUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, websiteUrl: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={saveProfile}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {profile.name}</p>
              <p><span className="font-medium">Bio:</span> {profile.bio || 'Not set'}</p>
              <p><span className="font-medium">Location:</span> {profile.location || 'Not set'}</p>
              <p><span className="font-medium">Skills:</span> {profile.skills?.join(', ') || 'None'}</p>
              <p><span className="font-medium">Contact Email:</span> {profile.contactEmail || 'Not set'}</p>
              <p><span className="font-medium">Telegram:</span> {profile.telegram || 'Not set'}</p>

              {/* Social Profiles Display */}
              {(profile.linkedinUrl || profile.twitterUrl || profile.githubUrl ||
                profile.instagramUrl || profile.youtubeUrl || profile.websiteUrl) && (
                <div className="pt-3 mt-3 border-t border-gray-200">
                  <p className="font-medium mb-2">Social Profiles:</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.linkedinUrl && (
                      <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">
                        LinkedIn
                      </a>
                    )}
                    {profile.twitterUrl && (
                      <a href={profile.twitterUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-sky-100 text-sky-700 rounded text-xs hover:bg-sky-200">
                        Twitter
                      </a>
                    )}
                    {profile.githubUrl && (
                      <a href={profile.githubUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200">
                        GitHub
                      </a>
                    )}
                    {profile.instagramUrl && (
                      <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs hover:bg-pink-200">
                        Instagram
                      </a>
                    )}
                    {profile.youtubeUrl && (
                      <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                        YouTube
                      </a>
                    )}
                    {profile.websiteUrl && (
                      <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                        Website
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallets Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Wallets</h2>
            <button
              onClick={() => setShowWalletForm(!showWalletForm)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {showWalletForm ? 'Cancel' : 'Add Wallet'}
            </button>
          </div>

          {showWalletForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Network</label>
                <select
                  value={walletForm.network}
                  onChange={(e) => setWalletForm({ ...walletForm, network: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="solana">Solana</option>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={walletForm.address}
                  onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Label (optional)</label>
                <input
                  type="text"
                  value={walletForm.label}
                  onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })}
                  placeholder="e.g., Main wallet"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={addWallet}
                disabled={saving || !walletForm.address}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Wallet
              </button>
            </div>
          )}

          {profile.wallets.length === 0 ? (
            <p className="text-gray-500 text-sm">No wallets added yet</p>
          ) : (
            <div className="space-y-2">
              {profile.wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-sm">{wallet.network}</span>
                    {wallet.label && <span className="text-gray-500 text-sm ml-2">({wallet.label})</span>}
                    <p className="text-xs text-gray-600 font-mono truncate max-w-md">{wallet.address}</p>
                  </div>
                  <button
                    onClick={() => deleteWallet(wallet.id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Services Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Services</h2>
            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {showServiceForm ? 'Cancel' : 'Add Service'}
            </button>
          </div>

          {showServiceForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                  placeholder="What service do you offer?"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={3}
                  placeholder="Describe what you can do..."
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={serviceForm.category}
                  onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                  placeholder="e.g., development, design, data"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price Range (optional)</label>
                <input
                  type="text"
                  value={serviceForm.priceRange}
                  onChange={(e) => setServiceForm({ ...serviceForm, priceRange: e.target.value })}
                  placeholder="e.g., $50-100/hour"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={addService}
                disabled={saving || !serviceForm.title || !serviceForm.description || !serviceForm.category}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Service
              </button>
            </div>
          )}

          {profile.services.length === 0 ? (
            <p className="text-gray-500 text-sm">No services listed yet. Add services to show AI agents what you can do!</p>
          ) : (
            <div className="space-y-3">
              {profile.services.map((service) => (
                <div key={service.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{service.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{service.category}</span>
                        {service.priceRange && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {service.priceRange}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleServiceActive(service)}
                        className={`text-xs px-2 py-1 rounded ${
                          service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {service.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => deleteService(service.id)}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
