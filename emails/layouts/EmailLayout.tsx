import { Body, Container, Head, Html, Preview } from '@react-email/components';
import * as React from 'react';

import { EmailFooter } from '../components/EmailFooter';
import { EmailHeader } from '../components/EmailHeader';
import {
  EMAIL_FONT_IMPORT,
  emailColors,
  emailFontStack,
  emailRadius,
  emailSpace,
} from '../theme';

type EmailLayoutProps = {
  previewText: string;
  children: React.ReactNode;
};

/**
 * Shared shell for every ChoreMaxx transactional email: 600px card, centered
 * logo, brand footer. Best-effort dark mode via `prefers-color-scheme` —
 * most clients (Gmail, Outlook) ignore it and render the light card, which
 * is an acceptable fallback since contrast stays fine either way.
 */
export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={EMAIL_FONT_IMPORT} rel="stylesheet" />
        <style>{`
          @media (prefers-color-scheme: dark) {
            .cm-bg { background-color: #1C1512 !important; }
            .cm-card { background-color: #2A211C !important; }
            .cm-divider { border-color: #3A2E28 !important; }
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        className="cm-bg"
        style={{
          backgroundColor: emailColors.bg,
          fontFamily: emailFontStack,
          margin: 0,
          padding: `${emailSpace.outer}px 16px`,
        }}>
        <Container
          className="cm-card"
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            backgroundColor: emailColors.card,
            borderRadius: `${emailRadius.card}px`,
            padding: `${emailSpace.inner}px`,
            boxShadow: '0 1px 3px rgba(58, 46, 40, 0.06)',
          }}>
          <EmailHeader />
          {children}
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}
