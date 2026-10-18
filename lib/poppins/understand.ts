/**
 * Understand before acting.
 *
 * Every sentence Poppins hears or reads goes through here first, and every card it is about to
 * show (from the grammar or from the model) goes through `sanitizeActs` last. The goal is that
 * nothing reaches the screen that doesn't make sense for the house:
 *
 *   prepareUtterance   strip greetings and request wrappers ("Hey Poppins, can you…",
 *                      "Bonjour Poppins, est-ce que tu peux…"), and read common French
 *                      requests into the English the grammar understands.
 *   cleanActTitle      a title is the thing itself: never the person, the day, the request
 *                      wording ("a task to me"), a greeting or a whole sentence.
 *   sanitizeActs       the last gate before a card shows. Repairs what it can, empties what it
 *                      can't (the card then asks), and turns "buy a car" into a task instead of
 *                      a grocery in the Clothing aisle.
 *
 * Pure: no store, no orchestrator.
 */
import { classifyGroceryItem } from '@/lib/grocery/classify';

// ── Language ──────────────────────────────────────────────────────────────────────────────

const FR_MARKERS = [
  'est-ce', 'que', 'tu', 'peux', 'pourrais', 'pouvez', 'vous', 'je', "j'", 'moi', 'pour', 'sur',
  'chez', 'avec', 'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'à', 'au', 'aux',
  'demain', "aujourd'hui", 'ce', 'soir', 'ajoute', 'ajouter', 'rajoute', 'rajouter', 'mets',
  'mettre', 'tâche', 'tache', 'rendez-vous', 'calendrier', 'agenda', "s'il", 'plaît', 'plait',
  'vaisselle', 'courses', 'épicerie', 'bonjour', 'salut', 'merci', 'prochain', 'prochaine',
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche', 'supprime',
  'supprimer', 'enlève', 'déplace', 'assigne', 'assigner', 'fais', 'faire', 'il', 'elle', 'nous',
  'dentiste', 'médecin', 'semaine', 'matin', 'midi',
];
const FR_SET = new Set(FR_MARKERS);
/** Short French words that are also English (or names) — they never count alone. */
const FR_AMBIGUOUS = new Set(['la', 'le', 'de', 'des', 'ce', 'tu', 'et', 'au', 'un', 'pour', 'sur', 'a']);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^\p{L}'-]+/u)
    .filter(Boolean);
}

/** True when a sentence is French rather than English with a French word or two in it. */
export function isLikelyFrench(text: string): boolean {
  const words = tokens(text);
  if (!words.length) return false;
  let strong = 0;
  let any = 0;
  for (const w of words) {
    const bare = w.replace(/^(l|d|j|s|qu)'/, '');
    if (FR_SET.has(w) || FR_SET.has(bare)) {
      any += 1;
      if (!FR_AMBIGUOUS.has(w)) strong += 1;
    } else if (/[àâçéèêëîïôûùüÿœ]/.test(w)) {
      strong += 1;
      any += 1;
    }
  }
  return strong >= 2 || (strong >= 1 && any / words.length >= 0.34);
}

// Unicode-aware word boundaries (\b does not see "â" as a letter).
const L = String.raw`(?<![\p{L}\p{N}'’-])`;
const R = String.raw`(?![\p{L}\p{N}'’-])`;
function fr(pattern: string, flags = 'giu') {
  return new RegExp(`${L}(?:${pattern})${R}`, flags);
}

const FR_DAYS: Array<[string, string]> = [
  ['lundi', 'monday'],
  ['mardi', 'tuesday'],
  ['mercredi', 'wednesday'],
  ['jeudi', 'thursday'],
  ['vendredi', 'friday'],
  ['samedi', 'saturday'],
  ['dimanche', 'sunday'],
];

/** Things people put on the calendar, French → English. */
const FR_EVENT_NOUNS: Array<[string, string]> = [
  ['dentiste', 'dentist'],
  ['orthodontiste', 'orthodontist'],
  ['médecin|medecin|docteur', 'doctor'],
  ['pédiatre|pediatre', 'pediatrician'],
  ['vétérinaire|veterinaire|véto|veto', 'vet'],
  ['coiffeur|coiffeuse', 'hairdresser'],
  ['optométriste|optometriste', 'optometrist'],
  ['réunion|reunion', 'meeting'],
  ['anniversaire', 'birthday'],
  ['entraînement|entrainement|pratique', 'practice'],
  ['école|ecole', 'school'],
  ['garderie', 'daycare'],
  ['travail|bureau', 'work'],
  ['souper|dîner|diner', 'dinner'],
  ['déjeuner|dejeuner', 'breakfast'],
  ['cours de natation', 'swimming lesson'],
  ['natation', 'swimming'],
  ['piscine', 'pool'],
  ['spectacle', 'show'],
  ['fête|fete', 'party'],
];

/** Groceries, French → English. */
const FR_GROCERIES: Array<[string, string]> = [
  ['lait', 'milk'],
  ['pain', 'bread'],
  ['œufs|oeufs|des oeufs|des œufs|œuf|oeuf', 'eggs'],
  ['beurre', 'butter'],
  ['fromage', 'cheese'],
  ['pommes', 'apples'],
  ['pomme', 'apple'],
  ['bananes', 'bananas'],
  ['banane', 'banana'],
  ['café|cafe', 'coffee'],
  ['jus', 'juice'],
  ['eau', 'water'],
  ['poulet', 'chicken'],
  ['riz', 'rice'],
  ['pâtes|pates', 'pasta'],
  ['tomates', 'tomatoes'],
  ['yogourt|yaourt', 'yogurt'],
  ['céréales|cereales', 'cereal'],
  ['sucre', 'sugar'],
  ['farine', 'flour'],
  ['papier de toilette|papier toilette', 'toilet paper'],
  ['savon', 'soap'],
  ['carottes', 'carrots'],
  ['oignons', 'onions'],
  ['patates|pommes de terre', 'potatoes'],
];

/** Chores, French → English (whole phrases first). */
const FR_CHORES: Array<[string, string]> = [
  ['faire la vaisselle|laver la vaisselle|la vaisselle|vaisselle', 'the dishes'],
  ['vider le lave-vaisselle', 'empty the dishwasher'],
  ['sortir les poubelles|sortir la poubelle|sortir les vidanges|les poubelles|la poubelle|poubelles|vidanges', 'take out the trash'],
  ['faire le lavage|faire la lessive|le lavage|la lessive|lavage|lessive', 'the laundry'],
  ["passer l'aspirateur|l'aspirateur|aspirateur", 'vacuum'],
  ['ranger sa chambre|ranger ta chambre|ranger la chambre|ranger ma chambre', 'tidy the room'],
  ['faire son lit|faire le lit|faire ton lit', 'make the bed'],
  ['nourrir le chat', 'feed the cat'],
  ['nourrir le chien', 'feed the dog'],
  ['promener le chien|sortir le chien', 'walk the dog'],
  ['tondre le gazon|tondre la pelouse', 'mow the lawn'],
  ["laver la voiture|laver l'auto|laver le char", 'wash the car'],
  ['arroser les plantes', 'water the plants'],
  ['passer le balai|balayer', 'sweep'],
  ['nettoyer la salle de bain|nettoyer la salle de bains', 'clean the bathroom'],
  ['devoirs', 'homework'],
];

/**
 * Read a French request as the English the grammar understands. Only words it knows are
 * replaced; anything else is left alone (and makes the sentence a job for the model).
 */
export function frenchToEnglish(text: string): string {
  let s = ` ${text.replace(/[’`]/g, "'")} `;
  const sub = (pattern: string, replacement: string) => {
    s = s.replace(fr(pattern), replacement);
  };

  // Greetings and request wrappers → English wrappers (stripped right after).
  sub('bonjour|bonsoir|salut|coucou|allo|allô', 'hi');
  sub(
    "est-ce que tu (?:peux|pourrais)|est-ce que vous (?:pouvez|pourriez)|peux-tu|pourrais-tu|pouvez-vous|" +
      "pourriez-vous|tu peux|tu pourrais|j'aimerais que tu|je voudrais que tu|je veux que tu|" +
      "j'aimerais|je voudrais|je veux|il faut|faudrait|on doit|on devrait",
    'can you'
  );
  sub("s'il te plaît|s'il te plait|s'il vous plaît|s'il vous plait|stp|svp|merci", 'please');

  // Time words before anything that might eat them.
  for (const [frDay, enDay] of FR_DAYS) {
    sub(`${frDay} prochain|prochain ${frDay}`, `next ${enDay}`);
    sub(`chaque ${frDay}|tous les ${frDay}s`, `every ${enDay}`);
    sub(`${frDay}s?`, enDay);
  }
  sub("aujourd'hui", 'today');
  sub('ce soir', 'tonight');
  sub('demain matin', 'tomorrow morning');
  sub('demain soir', 'tomorrow evening');
  sub('demain après-midi|demain apres-midi', 'tomorrow afternoon');
  sub('demain', 'tomorrow');
  sub('cette semaine', 'this week');
  sub('la semaine prochaine|semaine prochaine', 'next week');
  sub('ce week-end|ce weekend|ce fin de semaine|cette fin de semaine', 'this weekend');
  sub('tous les jours|chaque jour', 'every day');
  sub('à midi|a midi|midi', 'at noon');
  // "à 18h", "à 18 h 30", "à 6h30"
  s = s.replace(/(?:à|a)\s+(\d{1,2})\s*h\s*(\d{2})?(?![\p{L}])/giu, (_m, h: string, m?: string) => {
    const hour = Number(h);
    const mins = m ? `:${m}` : '';
    if (hour === 0) return `at 12${mins}am`;
    if (hour < 12) return `at ${hour}${mins}am`;
    if (hour === 12) return `at 12${mins}pm`;
    return `at ${hour - 12}${mins}pm`;
  });

  // Acts.
  sub('rappelle-moi de|rappelle-moi d\'|rappelle moi de', 'remind me to');
  s = s.replace(/rappel(?:le|er)\s+(?:à|a)\s+(\p{Lu}[\p{L}'-]+)\s+(?:de\s+|d')/giu, 'remind $1 to ');
  sub('rappelle à|rappelle-lui de|rappeler à', 'remind');
  sub('rappelle-moi|rappelle moi|rappelle', 'remind me');
  sub("j'ai fini|j'ai terminé|j'ai termine|c'est fait|c'est fini", 'I finished');
  sub('supprimer|supprime|supprimez|effacer|efface|enlever|enlève|enleve|retirer|retire|annuler|annule', 'delete');
  sub('déplacer|déplace|deplace|décaler|décale|decale|reporter|reporte|repousser|repousse', 'move');
  sub('renommer|renomme', 'rename');
  sub('réassigner|réassigne|reassigne', 'reassign');
  sub('assigner|assigne|assignez|attribuer|attribue|donner|donne', 'assign');
  sub('rajouter|rajoute|ajouter|ajoute|ajoutez|mettre|mets|mettez|inscrire|inscris|noter|note|planifier|planifie', 'add');
  sub('créer|crée|cree|creer', 'create');
  sub('acheter|achète|achete', 'buy');

  // Where things go.
  sub(
    "sur le calendrier|au calendrier|dans le calendrier|sur l'agenda|à l'agenda|dans l'agenda|à mon agenda|dans mon agenda|dans mon calendrier|sur mon calendrier",
    'to the calendar'
  );
  sub(
    "à la liste d'épicerie|sur la liste d'épicerie|à la liste de courses|sur la liste de courses|à l'épicerie|aux courses|dans les courses|à la liste|sur la liste",
    'to the grocery list'
  );
  sub("liste d'épicerie|liste de courses|épicerie|epicerie|courses", 'groceries');

  // Objects.
  sub('un rendez-vous|le rendez-vous|rendez-vous|un rdv|rdv', 'an appointment');
  sub('une tâche|une tache|la tâche|la tache|tâche|tache|une corvée|corvée|corvee', 'a task');
  for (const [pattern, en] of FR_CHORES) sub(pattern, en);
  for (const [pattern, en] of FR_GROCERIES) sub(pattern, en);
  sub('chez le|chez la|chez les|chez', 'at the');
  for (const [pattern, en] of FR_EVENT_NOUNS) sub(pattern, en);

  // People.
  sub('pour moi|à moi|a moi', 'for me');
  sub('pour nous', 'for us');
  s = s.replace(/(?:pour|à)\s+(\p{Lu}[\p{L}'-]+)/gu, 'for $1');

  // Glue words.
  sub('et puis|puis|ensuite', 'then');
  sub('et', 'and');
  sub('aussi', 'also');
  sub('avec', 'with');
  sub('pour', 'for');
  sub('dans', 'in');
  sub("le|la|les|l'|un|une|des|du|de|d'", ' ');

  return s.replace(/\s+/g, ' ').trim();
}

/** Words left in a sentence that are still French after `frenchToEnglish`. */
export function frenchResidue(text: string): string[] {
  return tokens(text).filter((w) => {
    if (FR_SET.has(w) && !FR_AMBIGUOUS.has(w)) return true;
    return /[àâçéèêëîïôûùüÿœ]/.test(w);
  });
}

// ── Request wrappers ──────────────────────────────────────────────────────────────────────

const OPENER = new RegExp(
  '^\\s*(?:' +
    [
      String.raw`(?:hi|hey|hello|hiya|yo|ok(?:ay)?|alright|good\s+(?:morning|afternoon|evening))(?:\s+there)?(?:[,\s]+(?:poppins|poppin|nova))?`,
      String.raw`(?:poppins|poppin|nova)`,
      String.raw`(?:so|um+|uh+|er+|erm|oh|well|right)`,
      String.raw`please`,
      String.raw`(?:can|could|would|will)\s+you(?:\s+please)?(?:\s+(?:just|quickly))?`,
      String.raw`(?:i\s+was\s+wondering\s+if\s+you\s+could)`,
      String.raw`(?:is\s+it\s+possible\s+to)`,
      String.raw`(?:i(?:'d|\s+would)\s+like\s+(?:you\s+)?to)`,
      String.raw`(?:i\s+(?:want|need)\s+you\s+to)`,
      String.raw`(?:help\s+me)`,
    ].join('|') +
    String.raw`)(?=[\s,.!?]|$)[\s,.!?]*`,
  'i'
);
const CLOSER = /[\s,]*(?:please|thanks|thank\s+you|thx|for\s+me\s+please|ok(?:ay)?\?*|right\?*)\s*[.!?]*\s*$/i;

/** "Hey Poppins, can you please add milk thanks" → "add milk". */
export function stripRequestFrame(text: string): string {
  let s = text.replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 8; i++) {
    const next = s.replace(OPENER, '').trim();
    if (next === s) break;
    s = next;
  }
  for (let i = 0; i < 3; i++) {
    const next = s.replace(CLOSER, '').trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/^[,.\s]+/, '').trim();
}

export type PreparedUtterance = {
  /** What the grammar should read. */
  text: string;
  /** What was heard, unchanged (the model and captions get this). */
  original: string;
  language: 'en' | 'fr';
  /** French words the reader didn't know — the grammar must not guess at those. */
  residue: string[];
};

export function prepareUtterance(raw: string): PreparedUtterance {
  const original = raw.trim();
  const french = isLikelyFrench(original);
  const read = french ? frenchToEnglish(original) : original;
  const text = stripRequestFrame(read);
  return {
    text: text || read,
    original,
    language: french ? 'fr' : 'en',
    residue: french ? frenchResidue(text) : [],
  };
}

// ── Titles ────────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const WHEN_WORDS = new RegExp(
  String.raw`\b(?:today|tonight|tomorrow(?:\s+(?:morning|afternoon|evening|night))?|` +
    String.raw`this\s+(?:morning|afternoon|evening|weekend|week)|next\s+week|every\s*day|daily|weekly|` +
    String.raw`(?:on|every|next|this)\s+(?:${WEEKDAYS})s?|(?:${WEEKDAYS})s?|` +
    String.raw`(?:at|by|before|after|around)\s+(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|noon|midnight)|` +
    String.raw`\d{1,2}(?::\d{2})?\s*(?:am|pm)|in\s+the\s+(?:morning|afternoon|evening))\b`,
  'gi'
);

/** Request wording that is never part of a task's name. */
const TASK_FRAME = [
  String.raw`^(?:add|create|make|set\s+up|setup|put|assign|give|schedule|remind|new)\s+(?:me\s+|us\s+)?(?:(?:a|an|the|new|another|one)\s+)*(?:task|chore|to-?do|reminder|job)s?\s*(?:called|named|titled|for\s+(?:me|us)\s+to|to|that\s+says|:)?\s*`,
  String.raw`^(?:(?:a|an|the|new|another)\s+)*(?:task|chore|to-?do|reminder|job)s?\s+(?:called|named|titled|to)\s+`,
  String.raw`^(?:remind|tell|ask)\s+(?:me|us|them|him|her|everyone)\s+(?:to|that)\s+`,
  String.raw`^(?:add|create|make|put|schedule)\s+(?:a\s+|an\s+)?`,
];

/** A request verb with nothing after it is not a name ("add", "assign"). */
const BARE_VERB = /^(?:add|create|make|assign|put|set(?:\s+up)?|schedule|remind|do|give|get|buy|move|delete|remove|change|help|tell|show|can|could|please)$/i;

const META_ONLY = /^(?:(?:a|an|the|new|my|another|one|some)\s+)*(?:task|chore|to-?do|reminder|job|thing|something|stuff|it|that|this|event|appointment|item)s?$/i;

/** Capitalise the first letter, Unicode-safe, leaving the rest as written. */
export function capitalizeFirst(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase() + t.slice(1);
}

/** Title Case that understands accented letters ("tâche" → "Tâche", never "TâChe"). */
export function unicodeTitleCase(text: string): string {
  const small = new Set(['to', 'for', 'and', 'of', 'on', 'in', 'at', 'the', 'a', 'an', 'or', 'with']);
  return text
    .split(/(\s+)/)
    .map((part, i) => {
      if (!part.trim()) return part;
      const lower = part.toLocaleLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      return part.charAt(0).toLocaleUpperCase() + part.slice(1);
    })
    .join('');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type TitleContext = {
  memberNames?: string[];
  selfName?: string;
};

/**
 * The thing itself, from whatever a parser or the model proposed as a title.
 * Returns '' when nothing meaningful is left — the card then asks for it.
 *
 *   "Task to Me"                       → ''           (request wording, no task)
 *   "Dishes for Jack Tomorrow"         → "Dishes"
 *   "a task called feed the cat"       → "Feed the cat"
 *   "Bonjour Poppins est-ce que tu…"   → ''           (a sentence, not a name)
 */
export function cleanActTitle(raw: string | undefined | null, ctx: TitleContext = {}): string {
  if (!raw) return '';
  let s = raw.replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // A whole question or greeting is never a name.
  if (/\?\s*$/.test(s)) s = s.replace(/\?+\s*$/, '');
  const prepared = isLikelyFrench(s) ? frenchToEnglish(s) : s;
  s = stripRequestFrame(prepared);

  for (const pattern of TASK_FRAME) {
    s = s.replace(new RegExp(pattern, 'i'), '');
  }

  const names = [...(ctx.memberNames ?? []), ...(ctx.selfName ? [ctx.selfName] : [])]
    .map((n) => n.trim())
    .filter(Boolean)
    .map(escapeRegExp);
  const people = [...names, 'me', 'myself', 'us', 'everyone', 'everybody', 'the kids', 'the family'];
  const who = `(?:${people.join('|')})`;
  // "… for Jack", "… to me", "… with Mia"
  s = s.replace(new RegExp(String.raw`\s+(?:for|to|by|from)\s+${who}(?='s)?(?:'s)?\b`, 'gi'), ' ');
  // "Jack's dishes" → "dishes", "Jack should …" handled by grammar; a bare name alone goes.
  if (names.length) {
    s = s.replace(new RegExp(String.raw`^(?:${names.join('|')})(?:'s)?\s+`, 'i'), '');
    s = s.replace(new RegExp(String.raw`\s+(?:${names.join('|')})$`, 'i'), '');
  }
  s = s.replace(WHEN_WORDS, ' ');
  // Leftover glue at either end.
  s = s
    .replace(/^(?:and|then|also|so|to|for|on|at|by|with|the\s+task|task)\s+/i, '')
    .replace(/\s+(?:and|then|for|to|on|at|by|with|please|instead|again|too|as\s+well)$/i, '')
    .replace(/[.,!;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s+(?:task|chore|to-?do|reminder)s?$/i, '').trim();
  s = s.replace(/^(?:(?:a|an|the|some|my|our|one)\s+)+/i, (m) => (s.split(' ').length > m.trim().split(' ').length ? m : '')).trim();
  if (!s || META_ONLY.test(s) || BARE_VERB.test(s) || /^(?:a|an|the|some|my|our|one)$/i.test(s)) return '';
  if (names.some((n) => new RegExp(`^${n}$`, 'i').test(s))) return '';
  if (/^(?:me|myself|us|you|today|tomorrow|tonight)$/i.test(s)) return '';
  // Still a sentence (a question, a greeting, a clause about Poppins), not a name.
  const words = s.split(' ');
  if (words.length > 7) return '';
  if (/\b(?:you|poppins|nova|can|could|would|est|que|peux)\b/i.test(s) && words.length > 3) return '';
  if (isLikelyFrench(s) && frenchResidue(s).length) return '';
  return s;
}

/** Event titles: the thing on the calendar ("Dentist", "Soccer practice"). */
export function cleanEventTitle(raw: string | undefined | null, ctx: TitleContext = {}): string {
  let s = cleanActTitle(raw, ctx);
  if (!s) return '';
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s
      .replace(/\b(?:to|on|in|onto)?\s*(?:the\s+|my\s+|our\s+)?(?:calendar|agenda)\b/gi, ' ')
      .replace(/^(?:an?\s+)?appointment\s*(?:with|at|for)?\s*/i, '')
      .replace(/^(?:go(?:ing)?\s+to|visit)\s+/i, '')
      .replace(/^(?:for|at|to|with|on|in|the|an?)\s+/i, '')
      .replace(/\s+appointment$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (s === before) break;
  }
  if (!s || META_ONLY.test(s)) return '';
  return capitalizeFirst(s);
}

// ── Groceries ─────────────────────────────────────────────────────────────────────────────

/** Things people say "buy" about that are never on a grocery list. */
const NOT_GROCERIES =
  /\b(?:car|truck|van|bike|bicycle|house|home|apartment|condo|boat|tv|television|computer|laptop|phone|iphone|ipad|tablet|couch|sofa|bed|mattress|fridge|washer|dryer|furniture|ticket|tickets|plane|flight|insurance|gift\s*card|present|appointment|dentist|doctor)\b/i;

/** A list request, so even an odd item belongs on the list ("add charcoal to the list"). */
const LIST_WORDS = /\b(?:grocer(?:y|ies)|shopping\s+list|the\s+list|my\s+list|our\s+list|list|store|costco|walmart|supermarket)\b/i;

/**
 * Is this a thing for the grocery / shopping list, said this way?
 * "buy a car" → no. "add charcoal to the list" → yes. "milk" → yes.
 */
export function isListItem(name: string, utterance: string): boolean {
  const item = name.trim();
  if (!item) return false;
  if (LIST_WORDS.test(utterance)) return !NOT_GROCERIES.test(item) || /\b(?:list|grocer)/i.test(utterance);
  if (NOT_GROCERIES.test(item)) return false;
  const known = classifyGroceryItem(item);
  return known.confidence !== 'fallback';
}

/** "Car" → "Buy a car", "Tickets" → "Buy tickets". */
function buyTitle(name: string): string {
  const item = name.trim().toLocaleLowerCase();
  if (/^(?:a|an|the|some)\s/.test(item) || /s$/.test(item)) return capitalizeFirst(`buy ${item}`);
  return capitalizeFirst(`buy ${/^[aeiou]/.test(item) ? 'an' : 'a'} ${item}`);
}

/** The day a sentence names, as a due label ("Today", "Tomorrow", "Friday"). */
export function spokenDay(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(?:today|tonight|this\s+(?:morning|afternoon|evening))\b/.test(t)) return 'Today';
  if (/\btomorrow\b/.test(t)) return 'Tomorrow';
  const day = t.match(new RegExp(`\\b(?:on\\s+|next\\s+|this\\s+)?(${WEEKDAYS})\\b`));
  if (day) return day[1]!.charAt(0).toUpperCase() + day[1]!.slice(1);
  return undefined;
}

// ── The gate ──────────────────────────────────────────────────────────────────────────────

export type SanitizeContext = TitleContext & {
  /** The sentence the acts came from (English after prepareUtterance). */
  utterance?: string;
};

const TASK_TYPES = new Set(['create_task', 'create_task_draft', 'assign_task']);
const EVENT_TYPES = new Set(['create_calendar_event', 'create_event']);

/**
 * The last check before a card shows. Never invents anything: it removes what isn't the
 * thing, moves an act to where it belongs, and leaves a field empty for the card to ask.
 */
export function sanitizeActs(
  actions: Array<Record<string, unknown>>,
  ctx: SanitizeContext = {}
): Array<Record<string, unknown>> {
  const utterance = ctx.utterance ?? '';
  const out: Array<Record<string, unknown>> = [];
  for (const action of actions) {
    const type = String(action.type ?? '');

    if (TASK_TYPES.has(type)) {
      const next = { ...action };
      // "a task called feed the cat" — the person named it; that name wins over the catalog.
      const named = utterance.match(/\b(?:called|named|titled)\s+["“]?(.+?)["”]?$/i)?.[1];
      if (named) {
        const title = cleanActTitle(named, ctx);
        if (title) {
          next.title = capitalizeFirst(title);
          next.namedByPerson = true;
          delete next.libraryTaskId;
          delete next.taskQuery;
        }
      }
      const libraryTitle = Boolean(next.libraryTaskId) && next.namedByPerson !== true;
      if (!libraryTitle) {
        const before = String(next.title ?? '');
        const cleaned = cleanActTitle(before, ctx);
        next.title = cleaned ? (cleaned === before.trim() ? before.trim() : capitalizeFirst(cleaned)) : '';
        if (!cleaned && before.trim()) {
          // The parser's title was request wording or a sentence — not this task's name.
          delete next.libraryTaskId;
          delete next.taskQuery;
        }
      }
      if (typeof next.title === 'string' && /[\p{Ll}][\p{Lu}]/u.test(next.title)) {
        // "TâChe" — a broken title-case from a non-Unicode \b.
        next.title = unicodeTitleCase(next.title.toLocaleLowerCase());
      }
      // "me" means the speaker — said as the assignee, or as "…to me" / "…for me".
      if (typeof next.assignee === 'string' && /^(?:me|myself|moi)$/i.test(next.assignee) && ctx.selfName) {
        next.assignee = ctx.selfName;
      }
      if (
        !next.assignee &&
        ctx.selfName &&
        /\b(?:(?:to|for)\s+me|assign\s+me|remind\s+me|my\s+(?:task|chore)s?)\b/i.test(utterance)
      ) {
        next.assignee = ctx.selfName;
      }
      // A day said in the sentence that no reader picked up ("…tonight").
      if (!next.due) {
        const day = spokenDay(utterance);
        if (day) next.due = day;
      }
      // A day is never a person ("move the dishes to Friday" used to assign Friday).
      if (typeof next.assignee === 'string' && new RegExp(`^(?:${WEEKDAYS}|today|tomorrow|tonight)$`, 'i').test(next.assignee)) {
        delete next.assignee;
      }
      if (
        typeof next.assignee === 'string' &&
        next.assignee &&
        ctx.memberNames?.length &&
        !ctx.memberNames.some((n) => n.toLowerCase() === String(next.assignee).toLowerCase()) &&
        !(ctx.selfName && ctx.selfName.toLowerCase() === String(next.assignee).toLowerCase())
      ) {
        // Not someone in this house — ask instead of assigning to a stranger.
        delete next.assignee;
      }
      out.push(next);
      continue;
    }

    if (EVENT_TYPES.has(type)) {
      const next = { ...action };
      const before = String(next.title ?? '');
      next.title = cleanEventTitle(before, ctx);
      // "an appointment at the dentist" — the parser read "dentist" as where; it's what.
      const where = String(next.location ?? '').trim();
      if (!next.title && where && /^[\p{L} '-]{2,30}$/u.test(where) && !/\d/.test(where)) {
        next.title = capitalizeFirst(where.replace(/^(?:the|my|our)\s+/i, ''));
        next.location = '';
      }
      out.push(next);
      continue;
    }

    if (type === 'add_grocery') {
      const name = String(action.name ?? '').trim();
      if (name && !isListItem(name, utterance)) {
        // "buy a car" — an errand, not something for the grocery aisle.
        out.push({
          type: 'create_task_draft',
          title: buyTitle(name),
          namedByPerson: true,
          sourceUtterance: action.sourceUtterance ?? utterance,
        });
        continue;
      }
      out.push(action);
      continue;
    }

    out.push(action);
  }
  return out;
}
