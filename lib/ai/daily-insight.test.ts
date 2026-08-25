/**
 * Daily insights: catalog products, no FreshMart, 3/day cap, dismiss stays dismissed.
 * Run: npx --yes tsx lib/ai/daily-insight.test.ts
 */
import assert from 'node:assert/strict';

import { __resetGrocerySearchIndex } from '@/lib/grocery/search-index';
import { unreadInboxCount } from '@/lib/poppins/inbox-visibility';
import { buildSheetNotifications, routeForSheetCard } from '@/lib/poppins/notification-buckets';
import type { GroceryItem, HouseholdSnapshot, NotificationItem } from '@/types/orbit';
import {
  buildDailyInsightCandidates,
  countAiInsightsToday,
  DAILY_INSIGHT_CAP,
  isFakeStoreName,
  isJunkMockInsight,
  matchGroceryToCatalog,
  matchListToCatalog,
  pickRealSavedShop,
  shouldSkipKindToday,
} from './daily-insight';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

__resetGrocerySearchIndex();

function grocery(partial: Partial<GroceryItem> & Pick<GroceryItem, 'id' | 'name'>): GroceryItem {
  return {
    category: 'Dairy',
    quantity: '1',
    status: 'Missing',
    ...partial,
  };
}

function note(partial: Partial<NotificationItem> & Pick<NotificationItem, 'id' | 'title'>): NotificationItem {
  return {
    householdId: 'hh',
    body: '',
    category: 'ai',
    priority: 'low',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

{
  assert.equal(isFakeStoreName('FreshMart'), true);
  assert.equal(isFakeStoreName('QuickStop'), true);
  assert.equal(isFakeStoreName('ByteBarn'), true);
  assert.equal(isFakeStoreName('IGA'), false);
  assert.equal(isFakeStoreName('Loblaws'), false);
  pass('fake store names');
}

{
  const milk = matchGroceryToCatalog('Milk');
  assert.ok(milk, 'catalog has milk');
  assert.match(milk!.name, /milk/i);
  assert.equal(/freshmart/i.test(`${milk!.brand ?? ''} ${milk!.name}`), false);
  pass('catalog milk is a researched product');
}

{
  const shop = pickRealSavedShop([
    {
      id: 'place-shop',
      name: 'FreshMart',
      kind: 'shop',
      address: '850 Main St',
      isFavorite: true,
    },
    {
      id: 'place-real',
      name: 'Metro Queen West',
      kind: 'shop',
      address: '100 Queen St W, Toronto, ON M5H 2N2',
    },
  ]);
  assert.ok(shop);
  assert.equal(shop!.name, 'Metro Queen West');
  pass('saved shop skips FreshMart');
}

{
  const matches = matchListToCatalog(
    [grocery({ id: 'g1', name: 'Milk' }), grocery({ id: 'g2', name: 'Eggs' })],
    null
  );
  assert.ok(matches.length >= 1);
  for (const row of matches) {
    assert.equal(isFakeStoreName(row.storeLabel), false);
    assert.ok(row.product.name);
  }
  pass('list match uses catalog, never fake store');
}

{
  const household = {
    groceries: [grocery({ id: 'g1', name: 'Milk' }), grocery({ id: 'g2', name: 'Paper towels' })],
    tasks: [
      {
        id: 't1',
        title: 'Unload dishwasher',
        category: 'Kitchen',
        assignee: 'Liam',
        due: 'Overdue',
        xp: 5,
        status: 'Overdue',
      },
    ],
    events: [],
    itineraries: [],
    savedPlaces: [],
  } as unknown as Pick<
    HouseholdSnapshot,
    'groceries' | 'tasks' | 'events' | 'itineraries' | 'savedPlaces' | 'preferredStoreId'
  >;
  const cards = buildDailyInsightCandidates(household);
  assert.ok(cards.length >= 1 && cards.length <= DAILY_INSIGHT_CAP);
  assert.ok(cards.some((c) => c.kind === 'grocery_need'));
  assert.ok(cards.some((c) => c.kind === 'overdue_work'));
  const groceryCard = cards.find((c) => c.kind === 'grocery_need')!;
  assert.equal(/freshmart|organic whole milk 1gal/i.test(`${groceryCard.title} ${groceryCard.body}`), false);
  assert.match(groceryCard.body, /milk/i);
  pass('necessity insights from real catalog + overdue work');
}

{
  const today = note({
    id: 'n1',
    title: 'Poppins · Groceries',
    body: 'Neilson 2% Milk is still on the list.',
    data: { kind: 'grocery_need', aiGenerated: true },
  });
  const junk = note({
    id: 'n2',
    title: 'Deal nearby',
    body: 'Organic whole milk 1gal at FreshMart',
    data: { kind: 'deals', store: 'FreshMart' },
  });
  assert.equal(countAiInsightsToday([today, junk]), 1);
  assert.equal(shouldSkipKindToday([today], 'grocery_need'), true);
  assert.equal(shouldSkipKindToday([today], 'overdue_work'), false);
  assert.equal(isJunkMockInsight(junk), true);
  pass('cap counting + skip dismissed-kind + junk filter');
}

{
  const dismissed = note({
    id: 'd1',
    title: 'Needs a photo',
    category: 'tasks',
    isRead: true,
    data: { kind: 'proof_submitted', dismissed: true, urgency: 'needs_action' },
  });
  const unread = note({
    id: 'u1',
    title: 'Poppins · Groceries',
    body: 'Eggs are still on the list.',
    data: { kind: 'grocery_need', urgency: 'insight', aiGenerated: true },
  });
  const oldInsight = note({
    id: 'old',
    title: 'Old insight',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isRead: true,
    data: { kind: 'grocery_need', urgency: 'insight', aiGenerated: true },
  });
  assert.equal(unreadInboxCount([dismissed, unread, oldInsight]), 1);

  const cards = buildSheetNotifications([dismissed, unread, oldInsight], null);
  assert.equal(cards.some((c) => c.id === 'd1'), false);
  assert.equal(cards.some((c) => c.id === 'old'), false);
  assert.equal(cards.some((c) => c.id === 'u1'), true);
  pass('dismissed + old insights stay out of the sheet and badge');
}

{
  const junk = note({
    id: 'j1',
    title: 'Deal nearby',
    body: 'Wireless headphones at ByteBarn',
  });
  const cards = buildSheetNotifications([junk], {
    title: 'Morning Briefing',
    summary: 'A calm day.',
    actions: ['Check tasks'],
  });
  assert.equal(cards.some((c) => c.id === 'j1'), false);
  assert.equal(cards.some((c) => c.id === 'morning-brief'), true);
  const brief = cards.find((c) => c.id === 'morning-brief');
  assert.equal(brief?.actionLabel, 'Open Poppins');
  assert.equal(brief?.actionRoute, '/(tabs)/poppins');
  assert.equal(brief ? routeForSheetCard(brief) : null, '/(tabs)/poppins');
  pass('mock deal rows never reappear as Insights');
}

console.log('\ndaily-insight tests passed');
