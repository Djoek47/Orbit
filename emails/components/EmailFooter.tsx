import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Divider } from './Divider';
import { EMAIL_COPYRIGHT, EMAIL_LINKS, emailColors, emailFontStack } from '../theme';

const linkStyle: React.CSSProperties = {
  color: emailColors.muted,
  fontFamily: emailFontStack,
  fontSize: '13px',
  textDecoration: 'none',
};

export function EmailFooter() {
  return (
    <Section style={{ marginTop: 8 }}>
      <Divider />
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '13px',
          color: emailColors.muted,
          textAlign: 'center',
          margin: '20px 0 12px',
        }}>
        Need help?{' '}
        <Link href={`mailto:${EMAIL_LINKS.support}`} style={{ ...linkStyle, color: emailColors.coral }}>
          {EMAIL_LINKS.support}
        </Link>
      </Text>
      <Text style={{ textAlign: 'center', margin: '0 0 20px' }}>
        <Link href={EMAIL_LINKS.website} style={linkStyle}>
          Website
        </Link>
        <span style={{ color: emailColors.divider, margin: '0 8px' }}>·</span>
        <Link href={EMAIL_LINKS.manageAccount} style={linkStyle}>
          Manage Account
        </Link>
        <span style={{ color: emailColors.divider, margin: '0 8px' }}>·</span>
        <Link href={EMAIL_LINKS.privacy} style={linkStyle}>
          Privacy Policy
        </Link>
        <span style={{ color: emailColors.divider, margin: '0 8px' }}>·</span>
        <Link href={EMAIL_LINKS.terms} style={linkStyle}>
          Terms
        </Link>
      </Text>
      <Text
        style={{
          fontFamily: emailFontStack,
          fontSize: '12px',
          color: emailColors.muted,
          textAlign: 'center',
          margin: 0,
        }}>
        {EMAIL_COPYRIGHT}
      </Text>
    </Section>
  );
}
