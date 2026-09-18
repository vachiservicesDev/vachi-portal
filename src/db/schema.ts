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
 * keyed to `auth.users.id`, with RLS policies written against `auth.uid()`
 * as the real authorization boundary (never bypassed via a default
 * service-role client).
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
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
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
  timesheetId: uuid('timesheet_id').references(() => timesheets.id, { onDelete: 'cascade' }),
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

// --- Net-new for Phase 3 (I-9 / E-Verify) — schema stub only, not yet wired
// to any route. Section 2 has a hard 3-business-day-from-hire SLA per USCIS,
// hence `section2DueAt` rather than deriving it ad hoc in application code.
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
  section1CompletedAt: timestamp('section1_completed_at', { withTimezone: true }),
  section2DueAt: date('section2_due_at'), // hire date + 3 business days
  section2CompletedAt: timestamp('section2_completed_at', { withTimezone: true }),
  section3DueAt: date('section3_due_at'), // driven by employees.visa_expiry_date / EAD expiry
  section3CompletedAt: timestamp('section3_completed_at', { withTimezone: true }),
  everifyCaseNumber: varchar('everify_case_number', { length: 100 }),
  everifyStatus: everifyCaseStatusEnum('everify_status').notNull().default('not_created'),
  retentionPurgeEligibleAt: date('retention_purge_eligible_at'), // greater of hire+3yrs / termination+1yr
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
