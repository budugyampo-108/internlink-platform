import { messageSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';
import { loadParticipantApplication } from '@/lib/access';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Chat is scoped to one application, so a student can only talk to the HR of the company they applied to.
 * Delivery states: sent (row exists) → delivered (recipient fetched) → read (recipient had the chat open).
 *
 * NOTE: Vercel serverless can't hold WebSockets. This starter polls; swap `ChatPanel`'s poll for
 * Ably / Pusher / Supabase Realtime pushes without changing this contract (see docs/01-ARCHITECTURE.md).
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  await rateLimit('chat-poll', s.userId, 120, 60);
  await loadParticipantApplication(params.id, s);

  const now = new Date();
  const markRead = req.nextUrl.searchParams.get('markRead') === '1';
  await prisma.message.updateMany({
    where: { applicationId: params.id, senderId: { not: s.userId }, deliveredAt: null },
    data: { deliveredAt: now },
  });
  if (markRead) {
    await prisma.message.updateMany({
      where: { applicationId: params.id, senderId: { not: s.userId }, readAt: null },
      data: { readAt: now },
    });
  }

  const recent = await prisma.message.findMany({
    where: { applicationId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, senderId: true, body: true, createdAt: true, deliveredAt: true, readAt: true },
  });
  return ok({ messages: recent.reverse(), me: s.userId });
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  await rateLimit('chat-send', s.userId, 30, 60);
  const { body } = await readJson(req, messageSchema);
  const app = await loadParticipantApplication(params.id, s);

  if (app.status === 'REJECTED' || app.status === 'WITHDRAWN') {
    throw new HttpError(409, 'This conversation is closed', 'CONVERSATION_CLOSED');
  }
  const message = await prisma.message.create({
    data: { applicationId: app.id, senderId: s.userId, body },
    select: { id: true, senderId: true, body: true, createdAt: true, deliveredAt: true, readAt: true },
  });
  return ok({ message }, 201);
});
