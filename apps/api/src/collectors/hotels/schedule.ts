/**
 * Keep near-term prices fresh while rotating through the rest of the window.
 * The previous implementation always selected the first slice, so later dates
 * could never be reached regardless of how many times the collector ran.
 */
export function selectRotatingDates(
  dates: string[],
  sliceFraction: number,
  nowMs = Date.now(),
  intervalMinutes = 360
): string[] {
  if (dates.length === 0) return [];

  const count = Math.min(dates.length, Math.max(1, Math.ceil(dates.length * sliceFraction)));
  const hotCount = Math.min(14, count);
  const hot = dates.slice(0, hotCount);
  const tail = dates.slice(hotCount);
  const rotatingCount = count - hotCount;
  if (rotatingCount <= 0 || tail.length === 0) return hot;

  const runSlot = Math.floor(nowMs / (intervalMinutes * 60_000));
  const offset = (runSlot * rotatingCount) % tail.length;
  const rotating = Array.from(
    { length: Math.min(rotatingCount, tail.length) },
    (_, index) => tail[(offset + index) % tail.length]!
  );

  return [...hot, ...rotating];
}
