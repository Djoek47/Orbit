/**
 * A card title you can rename on the spot: tap it, type, done. (Or say "call it …".)
 * Editing pauses the hold so nothing saves mid-rename.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextStyle } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { stageFaint } from '@/constants/iui-stage';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  title: string;
  style: StyleProp<TextStyle>;
  /** Which payload fields the new name goes into. */
  toPatch?: (name: string) => Partial<IuiPayload>;
  numberOfLines?: number;
};

export function IuiEditableTitle({ title, style, toPatch, numberOfLines = 2 }: Props) {
  const { c, isDark } = useOrbitColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const begin = () => {
    setDraft(title);
    setEditing(true);
    poppinsUiOrchestrator.freeze();
  };
  const finish = (save: boolean) => {
    const name = draft.trim();
    setEditing(false);
    if (save && name && name !== title) {
      const patch = toPatch?.(name) ?? { title: name, libraryTaskId: undefined, namedByPerson: true };
      poppinsUiOrchestrator.chooseFromTap(
        { ...patch, slotSource: { title: 'touch' } },
        `rename ${name}`,
        'rename'
      );
    }
    poppinsUiOrchestrator.unfreeze();
  };

  if (editing) {
    return (
      <View style={styles.row}>
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => finish(true)}
          onBlur={() => finish(true)}
          returnKeyType="done"
          selectTextOnFocus
          style={[style, styles.input, { color: c.text, borderBottomColor: stageFaint(isDark) }]}
          accessibilityLabel="Name"
        />
      </View>
    );
  }
  return (
    <Pressable
      onPress={begin}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Tap to rename`}
      hitSlop={6}
      style={styles.row}>
      <Text style={[style, styles.flex]} numberOfLines={numberOfLines}>
        {title}
      </Text>
      <MaterialIcons name="edit" size={14} color={stageFaint(isDark)} style={styles.pencil} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flexShrink: 1 },
  pencil: { marginTop: 2 },
  input: { flex: 1, paddingVertical: 2, borderBottomWidth: StyleSheet.hairlineWidth },
});
