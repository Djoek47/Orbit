/**
 * WO12 §B / §C — chore compose. Slots render in speech order; filled slots stay filled.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { IuiCard } from '@/components/orbit/poppins-stage/iui-card';
import { IuiChips } from '@/components/orbit/poppins-stage/iui-chips';
import { IuiDomainGrid } from '@/components/orbit/poppins-stage/iui-domain-grid';
import { IuiFaces } from '@/components/orbit/poppins-stage/iui-faces';
import { IuiGhostField } from '@/components/orbit/poppins-stage/iui-ghost-field';
import { STAGE, stageBorder, stageMuted } from '@/constants/iui-stage';
import { IUI_CREATED_CHIP_ID, IUI_DUE_CHIPS, nextComposeStep } from '@/lib/poppins/iui-compose';
import { renderSlotOrder, type SlotKey } from '@/lib/poppins/slot-order';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { IuiFace, IuiPayload } from '@/lib/poppins/ui-scenes';
import { allLibraryTasks } from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Props = {
  payload: IuiPayload;
  faces: IuiFace[];
  selectedName?: string;
  accent: string;
  fillAccent?: string;
  domains: { id: string; label: string }[];
  hold: boolean;
  holdProgress: number;
  holding: boolean;
  frozen: boolean;
  titleHeard: boolean;
  title: string;
};

function SlotShell({
  label,
  value,
  focused,
  filled,
  dimmed,
  accent,
  children,
}: {
  label: string;
  value?: string;
  focused: boolean;
  filled: boolean;
  dimmed: boolean;
  accent: string;
  children?: ReactNode;
}) {
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  return (
    <View
      style={[
        styles.slot,
        filled && {
          backgroundColor: `${accent}1A`,
          borderColor: `${accent}4D`,
        },
        focused && {
          borderStyle: 'dashed',
          borderColor: isDark ? 'rgba(255,255,255,0.20)' : 'rgba(15,28,42,0.20)',
          backgroundColor: 'transparent',
        },
        dimmed && { opacity: 0.45 },
        !filled && !focused && {
          borderColor: 'transparent',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,28,42,0.02)',
        },
      ]}>
      <Text style={[styles.slotLabel, { color: filled ? accent : muted }]}>{label}</Text>
      <View style={styles.slotBody}>
        {filled && value ? (
          <Text style={[styles.slotValue, { color: c.text }]} numberOfLines={2}>
            {value}
          </Text>
        ) : focused ? (
          children
        ) : (
          <Text style={[styles.slotValue, { color: muted }]}>—</Text>
        )}
      </View>
    </View>
  );
}

export function TaskComposeSteps({
  payload,
  faces,
  selectedName,
  accent,
  fillAccent,
  domains,
  hold,
  holdProgress,
  holding,
  frozen,
  titleHeard,
  title,
}: Props) {
  const { household } = useOrbit();
  const { c, isDark } = useOrbitColors();
  const muted = stageMuted(isDark);
  const fill = fillAccent ?? accent;
  const focus = payload.focusSlot ?? (nextComposeStep(payload) === 'who'
    ? 'assignee'
    : nextComposeStep(payload) === 'when'
      ? 'due'
      : nextComposeStep(payload) === 'task' || nextComposeStep(payload) === 'category'
        ? 'title'
        : null);
  const order = renderSlotOrder(payload);
  const spoken = new Set(payload.slotOrder ?? []);
  const categoryId = payload.category ?? payload.selectedChipId;
  const query = (payload.taskQuery ?? '').toLowerCase().trim();
  const libraryTasks = allLibraryTasks()
    .filter((task) => !categoryId || task.domainId === categoryId)
    .filter((task) => {
      if (!query) return true;
      return (
        task.name.toLowerCase().includes(query) ||
        task.searchTerms.some((term) => term.toLowerCase().includes(query))
      );
    })
    .slice(0, 8);
  const homework = categoryId === 'homework_education';
  const whoFaces = homework
    ? faces.filter((face) =>
        household.members.some((m) => m.id === face.id && m.role === 'child')
      )
    : faces;
  const shownFaces = whoFaces.length ? whoFaces : faces;
  const displayTitle = payload.title ?? title;
  const ready = hold && (payload.composeReady === true || focus == null);

  const slotFilled = (key: SlotKey) => {
    if (key === 'title') return Boolean(displayTitle?.trim() || payload.libraryTaskId);
    if (key === 'assignee') return Boolean(payload.assignee?.trim());
    if (key === 'due') return Boolean(payload.due?.trim());
    return false;
  };

  const slotValue = (key: SlotKey) => {
    if (key === 'title') return displayTitle;
    if (key === 'assignee') return payload.assignee;
    if (key === 'due') return payload.due;
    return undefined;
  };

  const slotLabel = (key: SlotKey) => {
    if (key === 'title') return 'WHAT';
    if (key === 'assignee') return 'WHO';
    if (key === 'due') return 'WHEN';
    return key.toUpperCase();
  };

  return (
    <IuiCard
      accent={accent}
      fillAccent={fill}
      kicker={homework ? 'Homework' : 'Chores'}
      hold={ready}
      holding={holding && ready}
      holdProgress={holdProgress}
      frozen={frozen}
      leftFooter={ready ? 'Holding…' : 'Fill the dashed slot'}
      accessibilityLabel="Task card">
      <View style={styles.header}>
        <View style={[styles.domainTile, { backgroundColor: `${fill}24` }]}>
          <Text style={[styles.domainGlyph, { color: fill }]}>✓</Text>
        </View>
        <View style={{ flex: 1 }}>
          {displayTitle?.trim() ? (
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={2}>
              {displayTitle}
            </Text>
          ) : (
            <IuiGhostField text="What is it called?" accent={accent} />
          )}
          <Text style={[styles.headerDetail, { color: muted }]} numberOfLines={1}>
            {[categoryId?.replace(/_/g, ' '), payload.due].filter(Boolean).join(' · ') || 'Chore'}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: stageBorder(isDark) }]} />

      {order.map((key) => {
        const filled = slotFilled(key) && (spoken.has(key) || payload.slotSource?.[key] === 'speech' || payload.slotSource?.[key] === 'touch' || focus !== key);
        const isFocus = focus === key && !slotFilled(key);
        // Filled by speech/touch: show value, never re-ask.
        const showFilled = slotFilled(key) && !isFocus;
        const dimmed = !showFilled && !isFocus;
        return (
          <SlotShell
            key={key}
            label={slotLabel(key)}
            value={slotValue(key)}
            filled={showFilled}
            focused={isFocus}
            dimmed={dimmed}
            accent={fill}>
            {isFocus && key === 'assignee' ? (
              <IuiFaces
                faces={shownFaces}
                selectedName={selectedName}
                pulsingName={payload.spokenName}
                accent={fill}
                onSelect={(name) =>
                  poppinsUiOrchestrator.chooseFromTap(
                    { assignee: name, spokenName: name },
                    name,
                    'face'
                  )
                }
              />
            ) : null}
            {isFocus && key === 'due' ? (
              <IuiChips
                chips={IUI_DUE_CHIPS.map((chip) => ({ id: chip.id, label: chip.label }))}
                selectedId={payload.due}
                accent={fill}
                onSelect={(id) => {
                  poppinsUiOrchestrator.chooseFromTap(
                    { due: id, repeat: id === 'Daily' ? 'Daily' : undefined },
                    id,
                    'when'
                  );
                }}
              />
            ) : null}
            {isFocus && key === 'title' ? (
              <View style={{ gap: 8, width: '100%' }}>
                {!categoryId ? (
                  <IuiDomainGrid
                    domains={domains}
                    selectedId={categoryId}
                    accent={fill}
                    onSelect={(id) => {
                      poppinsUiOrchestrator.chooseFromTap(
                        {
                          selectedChipId: id,
                          category: id,
                          title: '',
                          libraryTaskId: undefined,
                        },
                        domains.find((d) => d.id === id)?.label ?? id,
                        'category'
                      );
                    }}
                  />
                ) : (
                  <IuiChips
                    chips={[
                      ...libraryTasks.map((task) => ({
                        id: task.id,
                        label: task.name,
                      })),
                      { id: IUI_CREATED_CHIP_ID, label: displayTitle || 'Custom' },
                    ]}
                    selectedId={payload.libraryTaskId ?? (displayTitle ? IUI_CREATED_CHIP_ID : undefined)}
                    accent={fill}
                    onSelect={(id) => {
                      if (id === IUI_CREATED_CHIP_ID) {
                        poppinsUiOrchestrator.chooseFromTap(
                          { libraryTaskId: undefined },
                          displayTitle || 'Custom',
                          'task'
                        );
                        return;
                      }
                      const task = libraryTasks.find((row) => row.id === id);
                      poppinsUiOrchestrator.chooseFromTap(
                        {
                          libraryTaskId: id,
                          title: task?.name,
                          category: task?.domainId ?? categoryId,
                        },
                        task?.name ?? id,
                        'task'
                      );
                    }}
                  />
                )}
              </View>
            ) : null}
          </SlotShell>
        );
      })}
    </IuiCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 12, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  domainTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainGlyph: { fontSize: 22, fontWeight: '700' },
  headerTitle: { fontSize: 24, lineHeight: 29, fontWeight: '600', letterSpacing: -0.3 },
  headerDetail: { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 8 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 3,
  },
  slotLabel: {
    width: 42,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  slotBody: { flex: 1 },
  slotValue: { fontSize: 15, fontWeight: '600' },
});
