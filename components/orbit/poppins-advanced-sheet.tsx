import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { AppText as Text } from '@/components/orbit/app-text';
import { SegmentedControl } from '@/components/orbit/segmented-control';
import { SettingsGroup, SettingsToggleRow } from '@/components/orbit/settings/grouped';
import { space, typography } from '@/constants/orbit-theme';
import {
  type PoppinsConfirmTime,
  type PoppinsInteractionPrefs,
  type PoppinsUndoWindowSec,
} from '@/lib/poppins/poppins-prefs';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type PoppinsAdvancedSheetProps = {
  visible: boolean;
  prefs: PoppinsInteractionPrefs;
  disabled?: boolean;
  onDismiss: () => void;
  onChange: (next: PoppinsInteractionPrefs) => void;
};

/** Fine knobs. Leaving the Base/Max preset shows Custom on the main cards. */
export function PoppinsAdvancedSheet({
  visible,
  prefs,
  disabled,
  onDismiss,
  onChange,
}: PoppinsAdvancedSheetProps) {
  const { c } = useOrbitColors();
  const patch = (next: Partial<PoppinsInteractionPrefs>) => {
    if (disabled) return;
    onChange({ ...prefs, ...next });
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.78}>
      <View style={styles.body}>
        <Text style={[typography.title2, { color: c.text }]}>Advanced</Text>
        <Text style={[typography.footnote, { color: c.textMuted, marginBottom: 8 }]}>
          These change how Poppins waits, writes, and notifies. They do not change Base or Max cost.
          Tuning them marks this household as Custom.
        </Text>
        <SettingsGroup footer="Act immediately skips the pause before saving. You can still undo.">
          <SettingsToggleRow
            label="Act immediately"
            subtitle="Skips the pause before saving."
            value={prefs.actImmediately}
            disabled={disabled}
            onValueChange={(actImmediately) => patch({ actImmediately })}
          />
          <SettingsToggleRow
            label="Show thinking"
            subtitle='A short "thinking" moment while Poppins works it out.'
            value={prefs.showThinking}
            disabled={disabled}
            onValueChange={(showThinking) => patch({ showThinking })}
          />
          <SettingsToggleRow
            label="Written replies"
            subtitle="Poppins writes its answer on screen. Questions always show."
            value={prefs.writtenReplies}
            disabled={disabled}
            onValueChange={(writtenReplies) => patch({ writtenReplies })}
          />
          <SettingsToggleRow
            label="Notification actions"
            subtitle="Approve or change Poppins' suggestions right from a notification."
            value={prefs.notificationActions}
            disabled={disabled}
            last
            onValueChange={(notificationActions) => patch({ notificationActions })}
          />
        </SettingsGroup>
        <SettingsGroup footer="Fine-tune Guided. Children see this read-only.">
          <View style={styles.segmentPad}>
            <SegmentedControl
              label="Confirm time"
              subtitle="How long Poppins waits in silence before saving."
              disabled={disabled}
              options={[
                { value: 'quick', label: 'Quick' },
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' },
              ]}
              value={prefs.confirmTime}
              onChange={(confirmTime) => patch({ confirmTime: confirmTime as PoppinsConfirmTime })}
            />
          </View>
          <View style={[styles.segmentPad, { paddingBottom: 12 }]}>
            <SegmentedControl
              label="Undo window"
              subtitle="How long the Undo button stays after saving."
              disabled={disabled}
              options={[
                { value: '5', label: '5 s' },
                { value: '10', label: '10 s' },
                { value: '15', label: '15 s' },
              ]}
              value={String(prefs.undoWindowSec) as '5' | '10' | '15'}
              onChange={(sec) =>
                patch({ undoWindowSec: Number(sec) as PoppinsUndoWindowSec })
              }
            />
          </View>
        </SettingsGroup>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.sm,
    paddingBottom: space.xl,
    paddingHorizontal: space.lg,
  },
  segmentPad: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
