import { Prisma } from '@prisma/client';
import { vacancySchema, vacancySearchSchema } from '@internlink/shared';
import { prisma } from '@/lib/db';
import { HttpError, ok, readJson, route } from '@/lib/http';
import { requireRole, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

type Row = {
  id: string;
  title: string;
  requiredSkills: string[];
  slots: number;
  slotsFilled: number;
  availableFrom: Date;
  availableTo: Date;
  departmentName: string;
  companyId: string;
  companyName: string;
  address: string;
  digitalAddress: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/**
 * Proximity search. EVERY user-supplied value is bound as a query parameter via Prisma.sql
 * (never string-concatenated) → no SQL injection in search/location queries.
 */
export const GET = route(async (req) => {
  await requireSession(req);
  const p = vacancySearchSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const hasPoint = p.lat !== undefined && p.lng !== undefined;

  const dist = hasPoint
    ? Prisma.sql`(6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${p.lat}::float8)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians(${p.lng}::float8))
        + sin(radians(${p.lat}::float8)) * sin(radians(c.lat))))))`
    : Prisma.sql`NULL::float8`;

  const filters: Prisma.Sql[] = [];
  if (hasPoint) filters.push(Prisma.sql`AND ${dist} <= ${p.radiusKm}::float8`);
  if (p.q) {
    const like = `%${escapeLike(p.q)}%`;
    filters.push(Prisma.sql`AND (v.title ILIKE ${like} OR d.name ILIKE ${like} OR c.name ILIKE ${like})`);
  }
  if (p.department) filters.push(Prisma.sql`AND d.name ILIKE ${`%${escapeLike(p.department)}%`}`);
  if (p.skills.length) filters.push(Prisma.sql`AND v."requiredSkills" && ${p.skills}::text[]`);

  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT v.id, v.title, v."requiredSkills", v.slots, v."slotsFilled", v."availableFrom", v."availableTo",
           d.name AS "departmentName", c.id AS "companyId", c.name AS "companyName",
           c.address, c."digitalAddress", c.lat, c.lng, ${dist} AS "distanceKm"
    FROM "Vacancy" v
    JOIN "Company" c ON c.id = v."companyId"
    JOIN "Department" d ON d.id = v."departmentId"
    WHERE v.status = 'OPEN' AND v."slotsFilled" < v.slots AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      AND (c."verificationStatus" = 'VERIFIED' OR c."verificationStatus" IS NULL)
    ${filters.length ? Prisma.join(filters, ' ') : Prisma.empty}
    ORDER BY ${hasPoint ? Prisma.sql`"distanceKm" ASC` : Prisma.sql`v."createdAt" DESC`}
    LIMIT ${p.limit}
  `);

  return ok({
    vacancies: rows.map((r) => ({
      ...r,
      slotsLeft: r.slots - r.slotsFilled,
      distanceKm: r.distanceKm === null ? null : Math.round(r.distanceKm * 10) / 10,
    })),
  });
});

export const POST = route(async (req) => {
  const s = await requireRole(req, 'COMPANY');
  const body = await readJson(req, vacancySchema);

  const company = await prisma.company.findUniqueOrThrow({ where: { id: s.companyId! } });
  if (company.lat === null || company.lng === null || !company.address || !company.digitalAddress || !company.phone) {
    throw new HttpError(409, 'Complete your company location and contact details before posting vacancies', 'PROFILE_INCOMPLETE');
  }

  const vacancy = await prisma.$transaction(async (tx) => {
    // Department must belong to THIS company (blocks cross-tenant writes).
    const dept = await tx.department.findFirst({ where: { id: body.departmentId, companyId: company.id } });
    if (!dept) throw new HttpError(404, 'Department not found', 'NOT_FOUND');

    const used = await tx.vacancy.aggregate({
      where: { departmentId: dept.id, status: 'OPEN' },
      _sum: { slots: true },
    });
    if ((used._sum.slots ?? 0) + body.slots > dept.totalSlots) {
      throw new HttpError(409, `This department only has ${dept.totalSlots} slots in total`, 'SLOT_LIMIT');
    }
    const v = await tx.vacancy.create({
      data: {
        ...body,
        companyId: company.id,
        requiredSkills: body.requiredSkills.length ? body.requiredSkills : dept.requiredSkills,
      },
    });
    await audit(tx, req, s.userId, 'vacancy.create', 'Vacancy', v.id, { slots: v.slots });
    return v;
  });
  return ok({ vacancy }, 201);
});
