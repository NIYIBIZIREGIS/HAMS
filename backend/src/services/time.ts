export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return h * 60 + m;
}

/** Returns 1 if a is after b, -1 if before, 0 if equal. Times are "HH:mm". */
export function compareTimes(a: string, b: string): number {
  const ma = timeToMinutes(a);
  const mb = timeToMinutes(b);
  if (ma > mb) return 1;
  if (ma < mb) return -1;
  return 0;
}

export function isInRange(time: string, start: string, end: string): boolean {
  return compareTimes(time, start) >= 0 && compareTimes(time, end) < 0;
}
