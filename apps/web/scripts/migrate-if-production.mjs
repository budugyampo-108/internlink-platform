// Runs `prisma migrate deploy` ONLY for Vercel Production builds.
// Preview builds must not mutate the production database.
import { execSync } from 'node:child_process';

if (process.env.VERCEL_ENV === 'production') {
  console.log('[build] Production build → applying database migrations');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} else {
  console.log(`[build] VERCEL_ENV=${process.env.VERCEL_ENV ?? 'local'} → skipping migrations`);
}
