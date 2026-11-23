import { z } from 'zod';
import { ok, route } from '@/lib/http';
import { REFRESH_COOKIE, clearAuthCookies, revokeRefreshToken } from '@/lib/auth';
import { isMobileClient } from '@/lib/session-response';

export const POST = route(async (req) => {
  let raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (isMobileClient(req)) {
    const parsed = z.object({ refreshToken: z.string().max(200) }).safeParse(await req.json().catch(() => ({})));
    if (parsed.success) raw = parsed.data.refreshToken;
  }
  await revokeRefreshToken(raw);
  const res = ok({ loggedOut: true });
  clearAuthCookies(res);
  return res;
});
