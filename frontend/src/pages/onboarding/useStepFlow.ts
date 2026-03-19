/**
 * Step flow engine for the onboarding wizard.
 *
 * Each step is a module identified by a string ID.
 * The flow order changes based on whether the user uploaded a CV.
 * All navigation logic lives here — index.tsx just renders the current step.
 *
 * Flow states:
 *   - NO CV:       User fills everything manually. Skills comes early.
 *   - CV (active): User selected a file. Equipment first, skills deferred to verify.
 *                  Used optimistically on file selection AND after confirmed parse.
 *   - Revert:      Upload/parse failed → switches back to NO CV flow.
 */

export type StepId =
  | 'connect'           // Push notifications + Telegram + WhatsApp/SMS
  | 'cv-upload'         // CV upload
  | 'skills'            // Skills selection
  | 'equipment'         // Equipment & tools
  | 'vouch'             // Vouch system + username
  | 'location'          // Location + timezone + languages
  | 'education'         // Education + experience + freelancer history
  | 'payment'           // Payment methods + crypto wallet (Privy)
  | 'services'          // Service offerings + pricing
  | 'profile'           // Photo + name + bio
  | 'availability'      // Availability + hourly rate
  | 'verification';     // GitHub/LinkedIn verify + social presence

export interface StepDef {
  id: StepId;
  label: string;
}

/**
 * Flow when CV is NOT uploaded.
 * User fills everything manually.
 */
const FLOW_NO_CV: StepDef[] = [
  { id: 'connect',       label: 'Connect' },
  { id: 'cv-upload',     label: 'CV' },
  { id: 'skills',        label: 'Skills' },
  { id: 'equipment',     label: 'Equipment' },
  { id: 'vouch',         label: 'Vouch' },
  { id: 'location',      label: 'Location' },
  { id: 'education',     label: 'Education' },
  { id: 'payment',       label: 'Payment' },
  { id: 'services',      label: 'Services' },
  { id: 'profile',       label: 'Profile' },
  { id: 'availability',  label: 'Availability' },
  { id: 'verification',  label: 'Verify' },
];

/**
 * Flow when CV IS uploaded (or optimistically selected).
 * CV pre-fills: skills, location, languages, education (partial),
 * services (partial, no price), profile (partial).
 * So we prioritize what CV can't infer first, then let user verify pre-filled steps.
 *
 * Order: equipment → vouch → payment → skills(verify) → location(verify) →
 *        education(verify) → services(add pricing) → profile(verify) →
 *        availability → verification
 */
const FLOW_CV_UPLOADED: StepDef[] = [
  { id: 'connect',       label: 'Connect' },
  { id: 'cv-upload',     label: 'CV' },
  { id: 'equipment',     label: 'Equipment' },
  { id: 'vouch',         label: 'Vouch' },
  { id: 'payment',       label: 'Payment' },
  { id: 'skills',        label: 'Skills' },
  { id: 'location',      label: 'Location' },
  { id: 'education',     label: 'Education' },
  { id: 'services',      label: 'Services' },
  { id: 'profile',       label: 'Profile' },
  { id: 'availability',  label: 'Availability' },
  { id: 'verification',  label: 'Verify' },
];

/**
 * Get the step flow.
 * @param cvActive — true when we should use the CV flow. This covers both:
 *   - Optimistic: user just selected a file (upload in progress)
 *   - Confirmed: CV parsed successfully and data applied
 *   Set to false to revert (upload/parse failed, or user never uploaded).
 */
export function getFlow(cvActive: boolean): StepDef[] {
  return cvActive ? FLOW_CV_UPLOADED : FLOW_NO_CV;
}

/** Get step labels array for the current flow */
export function getStepLabels(flow: StepDef[]): string[] {
  return flow.map(s => s.label);
}

/** Get the step ID at a 1-based position */
export function stepAt(flow: StepDef[], position: number): StepId {
  const clamped = Math.max(1, Math.min(position, flow.length));
  return flow[clamped - 1].id;
}

/** Total number of steps in the flow */
export function totalSteps(flow: StepDef[]): number {
  return flow.length;
}
