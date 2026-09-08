import { isTodayTask } from '@/lib/tasks/today';
import { runMonitorPass } from '@/services/poppins-monitor';
import type {
  HouseholdMember,
  HouseholdSnapshot,
  HouseholdTask,
  PoppinsBriefing,
  PoppinsConversationAnswer,
  PoppinsNotificationPrefs,
  PoppinsRecommendation,
  PoppinsWeeklyBriefing,
  OrbitMetrics,
} from '@/types/orbit';

export const suggestedPoppinsQuestions = [
  'What needs attention today?',
  'Any deals worth grabbing?',
  'Is XP fair this week?',
  'Who is away / on holiday?',
  'Propose a Thursday errand loop',
] as const;

export const poppinsService = {
  generateDailyBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): PoppinsBriefing {
    const tasksDueToday = household.tasks.filter((task) => isTodayTask(task) && task.status !== 'Completed');
    const overdueTasks = household.tasks.filter((task) => task.status === 'Overdue');
    const missingGroceries = household.groceries.filter((item) => item.status === 'Missing');
    const nextEvent = household.events[0];
    const overloadedMember = getMostLoadedMember(household.members);

    const eventText = nextEvent
      ? `${nextEvent.title} is at ${cleanTime(nextEvent.time)}`
      : 'there are no calendar events on deck';
    const pressureText =
      overdueTasks.length > 0
        ? `${overdueTasks.length} overdue ${pluralize('task', overdueTasks.length)} need attention`
        : `${tasksDueToday.length} ${pluralize('task', tasksDueToday.length)} due today`;

    return {
      title: metrics.momentum >= 80 ? 'Your household is steady today' : 'Poppins sees a few pressure points',
      summary: `Good morning. You have ${pressureText}, ${missingGroceries.length} missing grocery ${pluralize(
        'item',
        missingGroceries.length
      )}, and ${eventText}. Household Momentum is ${metrics.momentum}%.`,
      actions: [
        overdueTasks.length > 0 ? 'Clear overdue tasks first' : "Review today's task list",
        missingGroceries.length >= 3 ? 'Plan a grocery run' : 'Check pantry gaps',
        overloadedMember ? `Rebalance ${overloadedMember.name}'s load` : 'Keep responsibilities balanced',
      ],
    };
  },

  generateWeeklyBriefing(household: HouseholdSnapshot, metrics: OrbitMetrics): PoppinsWeeklyBriefing {
    const completedTasks = household.tasks.filter((task) => task.status === 'Completed');
    const missedTasks = household.tasks.filter((task) => task.status === 'Overdue');
    const purchasedGroceries = household.groceries.filter((item) => item.status === 'Purchased');
    const mostActiveMember = getMostActiveMember(household.members);
    const xpEarned = completedTasks.reduce((sum, task) => sum + task.xp, 0);
    const momentumChange = metrics.momentum - household.momentum + household.trend;
    const recommendations = this.generateRecommendations(household, metrics).map((item) => item.title);

    return {
      title: 'Weekly household report',
      summary: `${completedTasks.length} ${pluralize('task', completedTasks.length)} completed, ${
        missedTasks.length
      } missed, and ${purchasedGroceries.length} grocery ${pluralize(
        'item',
        purchasedGroceries.length
      )} purchased. ${mostActiveMember.name} is the most active member this week.`,
      tasksCompleted: completedTasks.length,
      tasksMissed: missedTasks.length,
      groceriesPurchased: purchasedGroceries.length,
      mostActiveMember: mostActiveMember.name,
      xpEarned,
      momentumChange,
      recommendations: recommendations.length > 0 ? recommendations : ['Keep the current rhythm going next week'],
    };
  },

  generateRecommendations(household: HouseholdSnapshot, metrics: OrbitMetrics): PoppinsRecommendation[] {
    const recommendations: PoppinsRecommendation[] = [];
    const missingGroceries = household.groceries.filter((item) => item.status === 'Missing');
    const overdueTasks = household.tasks.filter((task) => task.status === 'Overdue');
    const overloadedMember = getMostLoadedMember(household.members);
    const childWithProgress = household.members.find((member) => member.role === 'child' && member.xp >= 350);

    if (missingGroceries.length >= 3 || metrics.groceryReadiness < 70) {
      recommendations.push({
        id: 'shopping-run',
        title: 'Plan a grocery run',
        detail: `${missingGroceries.length} items are missing. A short shop would lift grocery readiness.`,
        tone: 'amber',
      });
    }

    if (overloadedMember && overloadedMember.loadShare >= 45) {
      recommendations.push({
        id: 'rebalance-load',
        title: `Rebalance ${overloadedMember.name}'s tasks`,
        detail: `${overloadedMember.name} is carrying ${overloadedMember.loadShare}% of the household load.`,
        tone: 'cyan',
      });
    }

    if (overdueTasks.length > 0) {
      recommendations.push({
        id: 'clear-overdue',
        title: 'Clear or reassign overdue tasks',
        detail: `${overdueTasks.length} overdue ${pluralize('task', overdueTasks.length)} are lowering momentum.`,
        tone: 'red',
      });
    }

    if (household.events.length === 0) {
      recommendations.push({
        id: 'add-events',
        title: 'Add calendar coverage',
        detail: 'No events are scheduled yet. Adding pickups, practices, or appointments helps Poppins plan ahead.',
        tone: 'blue',
      });
    }

    if (childWithProgress) {
      recommendations.push({
        id: 'reward-progress',
        title: `Offer ${childWithProgress.name} a reward moment`,
        detail: `${childWithProgress.name} has ${childWithProgress.xp} XP and is close to the next reward milestone.`,
        tone: 'green',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        id: 'steady-rhythm',
        title: 'Protect the current rhythm',
        detail: 'Momentum, groceries, and calendar coverage are all in a healthy range.',
        tone: 'green',
      });
    }

    return recommendations;
  },

  answerQuestion(question: string, household: HouseholdSnapshot, metrics: OrbitMetrics): PoppinsConversationAnswer {
    const normalizedQuestion = question.toLowerCase();
    const missingGroceries = household.groceries.filter((item) => item.status === 'Missing');
    const overdueTasks = household.tasks.filter((task) => task.status === 'Overdue');
    const openTasks = household.tasks.filter((task) => task.status !== 'Completed');
    const busiestAssignee = getBusiestAssignee(openTasks);

    if (normalizedQuestion.includes('attention')) {
      return {
        question,
        answer:
          overdueTasks.length > 0
            ? `${overdueTasks.length} overdue ${pluralize('task', overdueTasks.length)} need attention first: ${overdueTasks
                .map((task) => task.title)
                .join(', ')}.`
            : `Today looks manageable. Watch ${openTasks.length} open ${pluralize(
                'task',
                openTasks.length
              )} and ${missingGroceries.length} missing grocery ${pluralize('item', missingGroceries.length)}.`,
      };
    }

    if (normalizedQuestion.includes('grocer')) {
      return {
        question,
        answer:
          missingGroceries.length > 0
            ? `Missing groceries: ${missingGroceries.map((item) => item.name).join(', ')}.`
            : 'No groceries are marked missing right now.',
      };
    }

    if (normalizedQuestion.includes('most tasks')) {
      return {
        question,
        answer: busiestAssignee
          ? `${busiestAssignee.name} has the most open tasks with ${busiestAssignee.count}.`
          : 'No one has open tasks right now.',
      };
    }

    if (normalizedQuestion.includes('momentum')) {
      return {
        question,
        answer: `Household Momentum is ${metrics.momentum}%. It is based on ${metrics.taskCompletionRate}% task completion, ${metrics.groceryReadiness}% grocery readiness, and ${metrics.calendarCoverage}% calendar coverage.`,
      };
    }

    return {
      question,
      answer: this.generateRecommendations(household, metrics)[0].detail,
    };
  },

  /** Mock Monitor Agent pass (same checks as edge poppins-monitor without OpenAI). */
  runMonitorPass(household: HouseholdSnapshot, metrics: OrbitMetrics, prefs: PoppinsNotificationPrefs) {
    return runMonitorPass(household, metrics, prefs);
  },
};

function cleanTime(value: string) {
  return value.replace('Today, ', '').replace('Tomorrow, ', '');
}

function getMostLoadedMember(members: HouseholdMember[]) {
  return members.reduce<HouseholdMember | null>(
    (leader, member) => (!leader || member.loadShare > leader.loadShare ? member : leader),
    null
  );
}

function getMostActiveMember(members: HouseholdMember[]) {
  return members.reduce((leader, member) => (member.xp > leader.xp ? member : leader), members[0] ?? {
    id: 'none',
    name: 'No one',
    role: 'guest',
    status: 'inactive',
    avatar: 'O',
    xp: 0,
    loadShare: 0,
  });
}

function getBusiestAssignee(tasks: HouseholdTask[]) {
  const counts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.assignee] = (acc[task.assignee] ?? 0) + 1;
    return acc;
  }, {});
  const [name, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];

  return name ? { name, count } : null;
}

function pluralize(word: string, count: number) {
  return count === 1 ? word : `${word}s`;
}
