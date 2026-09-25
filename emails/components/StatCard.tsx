import { Column, Row, Section, Text } from '@react-email/components';
import * as React from 'react';

import { emailColors, emailFontStack } from '../theme';

export type Stat = { label: string; value: string };

type StatCardProps = {
  stats: Stat[];
};

/** 2-up stat grid — weekly summary tallies (tasks completed, XP earned, etc.). */
export function StatCard({ stats }: StatCardProps) {
  const pairs: Stat[][] = [];
  for (let i = 0; i < stats.length; i += 2) {
    pairs.push(stats.slice(i, i + 2));
  }
  return (
    <Section style={{ margin: '20px 0' }}>
      {pairs.map((pair, i) => (
        <Row key={i} style={{ marginBottom: '12px' }}>
          {pair.map((stat) => (
            <Column
              key={stat.label}
              style={{
                backgroundColor: emailColors.bg,
                borderRadius: 16,
                padding: '18px 16px',
                width: '48%',
              }}>
              <Text
                style={{
                  fontFamily: emailFontStack,
                  fontSize: '24px',
                  fontWeight: 700,
                  color: emailColors.coral,
                  margin: '0 0 4px',
                }}>
                {stat.value}
              </Text>
              <Text
                style={{
                  fontFamily: emailFontStack,
                  fontSize: '13px',
                  color: emailColors.muted,
                  margin: 0,
                }}>
                {stat.label}
              </Text>
            </Column>
          ))}
          {pair.length === 1 ? <Column style={{ width: '48%' }} /> : null}
        </Row>
      ))}
    </Section>
  );
}
