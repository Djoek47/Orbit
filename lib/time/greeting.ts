/** Time-of-day greeting for Home / Poppins copy. */
export function greetingWord(date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
