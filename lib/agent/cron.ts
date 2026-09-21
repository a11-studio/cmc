type CronEnv = {
  NODE_ENV?: string;
  CRON_SECRET?: string;
};

function cronSecret(env: CronEnv): string | undefined {
  const value = env.CRON_SECRET?.trim();
  return value ? value : undefined;
}

function bearerMatches(request: Request, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Authorizes HTTP cron triggers (GitHub Actions, manual curl).
 * Production always requires a configured CRON_SECRET and matching Bearer token.
 * Non-production: open when CRON_SECRET is unset; otherwise require Bearer.
 */
export function isCronAuthorized(
  request: Request,
  env: CronEnv = process.env,
): boolean {
  const secret = cronSecret(env);
  const isProduction = env.NODE_ENV === "production";

  if (!isProduction) {
    if (!secret) {
      return true;
    }
    return bearerMatches(request, secret);
  }

  if (!secret) {
    return false;
  }

  return bearerMatches(request, secret);
}
