/**
 * Payment Receipt — template only. No billing/Stripe integration exists;
 * wire this on `invoice.paid` (or equivalent) once one does.
 */
import { Heading, Text } from '@react-email/components';
import * as React from 'react';

import { InvoiceTable } from './components/InvoiceTable';
import { SecondaryButton } from './components/SecondaryButton';
import { EmailLayout } from './layouts/EmailLayout';
import { emailColors, emailFontStack, emailType } from './theme';
import type { EmailModule } from './types';
import { firstName } from './utils/format';

export type PaymentReceiptEmailProps = {
  name: string;
  invoiceNumber: string;
  date: string;
  subtotal: string;
  taxes: string;
  total: string;
  paymentMethod: string;
  downloadUrl: string;
};

export default function PaymentReceiptEmail({
  name,
  invoiceNumber,
  date,
  subtotal,
  taxes,
  total,
  paymentMethod,
  downloadUrl,
}: PaymentReceiptEmailProps) {
  return (
    <EmailLayout previewText={`Receipt for invoice ${invoiceNumber}.`}>
      <Heading style={{ fontFamily: emailFontStack, ...emailType.heading, color: emailColors.darkText, margin: '8px 0 4px' }}>
        Payment receipt
      </Heading>
      <Text style={{ fontFamily: emailFontStack, ...emailType.caption, color: emailColors.muted, margin: '0 0 20px' }}>
        Invoice {invoiceNumber} · {date}
      </Text>
      <Text style={{ fontFamily: emailFontStack, ...emailType.body, color: emailColors.body, margin: '0 0 8px' }}>
        Hi {firstName(name)}, here&apos;s your receipt.
      </Text>
      <InvoiceTable
        lines={[
          { label: 'Subtotal', amount: subtotal },
          { label: 'Taxes', amount: taxes },
        ]}
        total={{ label: 'Total', amount: total }}
      />
      <Text
        style={{ fontFamily: emailFontStack, ...emailType.caption, color: emailColors.muted, margin: '0 0 24px' }}>
        Paid with {paymentMethod}
      </Text>
      <SecondaryButton href={downloadUrl}>Download Invoice</SecondaryButton>
    </EmailLayout>
  );
}

PaymentReceiptEmail.PreviewProps = {
  name: 'Sarah',
  invoiceNumber: 'INV-2026-0804',
  date: 'August 4, 2026',
  subtotal: '$6.99',
  taxes: '$0.58',
  total: '$7.57',
  paymentMethod: 'Visa •••• 4242',
  downloadUrl: 'https://choremaxx.app/account/billing/invoice/preview',
} satisfies PaymentReceiptEmailProps;

export const subjectFor = ({ invoiceNumber }: PaymentReceiptEmailProps) => `Receipt for invoice ${invoiceNumber}`;

export const textFor = ({
  name,
  invoiceNumber,
  date,
  subtotal,
  taxes,
  total,
  paymentMethod,
  downloadUrl,
}: PaymentReceiptEmailProps) =>
  [
    `Hi ${firstName(name)}, here's your receipt.`,
    '',
    `Invoice: ${invoiceNumber}`,
    `Date: ${date}`,
    `Subtotal: ${subtotal}`,
    `Taxes: ${taxes}`,
    `Total: ${total}`,
    `Payment method: ${paymentMethod}`,
    '',
    `Download Invoice: ${downloadUrl}`,
  ].join('\n');

export const _module: EmailModule<PaymentReceiptEmailProps> = {
  default: PaymentReceiptEmail,
  subjectFor,
  textFor,
};
