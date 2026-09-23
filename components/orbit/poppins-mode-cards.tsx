import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { AppText as Text } from '@/components/orbit/app-text';
import { radius, space, typography } from '@/constants/orbit-theme';
import { TOKEN_WEIGHT_QUIET, TOKEN_WEIGHT_SPEAK_BACK } from '@/constants/poppins-ai-rates';
import {
  poppinsTier,
  type PoppinsInteractionPrefs,
  type PoppinsTier,
} from '@/lib/poppins/poppins-prefs';
import { useMajordomoName } from '@/lib/ai/use-majordomo-name';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type PoppinsModeCardsProps = {
  prefs: PoppinsInteractionPrefs;
  accent: string;
  disabled?: boolean;
  layout?: 'stack' | 'pills';
  /** Character name. Defaults to the household majordomo. */
  name?: string;
  onSelectTier: (tier: 'base' | 'max') => void;
};

const MODES: {
  tier: 'base' | 'max';
  title: string;
  line: string;
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}[] = [
  {
    tier: 'base',
    title: 'Base',
    line: 'Lighter. About 1 action each.',
    detail: 'Quiet replies on screen. Best for everyday use.',
    icon: 'water-drop',
  },
  {
    tier: 'max',
    title: 'Max',
    line: `Speaks back. About ${TOKEN_WEIGHT_SPEAK_BACK} actions each.`,
    detail: 'Live voice. Richer, and it spends the month faster.',
    icon: 'graphic-eq',
  },
];

export function PoppinsModeCards({
  prefs,
  accent,
  disabled,
  layout = 'stack',
  name,
  onSelectTier,
}: PoppinsModeCardsProps) {
  const storedName = useMajordomoName();
  const speaker = name?.trim() || storedName;
  const tier = poppinsTier(prefs);
  const modes = MODES.map((mode) => ({
    ...mode,
    title: `${speaker} ${mode.title}`,
  }));
  if (layout === 'pills') {
    return (
      <ModePills
        tier={tier}
        accent={accent}
        disabled={disabled}
        onSelectTier={onSelectTier}
        modes={modes}
      />
    );
  }
  return (
    <View style={styles.stack}>
      {modes.map((mode) => (
        <ModeCard
          key={mode.tier}
          mode={mode}
          selected={tier === mode.tier}
          accent={accent}
          disabled={disabled}
          onPress={() => onSelectTier(mode.tier)}
        />
      ))}
      <CustomNote tier={tier} />
    </View>
  );
}

function ModePills({
  tier,
  accent,
  disabled,
  modes,
  onSelectTier,
}: {
  tier: PoppinsTier;
  accent: string;
  disabled?: boolean;
  modes: typeof MODES;
  onSelectTier: (tier: 'base' | 'max') => void;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  return (
    <View style={styles.pillBlock}>
      <View style={[styles.pillRow, { backgroundColor: glass(0.06), borderColor: glassBorder(0.1) }]}>
        {modes.map((mode) => {
          const selected = tier === mode.tier;
          return (
            <Pressable
              key={mode.tier}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={mode.title}
              onPress={() => {
                if (disabled) return;
                void Haptics.selectionAsync();
                onSelectTier(mode.tier);
              }}
              style={[
                styles.pill,
                selected
                  ? { backgroundColor: `${accent}28`, borderColor: `${accent}88` }
                  : { backgroundColor: 'transparent', borderColor: 'transparent' },
              ]}>
              <Text
                style={[
                  typography.footnote,
                  { color: selected ? accent : c.textMuted, fontWeight: '700' },
                ]}>
                {mode.tier === 'base' ? 'Base' : 'Max'}
              </Text>
              <Text style={[typography.caption2, { color: selected ? c.textSoft : c.textSubtle }]}>
                {mode.tier === 'base' ? `${TOKEN_WEIGHT_QUIET}` : `~${TOKEN_WEIGHT_SPEAK_BACK}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <CustomNote tier={tier} />
    </View>
  );
}

function ModeCard({
  mode,
  selected,
  accent,
  disabled,
  onPress,
}: {
  mode: (typeof MODES)[number];
  selected: boolean;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${mode.title}. ${mode.line}`}
      onPress={() => {
        if (disabled) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[
        styles.card,
        {
          backgroundColor: selected ? (isDark ? `${accent}18` : `${accent}12`) : glass(0.05),
          borderColor: selected ? `${accent}88` : glassBorder(0.1),
          opacity: disabled ? 0.55 : 1,
        },
      ]}>
      {selected ? (
        <LinearGradient
          colors={[`${accent}40`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.iconWell, { backgroundColor: selected ? `${accent}2A` : glass(0.08) }]}>
        <MaterialIcons name={mode.icon} size={22} color={selected ? accent : c.textMuted} />
      </View>
      <View style={styles.copy}>
        <Text style={[typography.headline, { color: c.text }]}>{mode.title}</Text>
        <Text style={[typography.footnote, { color: c.textSoft, marginTop: 2 }]}>{mode.line}</Text>
        <Text style={[typography.caption1, { color: c.textSubtle, marginTop: 4 }]}>{mode.detail}</Text>
      </View>
      <View
        style={[
          styles.radio,
          {
            borderColor: selected ? accent : glassBorder(0.22),
            backgroundColor: selected ? accent : 'transparent',
          },
        ]}>
        {selected ? <MaterialIcons name="check" size={14} color={isDark ? '#041018' : '#FFFFFF'} /> : null}
      </View>
    </Pressable>
  );
}

function CustomNote({ tier }: { tier: PoppinsTier }) {
  const { c } = useOrbitColors();
  if (tier !== 'custom') return null;
  return (
    <Text style={[typography.caption1, styles.custom, { color: c.textMuted }]}>
      Custom — Advanced is tuned. Tap Base or Max to reset.
    </Text>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  card: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  iconWell: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  radio: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  custom: {
    marginTop: 2,
    paddingHorizontal: 4,
  },
  pillBlock: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  pillRow: {
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  pill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
});
