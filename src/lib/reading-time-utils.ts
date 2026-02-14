/**
 * Format reading time for display
 * Client-safe utility (no server dependencies)
 */
export function formatReadingTime(minutes?: number): string {
  if (!minutes || minutes < 1) return '< 1 min read';

  // For articles over 60 minutes, show hours
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hr read`;
    }
    return `${hours} hr ${remainingMinutes} min read`;
  }

  return `${minutes} min read`;
}
