#!/usr/bin/env node
/**
 * Mock-first persistence check for Rewards vault:
 * Liam requests/redeems → Sarah sees notification → Sarah approves → Liam sees approval.
 * Also covers assign-on-mint + allowance request/approve.
 *
 * Run: node scripts/test-rewards-vault-flow.mjs
 */

const REWARD_REVIEW_ROLES = ['owner', 'admin', 'adult'];

function isNotificationVisibleToMember(item, member) {
  const audienceIds = item.data?.audienceMemberIds;
  if (Array.isArray(audienceIds) && audienceIds.length > 0) {
    return Boolean(member && audienceIds.some((id) => id === member.id));
  }
  const audience = item.data?.audienceRoles;
  if (!Array.isArray(audience) || audience.length === 0) return true;
  if (!member) return false;
  return audience.some((role) => role === member.role);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
  console.log(`ok  ${message}`);
}

function createFlowStore() {
  const members = {
    m1: { id: 'm1', name: 'Sarah', role: 'owner', xp: 1200 },
    m4: { id: 'm4', name: 'Liam', role: 'child', xp: 390 },
  };
  let activeId = 'm1';
  const rewards = [
    {
      id: 'r9',
      title: 'Liam gaming bonus',
      cost: 40,
      approvalRequired: true,
      assignedMemberId: 'm4',
      assignedMemberName: 'Liam',
      archived: false,
    },
  ];
  const redemptions = [];
  const allowances = [];
  const notifications = [];
  let seq = 1;

  return {
    get current() {
      return members[activeId];
    },
    switchPersona(id) {
      activeId = id;
    },
    visibleNotifications() {
      return notifications.filter((item) =>
        isNotificationVisibleToMember(item, members[activeId])
      );
    },
    mintAssigned({ title, cost, memberId }) {
      const assignee = members[memberId];
      const reward = {
        id: `r-${seq++}`,
        title,
        cost,
        approvalRequired: true,
        assignedMemberId: assignee.id,
        assignedMemberName: assignee.name,
        archived: false,
      };
      rewards.unshift(reward);
      notifications.unshift({
        id: `n-${seq++}`,
        title: 'Nova · Reward assigned',
        body: `${members[activeId].name} minted "${title}" for you`,
        data: { kind: 'reward_assigned', audienceMemberIds: [memberId], rewardId: reward.id },
      });
      return reward;
    },
    claim(rewardId) {
      const reward = rewards.find((item) => item.id === rewardId && !item.archived);
      assert(reward, `reward ${rewardId} exists`);
      assert(
        !reward.assignedMemberId ||
          reward.assignedMemberId === activeId ||
          members[activeId].role === 'owner',
        'assignee or admin can claim'
      );
      assert(members[activeId].xp >= reward.cost, 'enough XP');
      const redemption = {
        id: `rd-${seq++}`,
        rewardId,
        memberId: activeId,
        status: 'pending',
      };
      redemptions.unshift(redemption);
      notifications.unshift({
        id: `n-${seq++}`,
        title: 'Nova · Reward request',
        body: `${members[activeId].name} requested ${reward.title}`,
        data: {
          kind: 'reward_requested',
          redemptionId: redemption.id,
          audienceRoles: [...REWARD_REVIEW_ROLES],
        },
      });
      return redemption;
    },
    approve(redemptionId) {
      const pending = redemptions.find((item) => item.id === redemptionId);
      assert(pending && pending.status === 'pending', 'pending redemption');
      const reward = rewards.find((item) => item.id === pending.rewardId);
      pending.status = 'approved';
      members[pending.memberId].xp -= reward.cost;
      if (reward.assignedMemberId) reward.archived = true;
      notifications.unshift({
        id: `n-${seq++}`,
        title: 'Nova · Reward approved',
        body: `${reward.title} is good to go`,
        data: {
          kind: 'reward_approved',
          redemptionId,
          audienceMemberIds: [pending.memberId],
        },
      });
    },
    requestAllowance(amountLabel) {
      const grant = {
        id: `a-${seq++}`,
        memberId: activeId,
        memberName: members[activeId].name,
        amountLabel,
        status: 'pending',
      };
      allowances.unshift(grant);
      notifications.unshift({
        id: `n-${seq++}`,
        title: 'Nova · Allowance request',
        body: `${grant.memberName} asked for ${amountLabel}`,
        data: {
          kind: 'allowance_requested',
          allowanceId: grant.id,
          audienceRoles: [...REWARD_REVIEW_ROLES],
        },
      });
      return grant;
    },
    approveAllowance(allowanceId) {
      const grant = allowances.find((item) => item.id === allowanceId);
      assert(grant && grant.status === 'pending', 'pending allowance');
      grant.status = 'approved';
      notifications.unshift({
        id: `n-${seq++}`,
        title: 'Nova · Allowance approved',
        body: `${grant.amountLabel} is approved`,
        data: {
          kind: 'allowance_approved',
          allowanceId,
          audienceMemberIds: [grant.memberId],
        },
      });
    },
    snapshot() {
      return { rewards, redemptions, allowances, notifications, members };
    },
  };
}

function main() {
  const store = createFlowStore();

  // 1) Sarah mints + assigns to Liam
  store.switchPersona('m1');
  const minted = store.mintAssigned({ title: 'Bike ride treat', cost: 50, memberId: 'm4' });
  assert(minted.assignedMemberId === 'm4', 'mint assigns to Liam');

  store.switchPersona('m4');
  assert(
    store.visibleNotifications().some((n) => n.data?.kind === 'reward_assigned'),
    'Liam sees assign notification'
  );
  store.switchPersona('m1');
  assert(
    !store.visibleNotifications().some((n) => n.data?.kind === 'reward_assigned'),
    'Sarah does not see Liam-only assign note'
  );

  // 2) Liam requests assigned gaming bonus
  store.switchPersona('m4');
  const redemption = store.claim('r9');
  assert(redemption.status === 'pending', 'Liam redemption pending');
  assert(
    store.visibleNotifications().every((n) => n.data?.kind !== 'reward_requested'),
    'Liam does not see admin reward-request inbox item'
  );

  // 3) Sarah receives request + approves (state persists across persona switch)
  store.switchPersona('m1');
  const sarahInbox = store.visibleNotifications();
  assert(
    sarahInbox.some((n) => n.data?.kind === 'reward_requested' && n.body.includes('Liam')),
    'Sarah sees Liam reward request notification'
  );
  store.approve(redemption.id);

  // 4) Liam sees approval; XP spent; assigned reward archived
  store.switchPersona('m4');
  assert(
    store.visibleNotifications().some((n) => n.data?.kind === 'reward_approved'),
    'Liam sees reward approval'
  );
  const snap = store.snapshot();
  assert(snap.members.m4.xp === 350, 'Liam XP reduced by 40');
  assert(snap.rewards.find((r) => r.id === 'r9')?.archived === true, 'assigned reward archived');

  // 5) Allowance: Liam asks → Sarah approves → Liam notified
  store.switchPersona('m4');
  const grant = store.requestAllowance('$5');
  store.switchPersona('m1');
  assert(
    store.visibleNotifications().some((n) => n.data?.kind === 'allowance_requested'),
    'Sarah sees allowance request'
  );
  store.approveAllowance(grant.id);
  store.switchPersona('m4');
  assert(
    store.visibleNotifications().some((n) => n.data?.kind === 'allowance_approved'),
    'Liam sees allowance approval'
  );

  // Persistence: same module-level arrays still hold state after switches
  assert(snap.redemptions[0].status === 'approved', 'redemption persists as approved');
  assert(
    store.snapshot().allowances.find((a) => a.id === grant.id)?.status === 'approved',
    'allowance persists as approved'
  );

  if (process.exitCode) {
    console.error('\nRewards vault flow FAILED');
    process.exit(1);
  }
  console.log('\nRewards vault flow PASSED (Liam ↔ Sarah notifications + persistence)');
}

main();
