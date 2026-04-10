import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { analytics } from '../../../lib/analytics';
import toast from 'react-hot-toast';
import type { LanguageEntry, EducationEntry } from '../types';
import { parseLanguageString } from '../utils';

// ─── Minimum data thresholds for a "real" CV ───
const MIN_SKILLS_FOR_VALID_CV = 2;
const PARSE_POLL_INTERVAL_MS = 1500;
const PARSE_POLL_MAX_ATTEMPTS = 40; // ~60s max polling

interface CvAutoFillTargets {
  setName: (v: string) => void;
  setBio: (v: string) => void;
  setLocation: (v: string) => void;
  setSkills: React.Dispatch<React.SetStateAction<string[]>>;
  setLanguageEntries: React.Dispatch<React.SetStateAction<LanguageEntry[]>>;
  setEducationEntries: React.Dispatch<React.SetStateAction<EducationEntry[]>>;
  setYearsOfExperience: (v: number | null) => void;
  setLinkedinUrl: (v: string) => void;
  setGithubUrl: (v: string) => void;
  setTwitterUrl: (v: string) => void;
  setWebsiteUrl: (v: string) => void;
  getCurrentSocialUrls: () => { linkedinUrl: string; githubUrl: string; twitterUrl: string; websiteUrl: string };
  setExternalProfiles: React.Dispatch<React.SetStateAction<string[]>>;
  mountedRef: React.MutableRefObject<boolean>;

  /**
   * Stage 1 — called immediately when the user selects a valid file.
   * The parent should advance to the next step (equipment).
   */
  onFileSelected?: () => void;

  /**
   * Stage 2/3 failure — upload failed or CV couldn't be parsed.
   * The parent should revert to FLOW_NO_CV and navigate back to cv-upload.
   */
  onCvFailed?: (reason: string) => void;

  /**
   * Stage 3 success — CV parsed and data applied to form fields.
   * The parent can use this to confirm the CV flow is valid.
   */
  onParseComplete?: () => void;
}

export type CvStage = 'idle' | 'uploading' | 'parsing' | 'done' | 'failed';

export interface UseCvProcessingReturn {
  cvUploaded: boolean;
  cvData: any;
  cvStage: CvStage;
  /** True when upload or parsing is in progress (convenience flag for UI spinners) */
  cvProcessing: boolean;
  cvInputRef: React.RefObject<HTMLInputElement>;
  handleCVChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFile: (file: File) => void;
  checkCvStatus: () => Promise<boolean>;
  setCvUploaded: (v: boolean) => void;
  setCvData: (v: any) => void;
  /** Retry the CV upload/parsing after failure */
  retryCvUpload: (file: File) => void;
  /** Current file being processed (for display) */
  currentFile: File | null;
}

export function useCvProcessing(targets: CvAutoFillTargets): UseCvProcessingReturn {
  const [cvUploaded, setCvUploaded] = useState(false);
  const [cvData, setCvData] = useState<any>(null);
  const [cvStage, setCvStage] = useState<CvStage>('idle');
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const cvUploadingRef = useRef(false);

  // Derived convenience flag (backward compat for UI spinners)
  const cvProcessing = cvStage === 'uploading' || cvStage === 'parsing';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cvUploadingRef.current = false;
    };
  }, []);

  // ─── Data quality check ───
  const validateCvData = useCallback((result: any): { valid: boolean; reason: string } => {
    if (!result) {
      return { valid: false, reason: 'CV parsing returned no data. Please try a different file.' };
    }

    const skillCount =
      (result.skills?.explicit?.length || 0) + (result.skills?.inferred?.length || 0);
    const hasName = !!result.name;

    // Must have at least some skills — this is the primary signal it's a real CV
    if (skillCount < MIN_SKILLS_FOR_VALID_CV) {
      return {
        valid: false,
        reason: hasName
          ? "We couldn't find enough skills in your CV. Please upload a more detailed resume, or skip to add skills manually."
          : "This file doesn't appear to be a CV/resume. Please upload your CV or skip this step.",
      };
    }

    return { valid: true, reason: '' };
  }, []);

  /**
   * Auto-fill form fields from parsed CV result.
   * CV data is authoritative for key fields since the user explicitly uploaded it.
   */
  const applyParsedCvData = useCallback((result: any) => {
    if (!targets.mountedRef.current) return;

    // Identity — CV always overwrites
    if (result.name) targets.setName(result.name);
    if (result.bio) {
      let bio = result.bio;
      // Strip personal info that the CV parser might include in the bio
      if (result.name) bio = bio.replace(new RegExp(result.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim();
      bio = bio.replace(/^[A-Z][a-z]+ [A-Z][a-z]+ (is |was |has |have |been )/i, '').trim();
      bio = bio.replace(/[\w.-]+@[\w.-]+\.\w+/g, '').trim();
      bio = bio.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '').trim();
      bio = bio.replace(/\s{2,}/g, ' ').replace(/^[,;.\s]+/, '').trim();
      targets.setBio(bio.slice(0, 500));
    }
    if (result.location) targets.setLocation(result.location);

    // Skills (merge, case-insensitive dedup)
    if (result.skills) {
      const allSkills = [...(result.skills.explicit || []), ...(result.skills.inferred || [])];
      if (allSkills.length > 0) {
        targets.setSkills(prev => {
          const seen = new Set(prev.map(s => s.toLowerCase()));
          const merged = [...prev];
          for (const skill of allSkills) {
            if (!seen.has(skill.toLowerCase())) {
              seen.add(skill.toLowerCase());
              merged.push(skill);
            }
          }
          return merged;
        });
      }
    }

    // Languages
    if (result.languages?.length) {
      targets.setLanguageEntries(prev => {
        const seen = new Set(prev.map(e => e.language.toLowerCase()));
        const merged = [...prev];
        for (const langStr of result.languages) {
          const entry = parseLanguageString(langStr);
          if (!seen.has(entry.language.toLowerCase())) {
            seen.add(entry.language.toLowerCase());
            merged.push(entry);
          }
        }
        return merged;
      });
    }

    // Education
    if (result.education?.length) {
      targets.setEducationEntries(prev => {
        const existing = new Set(prev.map(e => `${e.institution}-${e.degree}-${e.field}`.toLowerCase()));
        const merged = [...prev];
        for (const edu of result.education) {
          const key = `${edu.institution}-${edu.degree}-${edu.field}`.toLowerCase();
          if (!existing.has(key)) {
            existing.add(key);
            merged.push({
              institution: edu.institution || '',
              degree: edu.degree || edu.field || '',
              field: edu.field || '',
              country: edu.country || '',
              startYear: undefined,
              endYear: edu.year,
            });
          }
        }
        return merged;
      });
    }

    // Years of Experience
    if (result.yearsOfExperience != null) {
      targets.setYearsOfExperience(result.yearsOfExperience);
    }

    // Social links (auto-fill only if empty)
    const currentUrls = targets.getCurrentSocialUrls();
    if (result.linkedinUrl && !currentUrls.linkedinUrl) targets.setLinkedinUrl(result.linkedinUrl);
    if (result.githubUrl && !currentUrls.githubUrl) targets.setGithubUrl(result.githubUrl);
    if (result.twitterUrl && !currentUrls.twitterUrl) targets.setTwitterUrl(result.twitterUrl);
    if (result.websiteUrl && !currentUrls.websiteUrl) targets.setWebsiteUrl(result.websiteUrl);

    // External profiles
    if (result.externalProfileUrls?.length) {
      targets.setExternalProfiles((prev: string[]) => {
        const seen = new Set(prev.map((u: string) => u.toLowerCase()));
        const merged = [...prev];
        for (const url of result.externalProfileUrls) {
          if (!seen.has(url.toLowerCase()) && merged.length < 10) {
            seen.add(url.toLowerCase());
            merged.push(url);
          }
        }
        return merged;
      });
    }

    setCvData(result);
    setCvUploaded(true);

    const skillCount = (result.skills?.explicit?.length || 0) + (result.skills?.inferred?.length || 0);
    const fieldsPopulated = [
      result.name, result.bio, result.location,
      skillCount > 0, result.education?.length,
      result.certificates?.length,
      result.linkedinUrl, result.githubUrl,
    ].filter(Boolean).length;

    toast.success(`CV analyzed! ${fieldsPopulated} sections auto-filled.`);
    analytics.track('cv_uploaded_onboarding', {
      skillsExtracted: skillCount,
      educationCount: result.education?.length || 0,
      certsCount: result.certificates?.length || 0,
      hasSocials: !!(result.linkedinUrl || result.githubUrl),
    });
  }, [targets]);

  /**
   * Check CV processing status. With the synchronous API, CV processing
   * completes during upload, so this always returns the current state.
   */
  const checkCvStatus = (): Promise<boolean> => {
    return Promise.resolve(cvUploaded);
  };

  // ─── Stage 2: Upload file to server ───
  const uploadFile = async (file: File): Promise<string | null> => {
    setCvStage('uploading');

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { fileId } = await api.uploadCvFile(file);
        return fileId;
      } catch (err) {
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
        }
      }
    }
    return null;
  };

  // ─── Stage 3: Poll for parse result ───
  const pollParseResult = async (fileId: string): Promise<any | null> => {
    setCvStage('parsing');

    for (let attempt = 0; attempt < PARSE_POLL_MAX_ATTEMPTS; attempt++) {
      try {
        const res = await api.pollCvParse(fileId);

        if (res.status === 'complete' && res.data) {
          return res.data;
        }
        if (res.status === 'failed') {
          return null;
        }
        // status === 'pending' — keep polling
      } catch {
        // Network blip — keep polling
      }

      await new Promise(resolve => setTimeout(resolve, PARSE_POLL_INTERVAL_MS));
    }

    return null; // Timed out
  };

  /** Format file size for display */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** Process a CV file — 3-stage pipeline */
  const processFile = async (file: File) => {
    if (cvUploadingRef.current) return;

    // ─── Stage 1: Client-side validation ───
    const isDoc = file.type === 'application/msword' || /\.doc$/i.test(file.name);
    if (isDoc) {
      toast.error('Legacy .doc format is not supported. Please save as .docx or .pdf.');
      return;
    }
    if (!file.type.includes('pdf') && !file.type.includes('word') && !file.name.endsWith('.docx') && !file.name.endsWith('.pdf')) {
      toast.error('Please upload a PDF or Word document');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    // File is valid — advance immediately
    cvUploadingRef.current = true;
    setCvUploaded(false);
    setCvData(null);
    setCvStage('uploading');
    setCurrentFile(file);
    const fileSizeStr = formatFileSize(file.size);
    toast.loading(`Uploading ${file.name} (${fileSizeStr})... Please wait, this may take a moment on slow connections.`, { id: 'cv-upload' });
    if (cvInputRef.current) cvInputRef.current.value = '';

    // Notify parent to advance to equipment NOW (before upload starts)
    if (targets.onFileSelected) {
      targets.onFileSelected();
    }

    // ─── Stage 2: Upload to server ───
    const fileId = await uploadFile(file);
    if (!targets.mountedRef.current) { cvUploadingRef.current = false; return; }

    if (!fileId) {
      cvUploadingRef.current = false;
      setCvStage('failed');
      const uploadErrMsg = 'CV upload failed — your connection may be too slow. Please check your internet and try again.';
      toast.error(uploadErrMsg);
      if (targets.onCvFailed) {
        targets.onCvFailed(uploadErrMsg);
      }
      return;
    }

    // Progress update after successful upload
    toast.loading('Analyzing your CV... (this may take a moment)', { id: 'cv-upload' });
    setCvStage('parsing');

    // ─── Stage 3: Poll for parsed result ───
    const result = await pollParseResult(fileId);
    cvUploadingRef.current = false;
    if (!targets.mountedRef.current) return;

    if (!result) {
      setCvStage('failed');
      const parseErrMsg = 'CV analysis timed out. Please check your connection and try again.';
      toast.error(parseErrMsg);
      if (targets.onCvFailed) {
        targets.onCvFailed(parseErrMsg);
      }
      return;
    }

    // ─── Data quality validation ───
    const { valid, reason } = validateCvData(result);
    if (!valid) {
      setCvStage('failed');
      toast.error(reason);
      analytics.track('cv_quality_rejected', {
        skillCount: (result.skills?.explicit?.length || 0) + (result.skills?.inferred?.length || 0),
        hasName: !!result.name,
        hasEducation: (result.education?.length || 0) > 0,
      });
      if (targets.onCvFailed) {
        targets.onCvFailed(reason);
      }
      return;
    }

    // ─── All good — apply data ───
    applyParsedCvData(result);
    setCvStage('done');
    toast.success('CV analyzed successfully!', { id: 'cv-upload' });

    if (targets.onParseComplete) {
      targets.onParseComplete();
    }
  };

  /** Retry a failed CV upload/parse with the same file */
  const retryCvUpload = (file: File) => {
    processFile(file);
  };

  /** Handle CV file input change event */
  const handleCVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return {
    cvUploaded,
    cvData,
    cvStage,
    cvProcessing,
    cvInputRef,
    handleCVChange,
    processFile,
    checkCvStatus,
    setCvUploaded,
    setCvData,
    retryCvUpload,
    currentFile,
  };
}
