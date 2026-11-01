import { Column, Row, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Divider } from './Divider';
import { emailColors, emailFontStack } from '../theme';

export type InvoiceLine = { label: string; amount: string };

type InvoiceTableProps = {
  lines: InvoiceLine[];
  total: InvoiceLine;
};

const cellStyle: React.CSSProperties = {
  fontFamily: emailFontStack,
  fontSize: '15px',
  color: emailColors.body,
  margin: '0 0 10px',
};

/** Line-item table for receipts — subtotal / taxes / total. */
export function InvoiceTable({ lines, total }: InvoiceTableProps) {
  return (
    <Section style={{ margin: '20px 0' }}>
      {lines.map((line) => (
        <Row key={line.label}>
          <Column>
            <Text style={cellStyle}>{line.label}</Text>
          </Column>
          <Column>
            <Text style={{ ...cellStyle, textAlign: 'right' }}>{line.amount}</Text>
          </Column>
        </Row>
      ))}
      <Divider />
      <Row>
        <Column>
          <Text style={{ ...cellStyle, fontWeight: 700, fontSize: '17px', color: emailColors.darkText }}>
            {total.label}
          </Text>
        </Column>
        <Column>
          <Text
            style={{
              ...cellStyle,
              fontWeight: 700,
              fontSize: '17px',
              color: emailColors.darkText,
              textAlign: 'right',
            }}>
            {total.amount}
          </Text>
        </Column>
      </Row>
    </Section>
  );
}
