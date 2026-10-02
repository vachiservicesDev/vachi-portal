import type { Tone } from '@/components/ui/ui';

// Plain-English labels and chip tones for every status the database stores.
// Green ("live") is reserved for done / verified, as in the design system.

type Entry = { label: string; tone: Tone };

const STATUSES: Record<string, Record<string, Entry>> = {
  timesheet: {
    draft: { label: 'Draft', tone: 'draft' },
    submitted: { label: 'Awaiting approval', tone: 'new' },
    approved: { label: 'Approved', tone: 'live' },
    rejected: { label: 'Returned', tone: 'danger' },
  },
  summary: {
    draft: { label: 'Draft', tone: 'draft' },
    submitted: { label: 'Awaiting review', tone: 'new' },
    approved: { label: 'Approved', tone: 'live' },
    rejected: { label: 'Returned', tone: 'danger' },
  },
  review: {
    draft: { label: 'Draft', tone: 'draft' },
    submitted: { label: 'Shared with employee', tone: 'new' },
    approved: { label: 'Acknowledged', tone: 'live' },
    rejected: { label: 'Rejected', tone: 'danger' },
  },
  onboarding: {
    draft: { label: 'Draft', tone: 'draft' },
    sent: { label: 'Sent', tone: 'new' },
    in_progress: { label: 'In progress', tone: 'info' },
    completed: { label: 'Completed', tone: 'live' },
    cancelled: { label: 'Cancelled', tone: 'muted' },
  },
  onboardingDocument: {
    pending_generation: { label: 'Not generated yet', tone: 'draft' },
    generated: { label: 'Ready to send', tone: 'info' },
    sent_for_signature: { label: 'Out for signature', tone: 'new' },
    signed: { label: 'Signed', tone: 'live' },
    failed: { label: 'Failed', tone: 'danger' },
  },
  i9: {
    section1_pending: { label: 'Waiting on employee (Section 1)', tone: 'new' },
    section2_pending: { label: 'Waiting on HR (Section 2)', tone: 'warning' },
    complete: { label: 'Complete', tone: 'live' },
    reverification_due: { label: 'Reverification due', tone: 'danger' },
    purge_eligible: { label: 'Eligible for purge', tone: 'muted' },
  },
  everify: {
    not_created: { label: 'Not created', tone: 'draft' },
    submitted: { label: 'Submitted', tone: 'new' },
    employment_authorized: { label: 'Employment authorized', tone: 'live' },
    tentative_nonconfirmation: { label: 'Tentative nonconfirmation', tone: 'warning' },
    final_nonconfirmation: { label: 'Final nonconfirmation', tone: 'danger' },
    closed: { label: 'Closed', tone: 'muted' },
  },
  training: {
    assigned: { label: 'Not started', tone: 'new' },
    in_progress: { label: 'In progress', tone: 'info' },
    completed: { label: 'Completed', tone: 'live' },
    failed: { label: 'Failed', tone: 'danger' },
    expired: { label: 'Expired', tone: 'muted' },
  },
  stemOpt: {
    active: { label: 'Active', tone: 'info' },
    evaluation_due: { label: 'Evaluation due', tone: 'warning' },
    completed: { label: 'Completed', tone: 'live' },
    terminated: { label: 'Terminated', tone: 'muted' },
  },
  greenCard: {
    perm_prep: { label: 'PERM preparation', tone: 'info' },
    perm_filed: { label: 'PERM filed', tone: 'info' },
    perm_certified: { label: 'PERM certified', tone: 'new' },
    i140_filed: { label: 'I-140 filed', tone: 'info' },
    i140_approved: { label: 'I-140 approved', tone: 'new' },
    i485_filed: { label: 'I-485 filed', tone: 'info' },
    i485_approved: { label: 'I-485 approved', tone: 'live' },
    denied: { label: 'Denied', tone: 'danger' },
  },
  payRun: {
    draft: { label: 'Draft', tone: 'draft' },
    processed: { label: 'Processed', tone: 'live' },
  },
  employee: {
    active: { label: 'Active', tone: 'live' },
    pending: { label: 'Pending start', tone: 'new' },
    inactive: { label: 'Inactive', tone: 'muted' },
  },
};

export type StatusKind = keyof typeof STATUSES;

function humanize(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusOf(kind: StatusKind, value: string | null | undefined): Entry {
  if (!value) return { label: '—', tone: 'muted' };
  return STATUSES[kind]?.[value] ?? { label: humanize(value), tone: 'muted' };
}

export const GREEN_CARD_STAGES = Object.entries(STATUSES.greenCard).map(([value, e]) => ({ value, label: e.label }));

export const VISA_TYPES = [
  { value: 'OPT', label: 'F-1 OPT' },
  { value: 'STEM_OPT', label: 'F-1 STEM OPT' },
  { value: 'H1B', label: 'H-1B' },
  { value: 'L1', label: 'L-1' },
  { value: 'O1', label: 'O-1' },
  { value: 'TN', label: 'TN' },
  { value: 'E3', label: 'E-3' },
  { value: 'Other', label: 'Other / not applicable' },
];

export function visaLabel(value: string | null | undefined): string {
  return VISA_TYPES.find((v) => v.value === value)?.label ?? value ?? '—';
}

export const TRAINING_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'safety', label: 'Safety' },
  { value: 'technical', label: 'Technical' },
];

export const TRAINING_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function labelFrom(list: { value: string; label: string }[], value: string | null | undefined): string {
  return list.find((o) => o.value === value)?.label ?? (value ? humanize(value) : '—');
}

export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(' ') || 'Unnamed employee';
}
