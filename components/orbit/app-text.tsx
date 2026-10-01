import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { KEYBOARD_DONE_ID } from '@/components/orbit/keyboard-done-accessory';
import { applyBricolageFont, FontFamily } from '@/constants/typography';

function remapStyles(style: StyleProp<TextStyle>): TextStyle[] {
  const flat = StyleSheet.flatten(style) ?? {};
  return [applyBricolageFont(flat)];
}

/**
 * Default text surface for ChoreMaxx — always Bricolage Grotesque.
 * Remaps `fontWeight` → the correct static family (Android-safe).
 */
export function AppText({ style, ...props }: TextProps) {
  return (
    <Text
      {...props}
      style={style == null ? { fontFamily: FontFamily.regular } : remapStyles(style)}
    />
  );
}

/**
 * TextInput that paints value + placeholder in Bricolage (native inputs otherwise silently fall
 * back to the system font), and that always gives people a way to put the keyboard away.
 *
 * A field with one line gets the blue ✓ return key, so finishing is one tap. A field with
 * several gets the shared Done bar above the keyboard, because its return key has to make new
 * lines. Either can still be overridden per field.
 */
export function AppTextInput({ style, ...props }: TextInputProps) {
  const multiline = props.multiline === true;
  const returnKeyType = props.returnKeyType ?? (multiline ? undefined : 'done');
  const inputAccessoryViewID =
    props.inputAccessoryViewID ??
    (multiline && Platform.OS === 'ios' ? KEYBOARD_DONE_ID : undefined);

  return (
    <TextInput
      {...props}
      returnKeyType={returnKeyType}
      inputAccessoryViewID={inputAccessoryViewID}
      style={style == null ? { fontFamily: FontFamily.regular } : remapStyles(style)}
    />
  );
}
