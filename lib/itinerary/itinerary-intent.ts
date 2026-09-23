/**
 * Local grammar for multi-stop Plan / itinerary utterances (WO10 D3).
 */

export type ItineraryStopIntent = {
  label: string;
  placeQuery?: string;
  address?: string;
  time?: string;
  kind: 'shop' | 'school' | 'work' | 'gym' | 'appointment' | 'other' | 'practice' | 'pickup';
  notes?: string;
};

export type ItineraryIntent = {
  type: 'create_itinerary';
  title: string;
  date?: string;
  stops: ItineraryStopIntent[];
  sourceUtterance?: string;
};

const ITINERARY_CUE =
  /\b(create|make|plan|build|set\s*up)\s+(me\s+)?(an?\s+)?(itinerary|trip|route)\b|\bitinerary\s*:/i;

function kindFromLabel(label: string): ItineraryStopIntent['kind'] {
  const t = label.toLowerCase();
  if (/\b(shop|shopping|store|grocery|groceries|market)\b/.test(t)) return 'shop';
  if (/\b(school|kids?\s+practice|practice|soccer|ballet|piano)\b/.test(t)) {
    if (/\bschool\b/.test(t)) return 'school';
    return 'practice';
  }
  if (/\bwork|office\b/.test(t)) return 'work';
  if (/\bgym|workout|fitness\b/.test(t)) return 'gym';
  if (/\b(dentist|doctor|appointment|appointment)\b/.test(t)) return 'appointment';
  if (/\bpick\s*up|pickup\b/.test(t)) return 'pickup';
  return 'other';
}

function cleanStopLabel(raw: string): string {
  return raw
    .replace(/^(then|after that|go to|to|the|on my break|back to)\s+/i, '')
    .replace(/\s+on my break\b/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(label: string): string {
  if (!label) return label;
  return label.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function extractTime(chunk: string): { label: string; time?: string } {
  const at = chunk.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (at) {
    return {
      label: chunk.replace(at[0], '').replace(/\s+/g, ' ').trim(),
      time: at[1]!.trim(),
    };
  }
  const morning = chunk.match(/\bin the morning\b/i);
  if (morning) {
    return {
      label: chunk.replace(morning[0], '').replace(/\s+/g, ' ').trim(),
      time: 'morning',
    };
  }
  const afterWork = chunk.match(/\bafter work\b/i);
  if (afterWork) {
    return {
      label: chunk.replace(afterWork[0], '').replace(/\s+/g, ' ').trim(),
      time: 'after work',
    };
  }
  return { label: chunk };
}

/** Detect a chained multi-stop itinerary request. */
export function parseItineraryIntent(utterance: string): ItineraryIntent | null {
  const text = utterance.trim();
  if (!text) return null;
  if (!ITINERARY_CUE.test(text) && !/\bthen\b.+\bthen\b/i.test(text)) {
    // Require itinerary cue OR at least two "then" chains with trip-ish words.
    return null;
  }
  if (!ITINERARY_CUE.test(text)) return null;

  const afterCue = text
    .replace(/^.*?\bitinerary\s*:\s*/i, '')
    .replace(/^.*?\b(itinerary|trip|route)\b[:\s]*/i, '')
    .trim();
  const body = afterCue || text;

  // Normalize connectors so comma lists and "then" chains share one splitter.
  const normalized = body
    .replace(/\bback to\b/gi, 'then')
    .replace(/\bon my break\b/gi, '')
    .replace(/\s*,\s*/g, ', then ')
    .replace(/(?:\s+then\s+)+/gi, ' then ')
    .trim();

  const parts = normalized
    .split(/\s+then\s+/i)
    .map((c) => c.replace(/^[,:\s]+|[,.\s]+$/g, '').trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const stops: ItineraryStopIntent[] = [];
  for (const part of parts) {
    const { label: rawLabel, time } = extractTime(part);
    const label = titleCase(cleanStopLabel(rawLabel));
    if (!label || label.length < 2) continue;
    if (/^(create|make|plan|itinerary|trip|route)$/i.test(label)) continue;
    const kind = kindFromLabel(label);
    stops.push({
      label,
      kind,
      time,
      placeQuery: label,
    });
  }

  if (stops.length < 2) return null;

  return {
    type: 'create_itinerary',
    title: 'Trip',
    stops,
    sourceUtterance: text,
  };
}

export function mapStopKindToStore(
  kind: ItineraryStopIntent['kind']
): 'school' | 'work' | 'grocery' | 'pickup' | 'practice' | 'family' | 'home' | 'shop' | 'custom' {
  switch (kind) {
    case 'shop':
      return 'shop';
    case 'school':
      return 'school';
    case 'work':
      return 'work';
    case 'gym':
    case 'practice':
      return 'practice';
    case 'pickup':
      return 'pickup';
    case 'appointment':
    case 'other':
    default:
      return 'custom';
  }
}
