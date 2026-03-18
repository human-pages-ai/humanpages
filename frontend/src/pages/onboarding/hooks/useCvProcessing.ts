import { useState, useRef, useEffect } from 'react';
import { api } from '../../../lib/api';
import { posthog } from '../../../lib/posthog';
import toast from 'react-hot-toast';
import type { LanguageEntry, EducationEntry } from '../types';
import { parseLanguageString } from '../utils';

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
  /** Called when CV upload succeeds and data is applied — used for auto-advance */
  onUploadComplete?: () => void;
}

export interface UseCvProcessingReturn {
  cvUploaded: boolean;
  cvData: any;
  cvProcessing: boolean;
  cvInputRef: React.RefObject<HTMLInputElement>;
  handleCVChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  processFile: (file: File) => void;
  checkCvStatus: () => Promise<boolean>;
  setCvUploaded: (v: boolean) => void;
  setCvData: (v: any) => void;
}

export function useCvProcessing(targets: CvAutoFillTargets): UseCvProcessingReturn {
  const [cvUploaded, setCvUploaded] = useState(false);
  const [cvData, setCvData] = useState<any>(null);
  const [cvProcessing, setCvProcessing] = useState(false);

  const cvInputRef = useRef<HTMLInputElement>(null);
  const cvUploadingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cvUploadingRef.current = false;
    };
  }, []);

  /**
   * Auto-fill form fields from parsed CV result.
   * CV data is authoritative for key fields since the user explicitly uploaded it.
   */
  const applyParsedCvData = (result: any) => {
    if (!targets.mountedRef.current) return;

    // Identity — CV always overwrites
    if (result.name) targets.setName(result.name);
    if (result.bio) targets.setBio(result.bio.slice(0, 500));
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
    posthog.capture('cv_uploaded_onboarding', {
      skillsExtracted: skillCount,
      educationCount: result.education?.length || 0,
      certsCount: result.certificates?.length || 0,
      hasSocials: !!(result.linkedinUrl || result.githubUrl),
    });
  };

  /**
   * Check CV processing status. With the synchronous API, CV processing
   * completes during upload, so this always returns the current state.
   */
  const checkCvStatus = (): Promise<boolean> => {
    return Promise.resolve(cvUploaded);
  };

  /** Process a CV file (called from both file input change and drag-and-drop) */
  const processFile = async (file: File) => {
    if (cvUploadingRef.current) return;

    // Reject legacy .doc files
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

    // Show processing state
    cvUploadingRef.current = true;
    setCvProcessing(true);
    setCvUploaded(false);
    setCvData(null);
    if (cvInputRef.current) cvInputRef.current.value = '';

    // Upload and parse — the API does extraction + OpenAI parsing synchronously
    let uploaded = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await api.uploadCV(file);
        if (!targets.mountedRef.current) return;
        applyParsedCvData(result);
        uploaded = true;
        break;
      } catch (err) {
        if (attempt < 2) {
          // Wait before retry: 1.5s, 3s
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
        }
      }
    }

    cvUploadingRef.current = false;
    if (!targets.mountedRef.current) return;
    setCvProcessing(false);

    // Notify parent that upload completed successfully — triggers auto-advance
    if (uploaded && targets.onUploadComplete) {
      targets.onUploadComplete();
    }

    if (!uploaded) {
      toast.error('CV upload failed after multiple attempts. Please try again.');
    }
  };

  /** Handle CV file input change event */
  const handleCVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return {
    cvUploaded,
    cvData,
    cvProcessing,
    cvInputRef,
    handleCVChange,
    processFile,
    checkCvStatus,
    setCvUploaded,
    setCvData,
  };
}
