import { departmentSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { ok, readJson, route } from '@/lib/http';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';

export const POST = route(async (req) => {
  const s = await requireRole(req, 'COMPANY');
  const body = await readJson(req, departmentSchema);
  const department = await prisma.$transaction(async (tx) => {
    const d = await tx.department.create({ data: { ...body, companyId: s.companyId! } });
    await audit(tx, req, s.userId, 'department.create', 'Department', d.id, { totalSlots: d.totalSlots });
    return d;
  });
  return ok({ department }, 201);
});
