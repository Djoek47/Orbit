import { isHomeworkCategory } from '@/lib/tasks/homework-subject';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import type { CreateTaskInput, HouseholdMember } from '@/types/orbit';

export type SelfHomeworkInput = {
  title: string;
  subject: string;
  dueLabel: string;
  occurrenceDate: string;
  dueAt?: string;
};

export function canCreateSelfHomework(
  member: HouseholdMember | null | undefined,
  input: Pick<CreateTaskInput, 'category' | 'title' | 'assignee'>
): boolean {
  if (!member || !isSidekickRole(member.role)) return false;
  if (!isHomeworkCategory(input.category, input.title)) return false;
  return input.assignee.trim().toLowerCase() === member.name.trim().toLowerCase();
}

export function buildSelfHomeworkTaskInput(
  member: HouseholdMember,
  input: SelfHomeworkInput
): CreateTaskInput {
  return {
    title: input.title.trim(),
    category: 'homework_education',
    assignee: member.name,
    due: input.dueLabel,
    xp: 0,
    repeat: 'None',
    homeworkSubject: input.subject.trim(),
    occurrenceDate: input.occurrenceDate,
    dueAt: input.dueAt,
    description: input.subject.trim() ? `Subject: ${input.subject.trim()}` : undefined,
  };
}
