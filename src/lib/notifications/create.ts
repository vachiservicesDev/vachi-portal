import { db } from '@/db';
import { notifications } from '@/db/schema';

interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Fire-and-forget in-app notification. Wired into a representative set of
 * write paths (training assignment, timesheet rejection, performance
 * review submission) rather than every single mutation in the app - follow
 * this same call at the point of any other action that should notify
 * someone.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    priority: input.priority ?? 'medium',
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel,
  });
}
