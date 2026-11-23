import { put } from '@vercel/blob';
import { DOCUMENT_KINDS, UPLOAD_PERMISSIONS, type DocumentKind } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateUpload } from '@/lib/uploads';
import { audit } from '@/lib/audit';

export const POST = route(async (req) => {
  const s = await requireSession(req);
  await rateLimit('upload', s.userId, 20, 3600);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = form?.get('kind');
  if (!(file instanceof File) || typeof kind !== 'string' || !DOCUMENT_KINDS.includes(kind as DocumentKind)) {
    throw new HttpError(400, 'Provide a file and a valid kind', 'VALIDATION');
  }
  if (!UPLOAD_PERMISSIONS[s.role].includes(kind as DocumentKind)) {
    throw new HttpError(403, 'Your account cannot upload this kind of file', 'FORBIDDEN');
  }

  const checked = await validateUpload(file, kind as DocumentKind);
  const blob = await put(checked.storagePath(s.userId, kind), new Blob([checked.bytes as BlobPart], { type: checked.mime }), {
    access: 'public', // URL is unguessable; downloads still go through /api/documents/[id] (authorised). See docs for private-storage upgrade.
    contentType: checked.mime,
    addRandomSuffix: false,
  });

  const document = await prisma.$transaction(async (tx) => {
    const d = await tx.document.create({
      data: { ownerId: s.userId, kind: kind as DocumentKind, url: blob.url, filename: checked.safeName, mime: checked.mime, size: file.size },
      select: { id: true, kind: true, filename: true, size: true },
    });
    await audit(tx, req, s.userId, 'document.upload', 'Document', d.id, { kind });
    return d;
  });
  return ok({ document }, 201);
});
