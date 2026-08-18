/**
 * Admin daily insights — at most 3 per local day, only when there is a real
 * household need, using catalog products and a real/saved/researched shop.
 * Copy is factual; Luna may rewrite the sentence but must not invent stores or prices.
 */

import { isClothingCategory } from '@/lib/grocery/classify';
import type { CatalogProduct } from '@/lib/grocery/catalog';
import { searchCatalog } from '@/lib/grocery/search-index';
import type {
  GroceryItem,
  HouseholdSnapshot,
  HouseholdTask,
  Itinerary,
  NotificationItem,
  SavedPlace,
} from '@/types/orbit';

export const DAILY_INSIGHT_CAP = 3;

export const DAILY_INSIGHT_KINDS = ['grocery_need', 'overdue_work', 'plan_gap'] as const;
export type DailyInsightKind = (typeof DAILY_INSIGHT_KINDS)[number];

const FAKE_STORE_RE =
  /freshmart|quickstop|orbit wholesale|bytebarn|stride outlet|nest\s*&\s*form/i;

export type CatalogGroceryMatch = {
  query: string;
  product: CatalogProduct;
  storeLabel: string | null;
  storeSource: 'saved' | 'catalog' | null;
};

export type DailyInsightCandidate = {
  kind: DailyInsightKind;
  title: string;
  body: string;
  cta: string;
  catalogNames?: string[];
  storeName?: string;
  storeSource?: 'saved' | 'catalog' | 'osm';
};

export function isFakeStoreName(name?: string | null): boolean {
  return Boolean(name && FAKE_STORE_RE.test(name));
}

export function isDismissedNotification(item: { data?: Record<string, unknown> }): boolean {
  return item.data?.dismissed === true;
}

export function isJunkMockInsight(item: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): boolean {
  const kind = typeof item.data?.kind === 'string' ? item.data.kind : '';
  if (kind === 'deals' || kind === 'scan_deals') return true;
  const store = typeof item.data?.store === 'string' ? item.data.store : '';
  return FAKE_STORE_RE.test(`${item.title} ${item.body} ${store}`);
}

export function isSameLocalDay(iso: string, now = Date.now()): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function matchGroceryToCatalog(name: string): CatalogProduct | null {
  const q = name.trim();
  if (q.length < 2) return null;
  return searchCatalog(q, 1)[0] ?? null;
}

function catalogStoreLabel(product: CatalogProduct): string | null {
  const tag = (product.storeTags ?? []).find((t) => t.trim() && !isFakeStoreName(t));
  return tag?.trim() || null;
}

export function pickRealSavedShop(
  places: SavedPlace[] | undefined,
  preferredStoreId?: string | null
): { name: string; address?: string } | null {
  const shops = (places ?? []).filter(
    (p) => (p.kind === 'shop' || p.kind === 'pickup') && !isFakeStoreName(p.name)
  );
  if (preferredStoreId) {
    const preferred = shops.find((p) => p.id === preferredStoreId);
    if (preferred) return { name: preferred.name, address: preferred.address };
  }
  const favorite = shops.find((p) => p.isFavorite);
  if (favorite) return { name: favorite.name, address: favorite.address };
  if (shops[0]) return { name: shops[0].name, address: shops[0].address };
  return null;
}

export function matchListToCatalog(
  groceries: Pick<GroceryItem, 'name' | 'status' | 'productId'>[],
  shop: { name: string } | null
): CatalogGroceryMatch[] {
  const needed = groceries.filter((g) => g.status === 'Missing' || g.status === 'Low');
  const out: CatalogGroceryMatch[] = [];
  const seen = new Set<string>();
  for (const item of needed) {
    const product = matchGroceryToCatalog(item.name);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
    const catalogBanner = catalogStoreLabel(product);
    const storeLabel = shop?.name ?? catalogBanner;
    out.push({
      query: item.name,
      product,
      storeLabel: storeLabel && !isFakeStoreName(storeLabel) ? storeLabel : catalogBanner,
      storeSource: shop?.name ? 'saved' : catalogBanner ? 'catalog' : null,
    });
    if (out.length >= 3) break;
  }
  return out;
}

function openTasks(tasks: HouseholdTask[]): HouseholdTask[] {
  return tasks.filter(
    (t) => t.status === 'Pending' || t.status === 'In Progress' || t.status === 'Overdue'
  );
}

function isOverdueTask(task: HouseholdTask, now: Date): boolean {
  if (task.status === 'Overdue') return true;
  if (task.status === 'Completed' || task.status === 'Cancelled' || task.status === 'Expired') {
    return false;
  }
  if (task.dueAt) {
    const due = new Date(task.dueAt);
    if (!Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) return true;
  }
  const due = String(task.due ?? '').toLowerCase();
  return due.includes('overdue') || due === 'yesterday';
}

function todayYmd(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hasGroceryStopToday(itineraries: Itinerary[] | undefined, ymd: string): boolean {
  return (itineraries ?? []).some((trip) => {
    if (trip.date && trip.date.slice(0, 10) !== ymd) return false;
    if (trip.status === 'completed') return false;
    return (trip.stops ?? []).some(
      (stop) => stop.kind === 'grocery' || stop.kind === 'shop' || stop.kind === 'pickup'
    );
  });
}

function productLine(match: CatalogGroceryMatch): string {
  const brand = match.product.brand ? `${match.product.brand} ` : '';
  return `${brand}${match.product.name}`.trim();
}

export function buildDailyInsightCandidates(
  household: Pick<
    HouseholdSnapshot,
    'groceries' | 'tasks' | 'events' | 'itineraries' | 'savedPlaces' | 'preferredStoreId'
  >,
  now = new Date()
): DailyInsightCandidate[] {
  const candidates: DailyInsightCandidate[] = [];
  const missing = (household.groceries ?? []).filter(
    (item) => item.status === 'Missing' || item.status === 'Low'
  );
  const clothing = missing.filter((item) => isClothingCategory(item.categoryId ?? item.category));
  const shop = pickRealSavedShop(household.savedPlaces, household.preferredStoreId);
  const matches = matchListToCatalog(household.groceries ?? [], shop);

  if (matches.length > 0) {
    const names = matches.map(productLine);
    const listed = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    const store = matches.find((m) => m.storeLabel)?.storeLabel ?? null;
    const storeBit = store
      ? matches[0]?.storeSource === 'catalog'
        ? ` Catalog listing is carried at ${store}.`
        : ` ${store} is the saved shop.`
      : '';
    const shopBit = clothing.length
      ? ` ${clothing[0]!.name} is on the shopping list if you pass a store.`
      : '';
    candidates.push({
      kind: 'grocery_need',
      title: 'Poppins · Groceries',
      body: `${listed} ${matches.length === 1 ? 'is' : 'are'} still on the list.${storeBit}${shopBit}`.replace(/\s+/g, ' ').trim(),
      cta: 'Open Groceries',
      catalogNames: names,
      storeName: store ?? undefined,
      storeSource: (matches.find((m) => m.storeLabel)?.storeSource ?? undefined) as
        | 'saved'
        | 'catalog'
        | undefined,
    });
  } else if (clothing.length > 0) {
    const listed =
      clothing.length === 1
        ? clothing[0]!.name
        : `${clothing
            .slice(0, -1)
            .map((item) => item.name)
            .join(', ')} and ${clothing[clothing.length - 1]!.name}`;
    candidates.push({
      kind: 'grocery_need',
      title: 'Poppins · Shopping',
      body: `${listed} ${clothing.length === 1 ? 'is' : 'are'} on your shopping list. If you pass a store that carries it, Poppins will ping you.`,
      cta: 'Open shopping list',
    });
  }

  const overdue = openTasks(household.tasks ?? []).filter((t) => isOverdueTask(t, now));
  if (overdue.length > 0) {
    const sample = overdue[0]!.title;
    const who = overdue[0]!.assignee ? ` ${overdue[0]!.assignee}` : '';
    const extra = overdue.length > 1 ? ` ${overdue.length - 1} more still open.` : '';
    candidates.push({
      kind: 'overdue_work',
      title: 'Poppins · Tasks',
      body: `${sample} is past due${who ? ` for${who}` : ''}.${extra}`.replace(/\s+/g, ' ').trim(),
      cta: 'Open Task',
    });
  }

  const ymd = todayYmd(now);
  const pickupNames = (household.savedPlaces ?? [])
    .flatMap((p) => p.pickupItemNames ?? [])
    .map((n) => n.trim())
    .filter(Boolean);
  const needsRun = matches.length > 0 || pickupNames.length > 0 || clothing.length > 0;
  if (needsRun && !hasGroceryStopToday(household.itineraries, ymd)) {
    const hint = matches[0] ? productLine(matches[0]) : pickupNames[0];
    candidates.push({
      kind: 'plan_gap',
      title: 'Poppins · Plan',
      body: hint
        ? `Nothing on today's Plan covers a shop stop, and ${hint} still needs a pickup.`
        : `Nothing on today's Plan covers a shop stop for items still on the list.`,
      cta: 'Open Plan',
    });
  }

  return candidates.slice(0, DAILY_INSIGHT_CAP);
}

export function countAiInsightsToday(items: NotificationItem[], now = Date.now()): number {
  return items.filter(
    (item) =>
      item.data?.aiGenerated === true &&
      isSameLocalDay(item.createdAt, now) &&
      !isJunkMockInsight(item)
  ).length;
}

export function insightKindUsedToday(
  items: NotificationItem[],
  kind: string,
  now = Date.now()
): boolean {
  return items.some(
    (item) => String(item.data?.kind ?? '') === kind && isSameLocalDay(item.createdAt, now)
  );
}

/** Same-kind rows from today — including read/dismissed — must not be recreated. */
export function shouldSkipKindToday(
  items: NotificationItem[],
  kind: string,
  extra?: { taskId?: unknown },
  now = Date.now()
): boolean {
  if (!kind) return false;
  return items.some((item) => {
    if (String(item.data?.kind ?? '') !== kind) return false;
    if (!isSameLocalDay(item.createdAt, now)) return false;
    if (kind === 'task_overdue' && extra?.taskId != null) {
      return item.data?.taskId === extra.taskId;
    }
    return true;
  });
}
