import { Section, Text } from '@react-email/components';
import * as React from 'react';

import { emailColors, emailFontStack } from '../theme';

type InfoRow = { label: string; value: string };

type InfoCardProps = {
  rows: InfoRow[];
};

/** Muted key/value block — invite details, task metadata, device info, etc. */
export function InfoCard({ rows }: InfoCardProps) {
  return (
    <Section
      style={{
        backgroundColor: emailColors.bg,
        borderRadius: 16,
        padding: '20px 20px 4px',
        margin: '20px 0',
      }}>
      {rows.map((row) => (
        <Section
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
          <Text
            style={{
              fontFamily: emailFontStack,
              fontSize: '13px',
              color: emailColors.muted,
              margin: 0,
              display: 'inline-block',
              width: '48%',
            }}>
            {row.label}
          </Text>
          <Text
            style={{
              fontFamily: emailFontStack,
              fontSize: '15px',
              fontWeight: 600,
              color: emailColors.darkText,
              margin: 0,
              display: 'inline-block',
              width: '48%',
              textAlign: 'right',
            }}>
            {row.value}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
