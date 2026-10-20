/**
 * The panel a tour demonstration plays in.
 *
 * It covers the whole app from inside the tour's own layer — no route, no sheet, nothing pushed on
 * the navigator — so there is only ever one copy of the app on screen. It slides up, plays, and
 * slides away; the tour picks up on the step after the one that opened it.
 */
import { useEffect } from 'react';
import { BackHandler, Platform, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';

import { HowItWorksPlayer } from '@/components/orbit/poppins/how-it-works-player';
import { MockFlowDemo } from '@/components/orbit/tour/demos/mock-flow-demo';
import { ProofWalkthroughDemo } from '@/components/orbit/tour/demos/proof-walkthrough-demo';
import type { TourDemoId } from '@/lib/tour/tour-demos';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

function DemoBody({ demo, onClose }: { demo: TourDemoId; onClose: () => void }) {
  switch (demo) {
    case 'proof_chore':
      return <ProofWalkthroughDemo kind="chore" onClose={onClose} />;
    case 'proof_homework':
      return <ProofWalkthroughDemo kind="homework" onClose={onClose} />;
    case 'mock_assign':
      return <MockFlowDemo flow="assign" onClose={onClose} />;
    case 'mock_homework':
      return <MockFlowDemo flow="homework" onClose={onClose} />;
    case 'mock_sidekick':
      return <MockFlowDemo flow="sidekick" onClose={onClose} />;
    case 'poppins':
      return <HowItWorksPlayer onClose={onClose} closeIcon="close" />;
  }
}

export function TourDemoPanel({
  demo,
  reduceMotion,
  onClose,
}: {
  demo: TourDemoId;
  reduceMotion: boolean;
  onClose: () => void;
}) {
  const { c } = useOrbitColors();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const panel = (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        entering={reduceMotion ? undefined : SlideInDown.duration(320)}
        exiting={reduceMotion ? undefined : SlideOutDown.duration(220)}
        accessibilityViewIsModal
        style={[StyleSheet.absoluteFill, styles.panel, { backgroundColor: c.background }]}>
        <DemoBody demo={demo} onClose={onClose} />
      </Animated.View>
    </View>
  );

  // Above everything, including anything the navigator presents.
  if (Platform.OS === 'ios') return <FullWindowOverlay>{panel}</FullWindowOverlay>;
  return panel;
}

const styles = StyleSheet.create({
  panel: { elevation: 120, zIndex: 120 },
});
