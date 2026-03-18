/**
 * Step flow engine for the onboarding wizard.
 *
 * Each step is a module identified by a string ID.
 * The flow order changes based on whether the user uploaded a CV.
 * All navigation logic lives here — index.tsx just renders the current step.
 */

/** All possible step IDs */
export type StepId =
  | 'notifications'
  | 'connect'
  | 'cv-upload'
  | 'skills'
  | 'equipment'
  | 'about'
  | 'availability'
  | 'services'
  | 'verification';

export interface StepDef {
  id: StepId;
  label: string;
}

/**
 * Default flow: user has NOT uploaded a CV.
 * They need to fill skills, equipment, etc. manually.
 */
const FLOW_NO_CV: StepDef[] = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'connect',       label: 'Connect' },
  { id: 'cv-upload',     label: 'CV Upload' },
  { id: 'skills',        label: 'Skills' },
  { id: 'equipment',     label: 'Equipment' },
  { id: 'about',         label: 'About You' },
  { id: 'availability',  label: 'Availability' },
  { id: 'services',      label: 'Services' },
  { id: 'verification',  label: 'Verification' },
];

/**
 * CV-uploaded flow: CV pre-fills skills, education, location.
 * We prioritize what CV can't infer: equipment, then verify pre-filled data.
 */
const FLOW_CV_UPLOADED: StepDef[] = [
  { id: 'notifications', label: 'Notifications' },
  { id: 'connect',       label: 'Connect' },
  { id: 'cv-upload',     label: 'CV Upload' },
  { id: 'equipment',     label: 'Equipment' },
  { id: 'about',         label: 'About You' },
  { id: 'skills',        label: 'Skills' },
  { id: 'availability',  label: 'Availability' },
  { id: 'services',      label: 'Services' },
  { id: 'verification',  label: 'Verification' },
];

/** Get the step flow based on CV upload status */
export function getFlow(cvUploaded: boolean): StepDef[] {
  return cvUploaded ? FLOW_CV_UPLOADED : FLOW_NO_CV;
}

/** Get step labels array for the current flow (for progress bar) */
export function getStepLabels(flow: StepDef[]): string[] {
  return flow.map(s => s.label);
}

/** Find the 1-based position of a step ID in a flow */
export function stepIndex(flow: StepDef[], id: StepId): number {
  const idx = flow.findIndex(s => s.id === id);
  return idx === -1 ? 1 : idx + 1;
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
