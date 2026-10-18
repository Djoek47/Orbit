import { StyleSheet, View } from 'react-native';

type OnboardingProgressProps = {
  /** 0-based active index */
  activeIndex: number;
  total?: number;
  accent: string;
};

/** Apple-style expanding segment bars for onboarding. */
export function OnboardingProgress({
  activeIndex,
  total = 5,
  accent,
}: OnboardingProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.seg,
              {
                width: active ? 20 : 8,
                backgroundColor: active || done ? accent : 'rgba(255,255,255,0.15)',
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  seg: {
    height: 4,
    borderRadius: 99,
  },
});
