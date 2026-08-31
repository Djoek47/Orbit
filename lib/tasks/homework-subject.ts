import { HOMEWORK_SUBJECT_CHIPS } from '@/lib/poppins/homework-compose';
import type { HouseholdTask } from '@/types/orbit';

export const HOMEWORK_SUBJECT_META: Record<string, { color: string; emoji: string }> = {
  Math: { color: '#38BDF8', emoji: '🔢' },
  English: { color: '#A78BFA', emoji: '📖' },
  Science: { color: '#34D399', emoji: '🧪' },
  History: { color: '#FB923C', emoji: '🏛️' },
  Reading: { color: '#A78BFA', emoji: '📚' },
  Art: { color: '#F472B6', emoji: '🎨' },
  PE: { color: '#FBBF24', emoji: '⚽' },
  Homework: { color: '#A78BFA', emoji: '📚' },
};

export function isHomeworkCategory(category: string, title = ''): boolean {
  const blob = `${category} ${title}`.toLowerCase();
  return category === 'homework_education' || blob.includes('homework');
}

/** Prefer structured field; fall back to legacy description/title parsing. */
export function resolveHomeworkSubject(task: Pick<HouseholdTask, 'homeworkSubject' | 'description' | 'title' | 'category'>): string | null {
  const explicit = task.homeworkSubject?.trim();
  if (explicit) return explicit;

  const desc = task.description ?? '';
  const subjectMatch = desc.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch?.[1]?.trim()) return subjectMatch[1].trim();

  const blob = `${task.title} ${desc}`;
  for (const chip of HOMEWORK_SUBJECT_CHIPS) {
    if (new RegExp(chip.label, 'i').test(blob)) return chip.label;
  }
  const known = Object.keys(HOMEWORK_SUBJECT_META).filter((k) => k !== 'Homework');
  const hit = known.find((subject) => new RegExp(subject, 'i').test(blob));
  return hit ?? null;
}

export function homeworkSubjectMeta(subject: string | null | undefined) {
  if (!subject?.trim()) {
    return { label: 'Homework', ...HOMEWORK_SUBJECT_META.Homework };
  }
  const normalized =
    Object.keys(HOMEWORK_SUBJECT_META).find(
      (key) => key.toLowerCase() === subject.trim().toLowerCase()
    ) ?? subject.trim();
  const base = HOMEWORK_SUBJECT_META[normalized] ?? HOMEWORK_SUBJECT_META.Homework;
  return { label: normalized, ...base };
}

export function formatHomeworkDescription(subject: string | null | undefined, note?: string): string | undefined {
  const parts: string[] = [];
  if (subject?.trim()) parts.push(`Subject: ${subject.trim()}`);
  if (note?.trim()) parts.push(note.trim());
  return parts.length ? parts.join('\n') : undefined;
}
