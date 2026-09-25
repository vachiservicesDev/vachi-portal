import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  decimal,
  date,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Owned by this project from day one — no legacy schema to reconcile
 * against. Auth lives in Supabase's own `auth.users` table (native Supabase
 * Auth); `profiles` holds only the app-specific fields (role, is_active)
 * keyed to `auth.users.id`.
 *
 * Authorization note: Drizzle here connects via DATABASE_URL (a direct
 * Postgres connection), which runs with a privileged role and BYPASSES
 * RLS — same as the Supabase service-role client would. Every route that
 * queries through `db` (this file's tables) is responsible for its own
 * authorization check in application code (see src/lib/auth/requireAdmin.ts
 * and the explicit `eq(profiles.id, user.id)`-style scoping used
 * throughout) — RLS is NOT enforcing anything on that path. RLS policies
 * (see supabase/rls-policies.sql) still matter as defense-in-depth for any
 * access that goes through Supabase's anon-key client directly (e.g.
 * client-side Realtime subscriptions, planned for Phase 7) — just not for
 * Drizzle queries.
 */

export const roleEnum = pgEnum('role', ['admin', 'employee']);
export const visaTypeEnum = pgEnum('visa_type', [
  'OPT',
  'STEM_OPT',
  'H1B',
  'L1',
  'O1',
  'TN',
  'E3',
  'Other',
]);
export const employeeStatusEnum = pgEnum('employee_status', ['active', 'inactive', 'pending']);
export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
]);
export const timesheetStatusEnum = pgEnum('timesheet_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

// Profile row for every Supabase Auth user. id == auth.users.id (not a
// foreign key in Drizzle since auth.users lives in a schema Drizzle doesn't
// manage; enforced in Postgres via a trigger on auth.users insert instead).
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: roleEnum('role').notNull().default('employee'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .unique()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  visaType: visaTypeEnum('visa_type').notNull().default('Other'),
  visaStartDate: date('visa_start_date'),
  visaExpiryDate: date('visa_expiry_date'),
  status: employeeStatusEnum('status').notNull().default('active'),
  phoneNumber: varchar('phone_number', { length: 20 }),
  address: text('address'),
  emergencyContact: jsonb('emergency_contact').default({}),
  complianceScore: integer('compliance_score').default(0),
  managerId: uuid('manager_id'),
  department: varchar('department', { length: 100 }),
  position: varchar('position', { length: 100 }),
  startDate: date('start_date'),
  profilePictureUrl: text('profile_picture_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  issueDate: date('issue_date'),
  expiryDate: date('expiry_date'),
  status: documentStatusEnum('status').notNull().default('pending'),
  verifiedBy: uuid('verified_by').references(() => profiles.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verificationNotes: text('verification_notes'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const timesheets = pgTable('timesheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  weekStarting: date('week_starting').notNull(),
  weekEnding: date('week_ending').notNull(),
  totalHours: decimal('total_hours', { precision: 5, scale: 2 }).notNull().default('0'),
  overtimeHours: decimal('overtime_hours', { precision: 5, scale: 2 }).default('0'),
  status: timesheetStatusEnum('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => profiles.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const timesheetEntries = pgTable('timesheet_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  timesheetId: uuid('timesheet_id')
    .notNull()
    .references(() => timesheets.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  hours: decimal('hours', { precision: 4, scale: 2 }).notNull().default('0'),
  projectCode: varchar('project_code', { length: 50 }),
  taskDescription: text('task_description'),
  isOvertime: boolean('is_overtime').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  priority: varchar('priority', { length: 50 }).notNull().default('medium'),
  status: varchar('status', { length: 50 }).notNull().default('unread'),
  actionUrl: text('action_url'),
  actionLabel: varchar('action_label', { length: 100 }),
  metadata: jsonb('metadata').default({}),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 2 (Onboarding) ---
export const employmentTypeEnum = pgEnum('employment_type', ['w2', '1099']);
export const onboardingSessionStatusEnum = pgEnum('onboarding_session_status', [
  'draft',
  'sent',
  'in_progress',
  'completed',
  'cancelled',
]);
export const onboardingDocumentStatusEnum = pgEnum('onboarding_document_status', [
  'pending_generation',
  'generated',
  'sent_for_signature',
  'signed',
  'failed',
]);

export const onboardingSessions = pgTable('onboarding_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  employmentType: employmentTypeEnum('employment_type').notNull(),
  status: onboardingSessionStatusEnum('status').notNull().default('draft'),
  // Free-form intake data (name, dates, CPT/OPT/SEVIS fields, etc.) used to
  // fill generated documents. Kept as JSONB since the field set varies by
  // employment type and grows over time; not duplicated into structured
  // columns the way the legacy app did (that caused drift between the two).
  formData: jsonb('form_data').default({}),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const onboardingDocuments = pgTable('onboarding_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => onboardingSessions.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 100 }).notNull(),
  status: onboardingDocumentStatusEnum('status').notNull().default('pending_generation'),
  // Path within the `onboarding-documents` Supabase Storage bucket.
  generatedFilePath: text('generated_file_path'),
  signatureProvider: varchar('signature_provider', { length: 50 }), // 'dropbox_sign' | 'docusign'
  signatureRequestId: varchar('signature_request_id', { length: 255 }),
  signedFilePath: text('signed_file_path'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 3 (I-9 / E-Verify). Section 2 has a hard 3-business-day-from-hire
// SLA per USCIS, hence `section2DueAt` rather than deriving it ad hoc in
// application code every time it's displayed.
export const i9RecordStatusEnum = pgEnum('i9_record_status', [
  'section1_pending',
  'section2_pending',
  'complete',
  'reverification_due',
  'purge_eligible',
]);

export const everifyCaseStatusEnum = pgEnum('everify_case_status', [
  'not_created',
  'submitted',
  'employment_authorized',
  'tentative_nonconfirmation',
  'final_nonconfirmation',
  'closed',
]);

export const i9Records = pgTable('i9_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .unique()
    .references(() => employees.id, { onDelete: 'cascade' }),
  status: i9RecordStatusEnum('status').notNull().default('section1_pending'),

  // Section 1 (employee self-entry): name/DOB/contact plus the citizenship
  // /immigration-status attestation and its related identifiers. Kept as
  // JSONB since the required fields branch heavily by attestation type
  // (citizen vs. permanent resident vs. alien authorized to work) and this
  // isn't the system of record for identity data (employees table is).
  section1Data: jsonb('section1_data'),
  section1SignedByName: varchar('section1_signed_by_name', { length: 200 }),
  section1CompletedAt: timestamp('section1_completed_at', { withTimezone: true }),

  // Section 2 (employer verification, within 3 business days of the start
  // date entered on Section 1 per USCIS rules).
  section2DueAt: date('section2_due_at'),
  section2Data: jsonb('section2_data'), // document list/title/number/expiration examined
  section2CompletedBy: uuid('section2_completed_by').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  section2CompletedAt: timestamp('section2_completed_at', { withTimezone: true }),

  // Section 3 (reverification), driven by employees.visa_expiry_date.
  section3DueAt: date('section3_due_at'),
  section3CompletedAt: timestamp('section3_completed_at', { withTimezone: true }),

  everifyCaseNumber: varchar('everify_case_number', { length: 100 }),
  everifyStatus: everifyCaseStatusEnum('everify_status').notNull().default('not_created'),
  everifySubmittedAt: timestamp('everify_submitted_at', { withTimezone: true }),

  // Greater of (hire date + 3 years) and (termination date + 1 year); null
  // while still employed, since the "whichever is later" clock hasn't
  // started until there's a termination date.
  retentionPurgeEligibleAt: date('retention_purge_eligible_at'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 4 (Training) — one consolidated system. The legacy app had two
// competing training implementations (an in-use "legacy" one and an
// unused, better-architected "v2" one that never got adopted); this is
// designed as a single system from the start instead of repeating that.
export const trainingTypeEnum = pgEnum('training_type', [
  'general',
  'compliance',
  'safety',
  'technical',
]);
export const trainingPriorityEnum = pgEnum('training_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);
export const trainingAssignmentStatusEnum = pgEnum('training_assignment_status', [
  'assigned',
  'in_progress',
  'completed',
  'failed',
  'expired',
]);
export const weeklySummaryStatusEnum = pgEnum('weekly_summary_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
]);
export const performanceReviewStatusEnum = pgEnum('performance_review_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
]);

export const trainingTasks = pgTable('training_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: trainingTypeEnum('type').notNull().default('general'),
  priority: trainingPriorityEnum('priority').notNull().default('medium'),
  dueDate: date('due_date'),
  estimatedDurationMinutes: integer('estimated_duration_minutes'),
  // Link to the actual training content/materials (a doc, video, slide
  // deck, etc.) - a full materials-upload subsystem with its own Storage
  // bucket is still open; this covers "point people at the material" today.
  contentUrl: text('content_url'),
  isMandatory: boolean('is_mandatory').default(false),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const trainingAssignments = pgTable('training_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => trainingTasks.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  status: trainingAssignmentStatusEnum('status').notNull().default('assigned'),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  score: integer('score'),
  timeSpentMinutes: integer('time_spent_minutes').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const trainingComments = pgTable('training_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => trainingAssignments.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const weeklyTrainingSummaries = pgTable('weekly_training_summaries', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  weekStarting: date('week_starting').notNull(),
  weekEnding: date('week_ending').notNull(),
  content: text('content').notNull(),
  status: weeklySummaryStatusEnum('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => profiles.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewComments: text('review_comments'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const performanceReviews = pgTable('performance_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'set null' }),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  rating: integer('rating'), // 1-5
  strengths: text('strengths'),
  areasForImprovement: text('areas_for_improvement'),
  goals: text('goals'),
  status: performanceReviewStatusEnum('status').notNull().default('draft'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  employeeAcknowledgedAt: timestamp('employee_acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 5 (Payroll). Vendor (Gusto/Check/ADP) is still an open decision
// (docs/PLAN.md) - rather than guess, this is a provider-agnostic pay-run
// record that works today via manual entry (an admin runs payroll through
// whatever they currently use and records the results here) and is ready
// for a real provider adapter to populate it automatically later, the same
// pattern as src/lib/everify.
export const payRunStatusEnum = pgEnum('pay_run_status', ['draft', 'processed']);

export const payRuns = pgTable('pay_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  payPeriodStart: date('pay_period_start').notNull(),
  payPeriodEnd: date('pay_period_end').notNull(),
  payDate: date('pay_date').notNull(),
  status: payRunStatusEnum('status').notNull().default('draft'),
  provider: varchar('provider', { length: 50 }).notNull().default('manual'), // 'manual' | future: 'gusto' | 'check' | 'adp'
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payStubs = pgTable('pay_stubs', {
  id: uuid('id').defaultRandom().primaryKey(),
  payRunId: uuid('pay_run_id')
    .notNull()
    .references(() => payRuns.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  grossPay: decimal('gross_pay', { precision: 10, scale: 2 }).notNull(),
  netPay: decimal('net_pay', { precision: 10, scale: 2 }).notNull(),
  deductions: jsonb('deductions').default({}), // { federal_tax, state_tax, fica, benefits, ... }
  filePath: text('file_path'), // optional PDF in the payroll-documents bucket - upload not yet wired up
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 6 (Immigration & compliance modules). The immigration-tracker
// "dashboard" itself isn't a new table - it's a view over employees +
// documents (visa_expiry_date, document expiry) already in the schema.
// What's net-new here is the deeper case-management data the legacy app
// never had at all.

export const stemOptStatusEnum = pgEnum('stem_opt_status', [
  'active',
  'evaluation_due',
  'completed',
  'terminated',
]);

// STEM OPT I-983 Training Plan - required for the 24-month STEM extension.
// USCIS requires self-evaluations at the 12-month mark and a final
// evaluation at completion; this tracks those two dates explicitly rather
// than deriving them ad hoc, the same reasoning as i9Records.section2DueAt.
export const stemOptTrainingPlans = pgTable('stem_opt_training_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .unique()
    .references(() => employees.id, { onDelete: 'cascade' }),
  employerName: varchar('employer_name', { length: 255 }).notNull(),
  i983SubmittedAt: date('i983_submitted_at'),
  trainingStartDate: date('training_start_date'),
  trainingEndDate: date('training_end_date'), // up to 24 months after start
  selfEvaluationDueAt: date('self_evaluation_due_at'), // 12-month mark
  selfEvaluationCompletedAt: timestamp('self_evaluation_completed_at', { withTimezone: true }),
  finalEvaluationDueAt: date('final_evaluation_due_at'), // at trainingEndDate
  finalEvaluationCompletedAt: timestamp('final_evaluation_completed_at', { withTimezone: true }),
  status: stemOptStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// H-1B Public Access File - required for every H-1B petition. The LCA
// (Labor Condition Application) must be posted for 10 consecutive business
// days before filing; postingStartDate/EndDate track that, separate from
// lcaFilingDate itself.
export const h1bPublicAccessFiles = pgTable('h1b_public_access_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  lcaCaseNumber: varchar('lca_case_number', { length: 100 }).notNull(),
  lcaFilingDate: date('lca_filing_date').notNull(),
  worksite: text('worksite').notNull(),
  wageLevel: varchar('wage_level', { length: 10 }), // I-IV per DOL prevailing wage levels
  prevailingWage: decimal('prevailing_wage', { precision: 10, scale: 2 }),
  actualWage: decimal('actual_wage', { precision: 10, scale: 2 }),
  postingStartDate: date('posting_start_date'),
  postingEndDate: date('posting_end_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const greenCardStageEnum = pgEnum('green_card_stage', [
  'perm_prep',
  'perm_filed',
  'perm_certified',
  'i140_filed',
  'i140_approved',
  'i485_filed',
  'i485_approved',
  'denied',
]);

export const greenCardCases = pgTable('green_card_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .unique()
    .references(() => employees.id, { onDelete: 'cascade' }),
  stage: greenCardStageEnum('stage').notNull().default('perm_prep'),
  priorityDate: date('priority_date'),
  stageUpdatedAt: timestamp('stage_updated_at', { withTimezone: true }).defaultNow().notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Phase 7 (Messaging). Direct 1:1 messages between two profiles -
// there's no "thread" table; a conversation is just every message where
// (sender, recipient) is one of the two pairings between two users. Live
// delivery is via Supabase Realtime's postgres_changes on this table
// (src/app/(dashboard)/messages), which is why this goes through the
// anon-key Supabase client on the read side even though writes go through
// Drizzle like everything else - Realtime subscriptions only work through
// Supabase's own client.
export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderId: uuid('sender_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
