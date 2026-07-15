import { dataMode } from '@/config/data-mode';
import { createLocalId, requireMockOrSupabaseReady } from '@/repositories/repository-utils';
import type { CreateTaskInput, HouseholdTask } from '@/types/orbit';

export const taskRepository = {
  async getTasks(tasks: HouseholdTask[]): Promise<HouseholdTask[]> {
    if (dataMode === 'mock') {
      return [...tasks];
    }

    requireMockOrSupabaseReady('taskRepository.getTasks');
    return [...tasks];
  },

  async createTask(input: CreateTaskInput): Promise<HouseholdTask> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('taskRepository.createTask');
    }

    return {
      id: createLocalId('task'),
      title: input.title.trim(),
      category: input.category,
      assignee: input.assignee,
      due: input.due.trim(),
      xp: input.xp,
      repeat: input.repeat,
      status: 'Pending',
    };
  },

  async updateTask(task: HouseholdTask): Promise<HouseholdTask> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('taskRepository.updateTask');
    }

    return task;
  },

  async completeTask(task: HouseholdTask): Promise<HouseholdTask> {
    if (dataMode !== 'mock') {
      requireMockOrSupabaseReady('taskRepository.completeTask');
    }

    return {
      ...task,
      due: 'Completed today',
      status: 'Completed',
    };
  },
};
