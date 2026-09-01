export function addIsoDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** Keep a valid stay when check-in moves beyond the selected check-out. */
export function checkoutAfterCheckIn(
  checkIn: string,
  currentCheckOut: string,
  fallbackNights = 7
): string {
  if (!checkIn || currentCheckOut > checkIn) return currentCheckOut;
  return addIsoDays(checkIn, fallbackNights);
}
