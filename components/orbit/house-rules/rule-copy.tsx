import { AppText as Text } from '@/components/orbit/app-text';
import type { HouseRulesVoice } from '@/lib/rules/house-rules-palette';

type Props = {
  text: string;
  voice: HouseRulesVoice;
  color: string;
  style?: object;
};

/** Plain sentence. A resolved token is a word — no chip, badge, or accent. */
export function RuleCopy({ text, voice, color, style }: Props) {
  return (
    <Text
      style={[
        {
          color,
          fontSize: voice === 'sidekick' ? 13.5 : 13,
          lineHeight: voice === 'sidekick' ? 20 : 19.5,
        },
        style,
      ]}>
      {text}
    </Text>
  );
}
