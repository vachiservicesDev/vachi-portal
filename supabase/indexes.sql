-- Covering indexes for foreign key columns Drizzle doesn't index
-- automatically (only primary keys and explicit .unique() columns get
-- one). Flagged by Supabase's performance advisor and verified fixed
-- against the live project - see README.md "Running this locally".
--
-- Run this after supabase/rls-policies.sql.

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_verified_by ON documents (verified_by);
CREATE INDEX IF NOT EXISTS idx_h1b_paf_employee_id ON h1b_public_access_files (employee_id);
CREATE INDEX IF NOT EXISTS idx_i9_records_section2_completed_by ON i9_records (section2_completed_by);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_documents_session_id ON onboarding_documents (session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created_by ON onboarding_sessions (created_by);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_employee_id ON onboarding_sessions (employee_id);
CREATE INDEX IF NOT EXISTS idx_pay_runs_created_by ON pay_runs (created_by);
CREATE INDEX IF NOT EXISTS idx_pay_stubs_employee_id ON pay_stubs (employee_id);
CREATE INDEX IF NOT EXISTS idx_pay_stubs_pay_run_id ON pay_stubs (pay_run_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_employee_id ON performance_reviews (employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_reviews_reviewer_id ON performance_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet_id ON timesheet_entries (timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_approved_by ON timesheets (approved_by);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_id ON timesheets (employee_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_employee_id ON training_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_task_id ON training_assignments (task_id);
CREATE INDEX IF NOT EXISTS idx_training_comments_assignment_id ON training_comments (assignment_id);
CREATE INDEX IF NOT EXISTS idx_training_comments_author_id ON training_comments (author_id);
CREATE INDEX IF NOT EXISTS idx_training_tasks_created_by ON training_tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_employee_id ON weekly_training_summaries (employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_summaries_reviewed_by ON weekly_training_summaries (reviewed_by);
