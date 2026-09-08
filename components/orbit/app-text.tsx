import {
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

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
 * TextInput that paints value + placeholder in Bricolage (native inputs
 * otherwise silently fall back to the system font).
 */
export function AppTextInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      {...props}
      style={style == null ? { fontFamily: FontFamily.regular } : remapStyles(style)}
    />
  );
}
