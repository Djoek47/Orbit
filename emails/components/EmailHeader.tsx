import { Img, Section, Text } from '@react-email/components';
import * as React from 'react';

import { EMAIL_LOGO_URL, EMAIL_TAGLINE, emailColors, emailFontStack } from '../theme';

/**
 * Centered logo + tagline. Uses the existing ChoreMaxx icon asset (never
 * recreated) plus a colored HTML wordmark — this stays crisp with images
 * blocked and matches the two-tone "chore"/"maxx" lockup without needing a
 * new flattened composite asset.
 */
export function EmailHeader() {
  return (
    <Section style={{ textAlign: 'center', marginBottom: 8 }}>
      <Img
        src={EMAIL_LOGO_URL}
        width="56"
        height="56"
        alt="ChoreMaxx"
        style={{ margin: '0 auto', display: 'block', borderRadius: 14 }}
      />
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '20px',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          margin: '12px 0 2px',
        }}>
        <span style={{ color: emailColors.darkText }}>chore</span>
        <span style={{ color: emailColors.coral }}>maxx</span>
      </Text>
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '13px',
          color: emailColors.muted,
          margin: 0,
          letterSpacing: '0.01em',
        }}>
        {EMAIL_TAGLINE}
      </Text>
    </Section>
  );
}
