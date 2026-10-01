/**
 * A field on a card you can just tap and retype.
 *
 * Renaming used to be possible only on a card's title, and only sometimes — a grocery you'd
 * misheard, a stop whose address was already filled in, a row in a batch: all read-only. Now
 * anything a person might want to correct is one of these: tap it, type, done. Saying it still
 * works; this is for when the room is loud or the name is odd.
 *
 * Editing freezes the hold, so nothing saves halfway through a rename, and unfreezes when the
 * keyboard closes.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { stageFaint } from '@/constants/iui-stage';
import { poppinsUiOrchestrator } from '@/lib/poppins/ui-orchestrator';
import type { IuiPayload } from '@/lib/poppins/ui-scenes';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  /** What's there now. Empty shows `placeholder` in the faint style. */
  value: string;
  /** Shown when there's nothing yet ("Which address?"). */
  placeholder?: string;
  style?: StyleProp<TextStyle>;
  /** Style for the placeholder when the field is empty. */
  emptyStyle?: StyleProp<TextStyle>;
  /** The payload patch this edit produces. */
  toPatch: (next: string) => Partial<IuiPayload>;
  /** Spoken-word description of the edit, for the turn log. */
  describe?: (next: string) => string;
  /** What a screen reader calls this field ("Item name"). */
  label: string;
  numberOfLines?: number;
  keyboardType?: 'default' | 'numeric';
  /** Hide the pencil where the row already reads as tappable. */
  hidePencil?: boolean;
  /** Editing is off while a card is committing. */
  disabled?: boolean;
};

export function IuiInlineField({
  value,
  placeholder,
  style,
  emptyStyle,
  toPatch,
  describe,
  label,
  numberOfLines = 1,
  keyboardType = 'default',
  hidePencil,
  disabled,
}: Props) {
  const { c, isDark } = useOrbitColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const faint = stageFaint(isDark);

  const begin = () => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
    poppinsUiOrchestrator.freeze();
  };

  const finish = (save: boolean) => {
    const next = draft.trim();
    setEditing(false);
    if (save && next && next !== value.trim()) {
      poppinsUiOrchestrator.chooseFromTap(toPatch(next), describe?.(next) ?? `set ${next}`, 'edit');
    }
    poppinsUiOrchestrator.unfreeze();
  };

  if (editing) {
    return (
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => finish(true)}
        onBlur={() => finish(true)}
        returnKeyType="done"
        keyboardType={keyboardType}
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={faint}
        style={[style, styles.input, { color: c.text, borderBottomColor: faint }]}
        accessibilityLabel={label}
      />
    );
  }

  const empty = value.trim().length === 0;
  return (
    <Pressable
      onPress={begin}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${empty ? placeholder ?? 'not set' : value}. Tap to change`}
      hitSlop={6}
      style={styles.row}>
      <Text
        style={[style, empty ? emptyStyle : null, styles.flex]}
        numberOfLines={numberOfLines}>
        {empty ? placeholder ?? '' : value}
      </Text>
      {hidePencil || disabled ? null : (
        <MaterialIcons name="edit" size={13} color={faint} style={styles.pencil} />
      )}
    </Pressable>
  );
}

/** Replace one row in a grouped card (several groceries or tasks on one card). */
export function patchGroupItemLabel(
  items: IuiPayload['items'],
  itemId: string,
  label: string
): Partial<IuiPayload> {
  return {
    items: (items ?? []).map((item) => (item.id === itemId ? { ...item, label } : item)),
  };
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  flex: { flexShrink: 1 },
  pencil: { marginTop: 1, opacity: 0.85 },
  input: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    minWidth: 90,
    paddingVertical: 2,
  },
});
