export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const head = user.slice(0, 1);
  return `${head}***@${domain}`;
}

export function toISODateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}
