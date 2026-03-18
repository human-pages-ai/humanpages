import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import { safeLocalStorage } from '../../../lib/safeStorage';
import toast from 'react-hot-toast';
import type { OnboardingDraft, LanguageEntry, EducationEntry, Service } from '../types';
import { parseLanguageString } from '../utils';

export interface UseProfileFormReturn {
  // Identity
  name: string;
  setName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  neighborhood: string;
  setNeighborhood: (v: string) => void;
  locationLat: number | undefined;
  setLocationLat: (v: number | undefined) => void;
  locationLng: number | undefined;
  setLocationLng: (v: number | undefined) => void;

  // Photo
  photoFile: File | null;
  setPhotoFile: (f: File | null) => void;
  photoPreview: string | null;
  setPhotoPreview: (v: string | null) => void;
  photoInputRef: React.RefObject<HTMLInputElement>;
  oauthPhotoUrl: string | null;
  setOauthPhotoUrl: (v: string | null) => void;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhotoRemove: () => void;

  // Skills
  skills: string[];
  setSkills: React.Dispatch<React.SetStateAction<string[]>>;
  customSkill: string;
  setCustomSkill: (v: string) => void;
  skillSearch: string;
  setSkillSearch: (v: string) => void;
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  toggleSkill: (skill: string) => void;
  addCustomSkill: () => void;

  // Education
  educationEntries: EducationEntry[];
  setEducationEntries: React.Dispatch<React.SetStateAction<EducationEntry[]>>;

  // Languages
  languageEntries: LanguageEntry[];
  setLanguageEntries: React.Dispatch<React.SetStateAction<LanguageEntry[]>>;
  addLanguageEntry: (entry: LanguageEntry) => void;
  removeLanguageEntry: (index: number) => void;
  updateLanguageEntry: (index: number, updates: Partial<LanguageEntry>) => void;

  // Services
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;

  // Social links
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  twitterUrl: string;
  setTwitterUrl: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  instagramUrl: string;
  setInstagramUrl: (v: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (v: string) => void;
  facebookUrl: string;
  setFacebookUrl: (v: string) => void;
  tiktokUrl: string;
  setTiktokUrl: (v: string) => void;
  externalProfiles: string[];
  setExternalProfiles: React.Dispatch<React.SetStateAction<string[]>>;
  walletAddress: string;
  setWalletAddress: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;

  // Messaging
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;

  // Availability (agent-facing fields)
  timezone: string;
  setTimezone: (v: string) => void;
  weeklyCapacityHours: number | null;
  setWeeklyCapacityHours: (v: number | null) => void;
  responseTimeCommitment: string;
  setResponseTimeCommitment: (v: string) => void;
  workType: string;
  setWorkType: (v: string) => void;

  // Agent-facing structured fields
  yearsOfExperience: number | null;
  setYearsOfExperience: (v: number | null) => void;
  industries: string[];
  setIndustries: React.Dispatch<React.SetStateAction<string[]>>;
  equipment: string[];
  setEquipment: React.Dispatch<React.SetStateAction<string[]>>;

  // Profile state
  emailVerified: boolean;
  profileLoading: boolean;
  profileCompleted: boolean;
  error: string;
  setError: (v: string) => void;

  // Refs
  mountedRef: React.MutableRefObject<boolean>;
  draft: Partial<OnboardingDraft> | null;
}

export function useProfileForm(draft: Partial<OnboardingDraft> | null): UseProfileFormReturn {
  const navigate = useNavigate();

  // ─── Identity ───
  const [name, setName] = useState(draft?.name || '');
  const [bio, setBio] = useState(draft?.bio || '');
  const [location, setLocation] = useState(draft?.location || '');
  const [neighborhood, setNeighborhood] = useState(draft?.neighborhood || '');
  const [locationLat, setLocationLat] = useState<number | undefined>(draft?.locationLat);
  const [locationLng, setLocationLng] = useState<number | undefined>(draft?.locationLng);

  // ─── Photo ───
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [oauthPhotoUrl, setOauthPhotoUrl] = useState<string | null>(null);

  // ─── Skills ───
  const [skills, setSkills] = useState<string[]>(draft?.skills || []);
  const [customSkill, setCustomSkill] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // ─── Education, Languages, Services ───
  const [educationEntries, setEducationEntries] = useState<EducationEntry[]>(draft?.educationEntries || []);
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>(
    draft?.languageEntries || (draft as any)?.languages?.map((l: string) => parseLanguageString(l)) || []
  );
  const [services, setServices] = useState<Service[]>(draft?.services || []);

  // ─── Social links ───
  const [linkedinUrl, setLinkedinUrl] = useState(draft?.linkedinUrl || '');
  const [githubUrl, setGithubUrl] = useState(draft?.githubUrl || '');
  const [twitterUrl, setTwitterUrl] = useState(draft?.twitterUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(draft?.websiteUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(draft?.instagramUrl || '');
  const [youtubeUrl, setYoutubeUrl] = useState(draft?.youtubeUrl || '');
  const [facebookUrl, setFacebookUrl] = useState(draft?.facebookUrl || '');
  const [tiktokUrl, setTiktokUrl] = useState(draft?.tiktokUrl || '');
  const [externalProfiles, setExternalProfiles] = useState<string[]>(draft?.externalProfiles || []);
  const [walletAddress, setWalletAddress] = useState(draft?.walletAddress || '');
  const [username, setUsername] = useState(draft?.username || '');

  // ─── Messaging ───
  const [whatsappNumber, setWhatsappNumber] = useState(draft?.whatsappNumber || '');

  // ─── Availability (agent-facing) ───
  const [timezone, setTimezone] = useState(draft?.timezone || '');
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState<number | null>(draft?.weeklyCapacityHours ?? null);
  const [responseTimeCommitment, setResponseTimeCommitment] = useState(draft?.responseTimeCommitment || '');
  const [workType, setWorkType] = useState(draft?.workType || '');

  // Agent-facing structured fields
  const [yearsOfExperience, setYearsOfExperience] = useState<number | null>(draft?.yearsOfExperience ?? null);
  const [industries, setIndustries] = useState<string[]>(draft?.industries || []);
  const [equipment, setEquipment] = useState<string[]>(draft?.equipment || []);

  // ─── Profile state ───
  const [emailVerified, setEmailVerified] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [error, setError] = useState('');

  // ─── Refs ───
  const mountedRef = useRef(true);
  const photoPreviewRef = useRef(photoPreview);
  photoPreviewRef.current = photoPreview;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clean up blob URL on unmount to prevent memory leaks
      if (photoPreviewRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewRef.current);
      }
    };
  }, []);

  // Clean up previous blob URL when photoPreview changes
  useEffect(() => {
    return () => {
      // This cleanup will run before the next effect or on unmount
      if (photoPreviewRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreviewRef.current);
      }
    };
  }, [photoPreview]);

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!draft?.timezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) setTimezone(detected);
      } catch { /* timezone detection failed — use default empty value */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs only on mount to detect timezone

  // Load profile from server on mount
  useEffect(() => {
    const abort = new AbortController();
    const storedPhotoUrl = safeLocalStorage.getItem('oauthPhotoUrl');
    if (storedPhotoUrl) setOauthPhotoUrl(storedPhotoUrl);

    loadProfile(abort.signal).finally(() => {
      if (storedPhotoUrl) safeLocalStorage.removeItem('oauthPhotoUrl');
      if (mountedRef.current) setProfileLoading(false);
    });
    return () => abort.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — runs only on mount to load profile

  const loadProfile = async (signal?: AbortSignal) => {
    try {
      const data = await api.getProfile();
      if (signal?.aborted) return;
      analytics.identify(data.id);

      const hasDraft = draft != null;
      if (data.name && !hasDraft) setName(data.name);
      if (data.bio && !hasDraft) setBio(data.bio);
      if (data.location && !hasDraft) setLocation(data.location);
      if (data.neighborhood && !hasDraft) setNeighborhood(data.neighborhood);
      if (data.locationLat != null && !hasDraft) setLocationLat(data.locationLat);
      if (data.locationLng != null && !hasDraft) setLocationLng(data.locationLng);
      if (data.skills?.length && !hasDraft) setSkills(data.skills);
      if (data.languages?.length && !hasDraft) setLanguageEntries(data.languages.map((l: string) => parseLanguageString(l)));
      setEmailVerified(data.emailVerified || false);
      // If user already has name + skills, they've completed onboarding before
      if (data.name?.trim() && data.skills?.length > 0) {
        setProfileCompleted(true);
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      console.error('Failed to load profile:', err);
      if (err?.status === 401 || err?.status === 403) {
        navigate('/login');
      } else {
        toast.error('Failed to load profile. Please refresh.');
      }
    }
  };

  // ─── Photo handlers ───
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo too large. Maximum size is 5MB.');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    setPhotoFile(file);
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    try {
      setPhotoPreview(URL.createObjectURL(file));
    } catch {
      // Blob URL creation failed — fallback to data URL
      const reader = new FileReader();
      reader.onload = () => { if (mountedRef.current && typeof reader.result === 'string') setPhotoPreview(reader.result); };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoRemove = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setOauthPhotoUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // ─── Skill handlers ───
  const toggleSkill = (skill: string) => {
    setSkills((prev) => {
      const idx = prev.findIndex(s => s.toLowerCase() === skill.toLowerCase());
      return idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, skill];
    });
    if (error) setError('');
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (!trimmed) return;
    const exists = skills.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error(`"${trimmed}" is already in your skills`);
      setCustomSkill('');
      setSkillSearch('');
      return;
    }
    setSkills(prev => [...prev, trimmed]);
    setCustomSkill('');
    setSkillSearch('');
    toast.success(`Added "${trimmed}"`);
    if (error) setError('');
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  // ─── Language handlers ───
  const addLanguageEntry = (entry: LanguageEntry) => {
    setLanguageEntries(prev => {
      const existingIndex = prev.findIndex(e => e.language.toLowerCase() === entry.language.toLowerCase());
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], proficiency: entry.proficiency };
        return updated;
      }
      return [...prev, entry];
    });
  };

  const removeLanguageEntry = (index: number) => {
    setLanguageEntries(prev => prev.filter((_, i) => i !== index));
  };

  const updateLanguageEntry = (index: number, updates: Partial<LanguageEntry>) => {
    setLanguageEntries(prev => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  };

  return {
    name, setName, bio, setBio, location, setLocation,
    neighborhood, setNeighborhood, locationLat, setLocationLat, locationLng, setLocationLng,
    photoFile, setPhotoFile, photoPreview, setPhotoPreview, photoInputRef, oauthPhotoUrl, setOauthPhotoUrl,
    handlePhotoChange, handlePhotoRemove,
    skills, setSkills, customSkill, setCustomSkill, skillSearch, setSkillSearch,
    expandedCategories, toggleCategory, toggleSkill, addCustomSkill,
    educationEntries, setEducationEntries,
    languageEntries, setLanguageEntries, addLanguageEntry, removeLanguageEntry, updateLanguageEntry,
    services, setServices,
    linkedinUrl, setLinkedinUrl, githubUrl, setGithubUrl, twitterUrl, setTwitterUrl,
    websiteUrl, setWebsiteUrl, instagramUrl, setInstagramUrl, youtubeUrl, setYoutubeUrl,
    facebookUrl, setFacebookUrl, tiktokUrl, setTiktokUrl,
    externalProfiles, setExternalProfiles, walletAddress, setWalletAddress, username, setUsername,
    whatsappNumber, setWhatsappNumber,
    timezone, setTimezone, weeklyCapacityHours, setWeeklyCapacityHours,
    responseTimeCommitment, setResponseTimeCommitment, workType, setWorkType,
    yearsOfExperience, setYearsOfExperience, industries, setIndustries,
    equipment, setEquipment,
    emailVerified, profileLoading, profileCompleted, error, setError,
    mountedRef, draft,
  };
}
