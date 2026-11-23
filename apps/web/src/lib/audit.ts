import type { Prisma, PrismaClient } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { clientIp } from './http';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Append-only audit entry (the DB rejects UPDATE/DELETE/TRUNCATE on AuditLog).
 * Pass the transaction client so the audit row commits atomically with the change it describes.
 */
export async function audit(
  db: Db,
  req: NextRequest | null,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: { actorId, action, entity, entityId, meta, ip: req ? clientIp(req) : null },
  });
}
