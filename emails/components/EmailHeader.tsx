import { Img, Section, Text } from '@react-email/components';
import * as React from 'react';

import {
  EMAIL_LOGO_URL,
  EMAIL_TAGLINE,
  emailColors,
  emailFontStack,
  emailRadius,
  emailType,
} from '../theme';

/**
 * Official house mark + chore/maxx wordmark — mirrors AuthShell brandHero
 * on confirm-email (logo + Bricolage chrome).
 */
export function EmailHeader() {
  return (
    <Section style={{ textAlign: 'center', marginBottom: 12 }}>
      <Img
        src={EMAIL_LOGO_URL}
        width="64"
        height="64"
        alt="Choremaxx"
        style={{
          margin: '0 auto',
          display: 'block',
          borderRadius: emailRadius.logo,
        }}
      />
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: emailType.wordmark.fontSize,
          lineHeight: emailType.wordmark.lineHeight,
          fontWeight: emailType.wordmark.fontWeight,
          letterSpacing: '-0.03em',
          margin: '14px 0 4px',
        }}>
        <span style={{ color: emailColors.chore }}>chore</span>
        <span style={{ color: emailColors.coral }}>maxx</span>
      </Text>
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '13px',
          fontWeight: 500,
          color: emailColors.muted,
          margin: 0,
          letterSpacing: '0.02em',
        }}>
        {EMAIL_TAGLINE}
      </Text>
    </Section>
  );
}
