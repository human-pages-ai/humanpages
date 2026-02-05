import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

interface Wallet {
  id: string;
  network: string;
  address: string;
  label?: string;
}

interface Job {
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
  wallets: Wallet[];
  jobs: Job[];
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
  });

  // Wallet form state
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletForm, setWalletForm] = useState({ network: 'ethereum', address: '', label: '' });

  // Job form state
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', description: '', category: '', priceRange: '' });

  useEffect(() => {
    loadProfile();
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
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
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

  const addJob = async () => {
    setSaving(true);
    try {
      await api.createJob(jobForm);
      await loadProfile();
      setJobForm({ title: '', description: '', category: '', priceRange: '' });
      setShowJobForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleJobActive = async (job: Job) => {
    try {
      await api.updateJob(job.id, { isActive: !job.isActive });
      await loadProfile();
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job listing?')) return;
    try {
      await api.deleteJob(id);
      await loadProfile();
    } catch (error) {
      console.error('Failed to delete job:', error);
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

        {/* Jobs Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Job Listings</h2>
            <button
              onClick={() => setShowJobForm(!showJobForm)}
              className="text-indigo-600 hover:text-indigo-500 text-sm"
            >
              {showJobForm ? 'Cancel' : 'Add Job'}
            </button>
          </div>

          {showJobForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={jobForm.category}
                  onChange={(e) => setJobForm({ ...jobForm, category: e.target.value })}
                  placeholder="e.g., development, design, data"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price Range</label>
                <input
                  type="text"
                  value={jobForm.priceRange}
                  onChange={(e) => setJobForm({ ...jobForm, priceRange: e.target.value })}
                  placeholder="e.g., $50-100/hour"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <button
                onClick={addJob}
                disabled={saving || !jobForm.title || !jobForm.description || !jobForm.category}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Job
              </button>
            </div>
          )}

          {profile.jobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No job listings yet</p>
          ) : (
            <div className="space-y-3">
              {profile.jobs.map((job) => (
                <div key={job.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{job.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{job.description}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{job.category}</span>
                        {job.priceRange && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {job.priceRange}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleJobActive(job)}
                        className={`text-xs px-2 py-1 rounded ${
                          job.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {job.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
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
