import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';
import { canReadDocument } from '@/lib/access';

/** Authorised download. Always 404 (not 403) when the caller may not see the file. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const s = await requireSession(req);
  if (!(await canReadDocument(params.id, s))) throw new HttpError(404, 'Not found', 'NOT_FOUND');
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: params.id } });
  return NextResponse.redirect(doc.url, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
});
