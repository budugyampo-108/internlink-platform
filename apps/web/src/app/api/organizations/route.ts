import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ok, route } from '@/lib/http';
import { requireSession } from '@/lib/auth';

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

type OrgRow = {
  id: string;
  name: string;
  overview: string;
  industry: string;
  address: string;
  digitalAddress: string;
  phone: string;
  website: string | null;
  lat: number;
  lng: number;
  verificationStatus: string;
  distanceKm: number | null;
};

export const GET = route(async (req) => {
  await requireSession(req);

  const searchParams = req.nextUrl.searchParams;
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const radiusKm = Math.min(Math.max(Number(searchParams.get('radiusKm') || 100), 5), 1000);
  const q = searchParams.get('q')?.trim() || '';
  const industry = searchParams.get('industry')?.trim() || '';

  const hasPoint = latStr !== null && lngStr !== null && !isNaN(Number(latStr)) && !isNaN(Number(lngStr));
  const lat = hasPoint ? Number(latStr) : 0;
  const lng = hasPoint ? Number(lngStr) : 0;

  const dist = hasPoint
    ? Prisma.sql`(6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${lat}::float8)) * cos(radians(c.lat)) * cos(radians(c.lng) - radians(${lng}::float8))
        + sin(radians(${lat}::float8)) * sin(radians(c.lat))))))`
    : Prisma.sql`NULL::float8`;

  const filters: Prisma.Sql[] = [];
  if (hasPoint) {
    filters.push(Prisma.sql`AND ${dist} <= ${radiusKm}::float8`);
  }
  if (q) {
    const like = `%${escapeLike(q)}%`;
    filters.push(Prisma.sql`AND (c.name ILIKE ${like} OR c.address ILIKE ${like} OR c.industry ILIKE ${like} OR c."digitalAddress" ILIKE ${like})`);
  }
  if (industry && industry !== 'ALL') {
    const indLike = `%${escapeLike(industry)}%`;
    filters.push(Prisma.sql`AND c.industry ILIKE ${indLike}`);
  }

  const organizations = await prisma.$queryRaw<OrgRow[]>(Prisma.sql`
    SELECT c.id, c.name, c.overview, c.industry, c.address, c."digitalAddress",
           c.phone, c.website, c.lat, c.lng, c."verificationStatus",
           ${dist} AS "distanceKm"
    FROM "Company" c
    WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
      AND (c."verificationStatus" = 'VERIFIED' OR c."verificationStatus" IS NULL)
    ${filters.length ? Prisma.join(filters, ' ') : Prisma.empty}
    ORDER BY ${hasPoint ? Prisma.sql`"distanceKm" ASC` : Prisma.sql`c.name ASC`}
    LIMIT 100
  `);

  // Fetch open vacancies for these organizations to show available opportunities
  const orgIds = organizations.map((o) => o.id);
  const vacancies = orgIds.length
    ? await prisma.vacancy.findMany({
        where: {
          companyId: { in: orgIds },
          status: 'OPEN',
          slotsFilled: { lt: prisma.vacancy.fields.slots },
        },
        include: {
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const vacanciesByOrg = new Map<string, typeof vacancies>();
  for (const v of vacancies) {
    const list = vacanciesByOrg.get(v.companyId) || [];
    list.push(v);
    vacanciesByOrg.set(v.companyId, list);
  }

  // Also collect available distinct industries for filter dropdown
  const industryRows = await prisma.company.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
      verificationStatus: 'VERIFIED',
    },
    select: { industry: true },
    distinct: ['industry'],
  });
  const categories = Array.from(new Set(industryRows.map((i) => i.industry.trim()).filter(Boolean))).sort();

  return ok({
    organizations: organizations.map((o) => {
      const orgVacancies = vacanciesByOrg.get(o.id) || [];
      const totalSlots = orgVacancies.reduce((acc, v) => acc + (v.slots - v.slotsFilled), 0);
      return {
        ...o,
        distanceKm: o.distanceKm === null ? null : Math.round(o.distanceKm * 10) / 10,
        totalSlotsAvailable: totalSlots,
        vacancies: orgVacancies.map((v) => ({
          id: v.id,
          title: v.title,
          departmentName: v.department.name,
          slotsLeft: v.slots - v.slotsFilled,
          requiredSkills: v.requiredSkills,
          availableFrom: v.availableFrom,
          availableTo: v.availableTo,
        })),
      };
    }),
    categories,
  });
});
