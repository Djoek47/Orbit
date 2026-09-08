import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { emailColors, emailFontStack } from '../theme';

type AlertVariant = 'info' | 'warning' | 'danger' | 'success';

const VARIANT_LABEL: Record<AlertVariant, string> = {
  info: 'Note',
  warning: 'Warning',
  danger: 'Security alert',
  success: 'Success',
};

const VARIANT_COLOR: Record<AlertVariant, string> = {
  info: emailColors.coral,
  warning: emailColors.warning,
  danger: emailColors.danger,
  success: emailColors.success,
};

type AlertBoxProps = {
  variant?: AlertVariant;
  children: React.ReactNode;
};

/** Text-labeled callout — never an icon glyph, per brand rule (logo is the only mark). */
export function AlertBox({ variant = 'info', children }: AlertBoxProps) {
  const color = VARIANT_COLOR[variant];
  return (
    <Section
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: emailColors.bg,
        borderRadius: 12,
        padding: '16px 18px',
        margin: '20px 0',
      }}>
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '13px',
          fontWeight: 700,
          color,
          margin: '0 0 4px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
        {VARIANT_LABEL[variant]}
      </Text>
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '15px',
          lineHeight: '22px',
          color: emailColors.body,
          margin: 0,
        }}>
        {children}
      </Text>
    </Section>
  );
}
