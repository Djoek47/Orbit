import { Button } from '@react-email/components';
import * as React from 'react';

import { emailColors, emailFontStack, emailRadius } from '../theme';

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
};

export function PrimaryButton({ href, children }: PrimaryButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: emailColors.coral,
        color: '#FFFFFF',
        fontFamily: emailFontStack,
        fontSize: '17px',
        fontWeight: 650,
        textDecoration: 'none',
        textAlign: 'center',
        display: 'block',
        width: '100%',
        lineHeight: '52px',
        height: '52px',
        borderRadius: `${emailRadius.button}px`,
      }}>
      {children}
    </Button>
  );
}
