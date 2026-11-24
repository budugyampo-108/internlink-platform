/**
 * Shared contracts: enums, state machine, and zod schemas used by the web UI,
 * the API route handlers, and (as reference) the mobile app.
 * All user input is validated + normalised here — one source of truth.
 */
import { z } from 'zod';

/* ───────────────────────── Enums & constants ───────────────────────── */

export const ROLES = ['STUDENT', 'COMPANY'] as const;
export type Role = (typeof ROLES)[number];

export const APPLICATION_STATUSES = [
  'SUBMITTED',
  'REVIEWING',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'COMPLETED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Who may move an application from state X to which states. Enforced server-side. */
export const STATUS_TRANSITIONS: Record<
  ApplicationStatus,
  { COMPANY: ApplicationStatus[]; STUDENT: ApplicationStatus[] }
> = {
  SUBMITTED: { COMPANY: ['REVIEWING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'], STUDENT: ['WITHDRAWN'] },
  REVIEWING: { COMPANY: ['SHORTLISTED', 'ACCEPTED', 'REJECTED'], STUDENT: ['WITHDRAWN'] },
  SHORTLISTED: { COMPANY: ['ACCEPTED', 'REJECTED'], STUDENT: ['WITHDRAWN'] },
  ACCEPTED: { COMPANY: ['COMPLETED'], STUDENT: ['WITHDRAWN'] },
  REJECTED: { COMPANY: [], STUDENT: [] },
  WITHDRAWN: { COMPANY: [], STUDENT: [] },
  COMPLETED: { COMPANY: [], STUDENT: [] },
};

export const DOCUMENT_KINDS = [
  'INTRO_LETTER',
  'CV',
  'STUDENT_ID',
  'EVAL_FORM', // blank/student-initiated form for HR to open
  'EVAL_RESPONSE', // HR's filled/signed copy
  'COMPANY_PHOTO',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Which role may upload which kind of document. */
export const UPLOAD_PERMISSIONS: Record<Role, DocumentKind[]> = {
  STUDENT: ['INTRO_LETTER', 'CV', 'STUDENT_ID', 'EVAL_FORM'],
  COMPANY: ['COMPANY_PHOTO', 'EVAL_RESPONSE'],
};

export const EVALUATION_CRITERIA = [
  { key: 'punctuality', label: 'Punctuality & attendance' },
  { key: 'technical', label: 'Technical / domain skills' },
  { key: 'communication', label: 'Communication' },
  { key: 'teamwork', label: 'Teamwork & professionalism' },
  { key: 'initiative', label: 'Initiative & learning' },
] as const;
export type CriterionKey = (typeof EVALUATION_CRITERIA)[number]['key'];

/* ───────────────────────── Field helpers ───────────────────────── */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Trim, strip control chars, enforce length. (Output encoding is handled by React.) */
export const safeText = (max: number, min = 0) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, '').trim())
    .pipe(z.string().min(min).max(max));

export const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((u) => u.startsWith('https://'), 'Must be an https:// URL');

/** Optional URL: empty string becomes undefined. */
export const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), httpsUrl.optional());

export const emailField = z.string().trim().toLowerCase().email().max(254);

export const passwordField = z
  .string()
  .min(10, 'At least 10 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use letters and numbers');

export const latField = z.number().min(-90).max(90);
export const lngField = z.number().min(-180).max(180);

/** Ghana Post GPS style (e.g. GA-543-1234). Change the regex for other countries. */
export const DIGITAL_ADDRESS_REGEX = /^[A-Z]{2}-\d{3,4}-\d{4}$/;
export const digitalAddressField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(DIGITAL_ADDRESS_REGEX, 'Format like GA-543-1234');

export const skillList = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(20)
  .transform((a) => Array.from(new Set(a)));

const cuid = z.string().min(20).max(40);

/* ───────────────────────── Auth ───────────────────────── */

const studentRegister = z.object({
  role: z.literal('STUDENT'),
  email: emailField,
  password: passwordField,
  fullName: safeText(100, 2),
  institution: safeText(120, 2),
  program: safeText(120, 2),
  level: z.number().int().min(100).max(800),
});

const companyRegister = z.object({
  role: z.literal('COMPANY'),
  email: emailField,
  password: passwordField,
  fullName: safeText(100, 2),
  jobTitle: safeText(80, 2),
  companyName: safeText(120, 2),
  industry: safeText(80, 2),
});

export const registerSchema = z.discriminatedUnion('role', [studentRegister, companyRegister]);
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128),
});

/* ───────────────────────── Company, departments, vacancies ───────────────────────── */

export const companyProfileSchema = z
  .object({
    name: safeText(120, 2),
    overview: safeText(2000),
    industry: safeText(80, 2),
    culture: safeText(1500),
    address: safeText(200, 5),
    digitalAddress: digitalAddressField,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
    lat: latField,
    lng: lngField,
    verificationStatus: z.string().optional(),
    linkedin: optionalUrl,
    twitter: optionalUrl,
    instagram: optionalUrl,
    facebook: optionalUrl,
    website: optionalUrl,
    photoDocIds: z.array(cuid).max(8).default([]),
  })
  .strict();

export const departmentSchema = z
  .object({
    name: safeText(80, 2),
    description: safeText(500),
    totalSlots: z.number().int().min(1).max(500),
    requiredSkills: skillList.default([]),
  })
  .strict();

/** What the company requires from applicants — configurable per vacancy. */
export const applicantRequirementsSchema = z
  .object({
    program: z.boolean().default(true),
    level: z.boolean().default(true),
    institution: z.boolean().default(true),
    portfolio: z.boolean().default(false),
    availability: z.boolean().default(true),
    cv: z.boolean().default(true),
    studentId: z.boolean().default(false),
    coverNote: z.boolean().default(true),
  })
  .strict();
export type ApplicantRequirements = z.infer<typeof applicantRequirementsSchema>;

export const vacancySchema = z
  .object({
    departmentId: cuid,
    title: safeText(120, 3),
    description: safeText(3000, 10),
    slots: z.number().int().min(1).max(200),
    requiredSkills: skillList.default([]),
    applicantRequirements: applicantRequirementsSchema.default({}),
    availableFrom: z.coerce.date(),
    availableTo: z.coerce.date(),
  })
  .strict()
  .refine((v) => v.availableTo > v.availableFrom, {
    path: ['availableTo'],
    message: 'End date must be after start date',
  });

export const vacancySearchSchema = z.object({
  lat: z.coerce.number().pipe(latField).optional(),
  lng: z.coerce.number().pipe(lngField).optional(),
  radiusKm: z.coerce.number().min(1).max(200).default(50),
  q: safeText(80).optional(),
  department: safeText(80).optional(),
  skills: z
    .string()
    .max(300)
    .optional()
    .transform((s) =>
      (s ?? '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10),
    ),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/* ───────────────────────── Student profile & applications ───────────────────────── */

export const studentProfileSchema = z
  .object({
    institution: safeText(120, 2),
    program: safeText(120, 2),
    level: z.number().int().min(100).max(800),
    bio: safeText(1000),
    skills: skillList,
    portfolioUrl: optionalUrl,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{7,20}$/)
      .optional(),
    locationLabel: safeText(120).optional(),
    homeLat: latField.optional(),
    homeLng: lngField.optional(),
    vacationLat: latField.optional(),
    vacationLng: lngField.optional(),
  })
  .strict();

export const applicationCreateSchema = z
  .object({
    vacancyId: cuid,
    coverNote: safeText(1500).optional(),
    portfolioUrl: optionalUrl,
    availableFrom: z.coerce.date().optional(),
    availableTo: z.coerce.date().optional(),
    introLetterDocId: cuid,
    cvDocId: cuid.optional(),
    studentIdDocId: cuid.optional(),
  })
  .strict();

export const applicationStatusSchema = z.object({ status: z.enum(APPLICATION_STATUSES) }).strict();

/* ───────────────────────── Messaging ───────────────────────── */

export const messageSchema = z.object({ body: safeText(2000, 1) }).strict();

/* ───────────────────────── Evaluation (locked workflow) ───────────────────────── */

const score = z.number().int().min(1).max(5);

/** Student may ONLY do this, and only while status = REQUESTED. `.strict()` rejects any other key. */
export const studentEvaluationRequestSchema = z.object({ formDocId: cuid }).strict();

/** HR/supervisor submission. After success the row is immutable (app + DB trigger). */
export const evaluationSubmitSchema = z
  .object({
    scores: z
      .object({
        punctuality: score,
        technical: score,
        communication: score,
        teamwork: score,
        initiative: score,
      })
      .strict(),
    remarks: safeText(3000, 10),
    recommend: z.boolean(),
    responseDocId: cuid.optional(),
    confirm: z.literal(true), // explicit "I understand this is final"
  })
  .strict();
export type EvaluationSubmitInput = z.infer<typeof evaluationSubmitSchema>;

/** Deterministic canonical payload used for the tamper-evidence hash. */
export function canonicalEvaluationPayload(p: {
  applicationId: string;
  submittedById: string;
  submittedAtIso: string;
  scores: Record<string, number>;
  remarks: string;
  recommend: boolean;
  responseDocId?: string | null;
}): string {
  return JSON.stringify([
    p.applicationId,
    p.submittedById,
    p.submittedAtIso,
    EVALUATION_CRITERIA.map((c) => p.scores[c.key]),
    p.remarks,
    p.recommend,
    p.responseDocId ?? null,
  ]);
}
