import { randomUUID } from 'node:crypto';
import { HttpError } from './http';
import type { DocumentKind } from '@internlink/shared';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are capped ~4.5 MB

type Rule = { mimes: string[]; exts: string[] };
const DOC: Rule = {
  mimes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
  ],
  exts: ['pdf', 'docx', 'png', 'jpg', 'jpeg'],
};
const IMG: Rule = { mimes: ['image/png', 'image/jpeg'], exts: ['png', 'jpg', 'jpeg'] };

export const KIND_RULES: Record<DocumentKind, Rule> = {
  INTRO_LETTER: DOC,
  CV: DOC,
  STUDENT_ID: IMG,
  EVAL_FORM: DOC,
  EVAL_RESPONSE: DOC,
  COMPANY_PHOTO: IMG,
};

/** Magic-byte sniffing: the declared MIME type and file extension are attacker-controlled. */
function sniff(buf: Uint8Array): string | null {
  const b = (...xs: number[]) => xs.every((x, i) => buf[i] === x);
  if (b(0x25, 0x50, 0x44, 0x46)) return 'application/pdf'; // %PDF
  if (b(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (b(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (b(0x50, 0x4b, 0x03, 0x04)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; // zip container (docx)
  return null;
}

export type CheckedFile = { bytes: Uint8Array; mime: string; ext: string; safeName: string; storagePath: (userId: string, kind: string) => string };

export async function validateUpload(file: File, kind: DocumentKind): Promise<CheckedFile> {
  const rule = KIND_RULES[kind];
  if (file.size === 0) throw new HttpError(400, 'The file is empty', 'VALIDATION');
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'File is too large (max 4 MB)', 'FILE_TOO_LARGE');

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!rule.exts.includes(ext)) throw new HttpError(400, `Allowed file types: ${rule.exts.join(', ')}`, 'FILE_TYPE');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const real = sniff(bytes);
  if (!real || !rule.mimes.includes(real)) throw new HttpError(400, 'File content does not match an allowed type', 'FILE_TYPE');

  // A .docx must really be a docx extension if the container is a zip (blocks arbitrary zips renamed to .png etc. — sniff already differs).
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return {
    bytes,
    mime: real,
    ext: ext === 'jpeg' ? 'jpg' : ext,
    safeName,
    storagePath: (userId, k) => `${k.toLowerCase()}/${userId}/${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`,
  };
}
