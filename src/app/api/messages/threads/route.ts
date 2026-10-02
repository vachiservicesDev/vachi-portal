import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages } from '@/db/schema';
import { requireActiveUser } from '@/lib/auth/requireAdmin';
import { listPartners } from '@/lib/messages/partners';
import { desc, eq, or } from 'drizzle-orm';

/**
 * Everyone this user can message, with the latest message and unread count for each. There's
 * no thread table; a conversation is every message between two profile ids.
 */
export async function GET() {
  const gate = await requireActiveUser();
  if (!gate.ok) return NextResponse.json({ message: gate.message }, { status: gate.status });

  const [partners, mine] = await Promise.all([
    listPartners({ id: gate.user.id, role: gate.profile.role }),
    db
      .select()
      .from(messages)
      .where(or(eq(messages.senderId, gate.user.id), eq(messages.recipientId, gate.user.id)))
      .orderBy(desc(messages.createdAt))
      .limit(2000),
  ]);

  const latest = new Map<string, (typeof mine)[number]>();
  const unread = new Map<string, number>();
  for (const m of mine) {
    const other = m.senderId === gate.user.id ? m.recipientId : m.senderId;
    if (!latest.has(other)) latest.set(other, m);
    if (m.recipientId === gate.user.id && !m.readAt) unread.set(other, (unread.get(other) ?? 0) + 1);
  }

  const result = partners
    .map((p) => {
      const last = latest.get(p.id);
      return {
        ...p,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt, fromMe: last.senderId === gate.user.id } : null,
        unread: unread.get(p.id) ?? 0,
      };
    })
    // Conversations with messages first (newest first), then everyone else by name.
    .sort((a, b) => {
      if (a.lastMessage && b.lastMessage) return +new Date(b.lastMessage.createdAt) - +new Date(a.lastMessage.createdAt);
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return (a.firstName ?? a.email).localeCompare(b.firstName ?? b.email);
    });

  return NextResponse.json({ partners: result });
}
