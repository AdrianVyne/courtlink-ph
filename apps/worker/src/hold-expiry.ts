export function shouldExpireHold(deadline: Date, now: Date): boolean {
  return now.getTime() >= deadline.getTime();
}
