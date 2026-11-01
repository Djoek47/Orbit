/**
 * "How proof works" as a screen — only the Getting Started card opens it this way. The tour plays
 * the same thing in its own overlay (components/orbit/tour/demos/proof-walkthrough-demo).
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { ProofWalkthroughDemo } from '@/components/orbit/tour/demos/proof-walkthrough-demo';

export default function ProofWalkthroughScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === 'homework' || params.kind === 'plan' ? params.kind : 'chore';
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ProofWalkthroughDemo kind={kind} onClose={() => router.back()} />
    </>
  );
}
