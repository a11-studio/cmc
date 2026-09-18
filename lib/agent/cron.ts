export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
