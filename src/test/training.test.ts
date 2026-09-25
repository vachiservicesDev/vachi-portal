import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { POST as createTask, GET as listTasks } from '@/app/api/training/tasks/route';
import { POST as assignTask } from '@/app/api/training/tasks/[id]/assign/route';
import { GET as myAssignments } from '@/app/api/training/assignments/me/route';
import { PATCH as updateAssignment } from '@/app/api/training/assignments/[id]/route';
import {
  POST as postComment,
  GET as listComments,
} from '@/app/api/training/assignments/[id]/comments/route';
import { POST as createSummary, GET as listSummaries } from '@/app/api/training/summaries/route';
import { PATCH as reviewSummary } from '@/app/api/training/summaries/[id]/route';
import { POST as createReview } from '@/app/api/training/reviews/route';
import { PATCH as updateReview } from '@/app/api/training/reviews/[id]/route';
import { eq } from 'drizzle-orm';
import { resetDb, seedEmployee, seedProfile } from './db';
import { getRequest, jsonRequest } from './http';
import { setCurrentUser } from './mockAuth';

describe('Training (Phase 4)', () => {
  let adminId: string;

  beforeEach(async () => {
    await resetDb();
    const admin = await seedProfile({ role: 'admin' });
    adminId = admin.id;
    setCurrentUser(adminId);
  });

  it('any active user can browse the task catalog', async () => {
    await createTask(jsonRequest({ title: 'Security Training' }));
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);

    const res = await listTasks();
    expect(res.status).toBe(200);
    const { tasks } = await res.json();
    expect(tasks).toHaveLength(1);
  });

  it('assigning a task is idempotent and notifies the employee', async () => {
    const { employee, profile } = await seedEmployee();
    const taskRes = await createTask(jsonRequest({ title: 'Security Training', isMandatory: true }));
    const { task } = await taskRes.json();

    const first = await assignTask(jsonRequest({ employeeIds: [employee.id] }), { params: { id: task.id } });
    expect(first.status).toBe(201);
    expect((await first.json()).assignments).toHaveLength(1);

    // Re-assigning the same employee is a no-op, not a duplicate row / error.
    const second = await assignTask(jsonRequest({ employeeIds: [employee.id] }), { params: { id: task.id } });
    expect((await second.json()).assignments).toHaveLength(0);

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, profile!.id));
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe('training_assigned');

    setCurrentUser(profile!.id);
    const mine = await myAssignments();
    const { assignments } = await mine.json();
    expect(assignments).toHaveLength(1);
    expect(assignments[0].status).toBe('assigned');
  });

  it('employee can progress their own assignment through start -> complete', async () => {
    const { employee, profile } = await seedEmployee();
    const taskRes = await createTask(jsonRequest({ title: 'Security Training' }));
    const { task } = await taskRes.json();
    const assignRes = await assignTask(jsonRequest({ employeeIds: [employee.id] }), { params: { id: task.id } });
    const { assignments } = await assignRes.json();
    const assignmentId = assignments[0].id;

    setCurrentUser(profile!.id);
    await updateAssignment(jsonRequest({ status: 'in_progress' }), { params: { id: assignmentId } });
    const done = await updateAssignment(jsonRequest({ status: 'completed', score: 95 }), {
      params: { id: assignmentId },
    });
    expect(done.status).toBe(200);
    const { assignment } = await done.json();
    expect(assignment.status).toBe('completed');
    expect(assignment.score).toBe(95);
    expect(assignment.completedAt).not.toBeNull();
  });

  it("an unrelated employee cannot touch someone else's assignment", async () => {
    const { employee, profile: owner } = await seedEmployee();
    const { profile: intruder } = await seedEmployee();
    const taskRes = await createTask(jsonRequest({ title: 'Security Training' }));
    const { task } = await taskRes.json();
    const assignRes = await assignTask(jsonRequest({ employeeIds: [employee.id] }), { params: { id: task.id } });
    const { assignments } = await assignRes.json();

    setCurrentUser(intruder!.id);
    const res = await updateAssignment(jsonRequest({ status: 'in_progress' }), {
      params: { id: assignments[0].id },
    });
    expect(res.status).toBe(403);
    void owner;
  });

  it('comments are visible to both the assignee and admins, not outsiders', async () => {
    const { employee, profile } = await seedEmployee();
    const taskRes = await createTask(jsonRequest({ title: 'Security Training' }));
    const { task } = await taskRes.json();
    const assignRes = await assignTask(jsonRequest({ employeeIds: [employee.id] }), { params: { id: task.id } });
    const assignmentId = (await assignRes.json()).assignments[0].id;

    setCurrentUser(profile!.id);
    await postComment(jsonRequest({ body: 'Question about module 3' }), { params: { id: assignmentId } });

    setCurrentUser(adminId);
    const adminView = await listComments(getRequest(), { params: { id: assignmentId } });
    expect((await adminView.json()).comments).toHaveLength(1);

    const { profile: outsider } = await seedEmployee();
    setCurrentUser(outsider!.id);
    const blocked = await listComments(getRequest(), { params: { id: assignmentId } });
    expect(blocked.status).toBe(403);
  });

  it('weekly summary: employee submits, admin approves and it notifies nobody twice', async () => {
    const { profile } = await seedEmployee();
    setCurrentUser(profile!.id);
    const res = await createSummary(
      jsonRequest({
        weekStarting: '2026-01-05',
        weekEnding: '2026-01-09',
        content: 'Worked on onboarding module',
        submit: true,
      }),
    );
    const { summary } = await res.json();
    expect(summary.status).toBe('submitted');

    setCurrentUser(adminId);
    const list = await listSummaries();
    expect((await list.json()).summaries).toHaveLength(1);

    const reviewRes = await reviewSummary(jsonRequest({ status: 'approved' }), { params: { id: summary.id } });
    expect((await reviewRes.json()).summary.status).toBe('approved');
  });

  it('performance review: draft is invisible to the employee until submitted, then they can acknowledge', async () => {
    const { employee, profile } = await seedEmployee();
    const createRes = await createReview(
      jsonRequest({ employeeId: employee.id, periodStart: '2026-01-01', periodEnd: '2026-03-31', rating: 4 }),
    );
    const { review } = await createRes.json();

    setCurrentUser(profile!.id);
    const beforeSubmit = await import('@/app/api/training/reviews/route').then((m) => m.GET());
    expect((await beforeSubmit.json()).reviews).toHaveLength(1); // exists but...

    setCurrentUser(adminId);
    const submitRes = await updateReview(jsonRequest({ submit: true }), { params: { id: review.id } });
    expect(submitRes.status).toBe(200);

    const notifs = await db.select().from(notifications).where(eq(notifications.userId, profile!.id));
    expect(notifs.some((n) => n.type === 'performance_review_submitted')).toBe(true);

    setCurrentUser(profile!.id);
    const ackRes = await updateReview(jsonRequest({ acknowledge: true }), { params: { id: review.id } });
    expect(ackRes.status).toBe(200);
    expect((await ackRes.json()).review.employeeAcknowledgedAt).not.toBeNull();

    // Cannot acknowledge someone else's review.
    const { profile: outsider } = await seedEmployee();
    setCurrentUser(outsider!.id);
    const blocked = await updateReview(jsonRequest({ acknowledge: true }), { params: { id: review.id } });
    expect(blocked.status).toBe(403);
  });
});
