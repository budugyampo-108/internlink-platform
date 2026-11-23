/**
 * Dev-only demo data:  npm run db:seed   (refuses to run in production)
 * Creates 1 student + 1 company (Accra) with 2 departments and 2 vacancies.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }
  const passwordHash = await bcrypt.hash('Demo12345!', 12);

  await prisma.user.upsert({
    where: { email: 'student@demo.test' },
    update: {},
    create: {
      email: 'student@demo.test', passwordHash, role: 'STUDENT', fullName: 'Ama Mensah',
      student: { create: { institution: 'Pentecost University College', program: 'BSc Information Technology', level: 400, skills: ['react', 'sql', 'python'] } },
    },
  });

  const hr = await prisma.user.upsert({
    where: { email: 'hr@demo.test' },
    update: {},
    create: { email: 'hr@demo.test', passwordHash, role: 'COMPANY', fullName: 'Kojo Boateng' },
  });

  const existing = await prisma.companyMember.findUnique({ where: { userId: hr.id } });
  if (existing) return console.log('Seed already applied.');

  const company = await prisma.company.create({
    data: {
      name: 'Accra Digital Labs', industry: 'Software', overview: 'We build fintech and logistics software.',
      culture: 'Mentorship-first, hybrid, weekly demo days.', address: '12 Oxford Street, Osu, Accra',
      digitalAddress: 'GA-039-5028', phone: '+233 30 000 0000', lat: 5.5557, lng: -0.1822,
      website: 'https://example.com', linkedin: 'https://www.linkedin.com/company/example',
    },
  });
  await prisma.companyMember.create({ data: { userId: hr.id, companyId: company.id, jobTitle: 'HR Manager' } });

  const eng = await prisma.department.create({
    data: { companyId: company.id, name: 'Engineering', description: 'Web & mobile products', totalSlots: 6, requiredSkills: ['react', 'sql'] },
  });
  const ops = await prisma.department.create({
    data: { companyId: company.id, name: 'Data & Analytics', description: 'Dashboards and reporting', totalSlots: 3, requiredSkills: ['python', 'excel'] },
  });
  const reqs = { program: true, level: true, institution: true, portfolio: false, availability: true, cv: true, studentId: false, coverNote: true };
  const from = new Date(); const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  await prisma.vacancy.createMany({
    data: [
      { companyId: company.id, departmentId: eng.id, title: 'Frontend Attachment Student', description: 'Help build our React dashboards.', slots: 3, requiredSkills: ['react', 'typescript'], applicantRequirements: reqs, availableFrom: from, availableTo: to },
      { companyId: company.id, departmentId: ops.id, title: 'Data Analyst Intern', description: 'Clean data and build reports.', slots: 2, requiredSkills: ['python', 'sql'], applicantRequirements: reqs, availableFrom: from, availableTo: to },
    ],
  });
  console.log('Seeded. Logins → student@demo.test / hr@demo.test  (password: Demo12345!)');
}

main().finally(() => prisma.$disconnect());
