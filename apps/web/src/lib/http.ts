import { NextRequest, NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Prisma } from '@prisma/client';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const MAX_JSON_BYTES = 100_000;

/** Parse + validate a JSON body. Unknown keys are rejected by the `.strict()` schemas. */
export async function readJson<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_JSON_BYTES) throw new HttpError(413, 'Request body too large');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Body must be valid JSON');
  }
  return schema.parse(raw);
}

export function clientIp(req: NextRequest): string {
  // On Vercel, x-forwarded-for is set by the platform edge (not client-controlled at the first hop).
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

/**
 * Wraps a route handler: resolves async params (Next 15), maps validation / DB / HttpErrors to
 * consistent JSON, and never leaks stack traces or SQL to clients.
 */
export function route<P = Record<string, never>>(fn: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = (await ctx.params) as P;
      return await fn(req, { params });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status, headers: e.headers });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION',
          message: 'Please check the highlighted fields',
          fields: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') return NextResponse.json({ error: { code: 'CONFLICT', message: 'Already exists' } }, { status: 409 });
    if (e.code === 'P2025') return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }
  // Database-level lock tripped (see 0002_integrity_locks) — surface as a clean 409.
  if (e instanceof Error && e.message.includes('EVALUATION_LOCKED')) {
    return NextResponse.json(
      { error: { code: 'EVALUATION_LOCKED', message: 'This evaluation has been submitted and can no longer be changed' } },
      { status: 409 },
    );
  }
  console.error('[api] unhandled error', e);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Something went wrong' } }, { status: 500 });
}
