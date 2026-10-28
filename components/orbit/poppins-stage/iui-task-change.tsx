/**
 * A change to something that already exists — delete, move, reassign, rename — in plain
 * words. Never a tool name or JSON (that showed as `delete task: {"title":"Wash the dishes"}`).
 *
 *   DELETE                         MOVE
 *   Wash the dishes  (struck)      Wash the dishes
 *   Jack · Today                   Jack
 *                                  [Today] → [Friday]
 *
 * Several tasks fit what was said → they're listed to tap. None fit → it says so and shows
 * what's open, so the next sentence (or a tap) can pick.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiPeek } from '@/components/orbit/poppins-stage/iui-peek';
import type { IuiPayload, IuiPeekRow } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

const VERB: Record<NonNullable<IuiPayload['change']>, string> = {
  delete: 'Delete',
  move: 'Move',
  reassign: 'Reassign',
  rename: 'Rename',
};

const DANGER = '#E0465E';

type Props = {
  payload: IuiPayload;
  accent: string;
  fillAccent: string;
  hold: boolean;
  holding?: boolean;
  holdProgress?: number;
  frozen?: boolean;
  onPick: (row: IuiPeekRow) => void;
};

export function IuiTaskChange({ payload, accent, fillAccent, hold, holding, holdProgress, frozen, onPick }: Props) {
  const { c, glass, glassBorder } = useOrbitColors();
  const change = payload.change ?? 'rename';
  const isEvent = Boolean(payload.eventId);
  const verb = isEvent && change === 'delete' ? 'Remove' : VERB[change];
  const kicker = isEvent ? `${verb} event` : `${verb} task`;
  const ready = Boolean(payload.taskId || payload.eventId);
  const ink = change === 'delete' ? DANGER : accent;
  const meta = [change === 'reassign' ? undefined : payload.assignee, change === 'move' ? undefined : payload.dueLabel]
    .filter(Boolean)
    .join(' · ');

  if (!ready) {
    const said = payload.changeQuery?.replace(/^(?:the|my|our)\s+/i, '').trim();
    const rows = payload.choices ?? [];
    return (
      <IuiCard accent={accent} fillAccent={fillAccent} kicker={kicker} accessibilityLabel={kicker}>
        <Text style={[styles.question, { color: c.text }]}>
          {payload.notFound
            ? said
              ? `I can't find “${said}”.`
              : "I can't find that task."
            : 'Which one?'}
        </Text>
        {rows.length ? (
          <>
            <Text style={[styles.hint, { color: c.textMuted }]}>
              {payload.notFound ? 'Here’s what’s open — tap one, or say its name.' : 'Tap it, or say the name.'}
            </Text>
            <IuiPeek rows={rows} accent={ink} max={4} onPress={onPick} />
          </>
        ) : (
          <Text style={[styles.hint, { color: c.textMuted }]}>Nothing is open right now.</Text>
        )}
      </IuiCard>
    );
  }

  return (
    <IuiCard
      accent={accent}
      fillAccent={fillAccent}
      kicker={kicker}
      hold={hold}
      holding={holding}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter={hold ? (holding ? 'Saving…' : 'Saves in a moment — say no to stop') : undefined}
      accessibilityLabel={`${kicker}: ${payload.title ?? ''}${payload.changeTo ? `, to ${payload.changeTo}` : ''}`}>
      <View style={styles.titleRow}>
        <View style={[styles.icon, { backgroundColor: `${ink}22` }]}>
          <MaterialIcons
            name={
              change === 'delete'
                ? 'delete-outline'
                : change === 'move'
                  ? 'event'
                  : change === 'reassign'
                    ? 'person-outline'
                    : 'edit'
            }
            size={20}
            color={ink}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.title,
              { color: c.text },
              change === 'delete' && { textDecorationLine: 'line-through', color: c.textMuted },
            ]}
            numberOfLines={2}>
            {change === 'rename' ? payload.changeFrom ?? payload.title : payload.title}
          </Text>
          {meta ? <Text style={[styles.meta, { color: c.textMuted }]}>{meta}</Text> : null}
        </View>
      </View>

      {change !== 'delete' && payload.changeTo ? (
        <View style={styles.changeRow}>
          <View style={[styles.pill, { backgroundColor: glass(0.06), borderColor: glassBorder(0.12) }]}>
            <Text style={[styles.pillText, { color: c.textMuted }]} numberOfLines={1}>
              {payload.changeFrom || '—'}
            </Text>
          </View>
          <MaterialIcons name="arrow-forward" size={18} color={c.textSubtle} />
          <View style={[styles.pill, { backgroundColor: `${accent}22`, borderColor: `${accent}77` }]}>
            <Text style={[styles.pillText, { color: c.text, fontWeight: '800' }]} numberOfLines={1}>
              {payload.changeTo}
            </Text>
          </View>
        </View>
      ) : null}

      {change === 'delete' ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          {isEvent
            ? 'It comes off the calendar. You can undo for a few seconds.'
            : 'It comes off the list. You can undo for a few seconds.'}
        </Text>
      ) : null}
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  question: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, paddingHorizontal: 4 },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  icon: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  meta: { fontSize: 14, marginTop: 2 },
  changeRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 4 },
  pill: {
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { fontSize: 15, fontWeight: '600' },
});
