import { Button } from '@react-email/components';
import * as React from 'react';

import { emailColors, emailFontStack, emailRadius } from '../theme';

type SecondaryButtonProps = {
  href: string;
  children: React.ReactNode;
};

export function SecondaryButton({ href, children }: SecondaryButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: 'transparent',
        color: emailColors.coral,
        border: `1px solid ${emailColors.coral}`,
        fontFamily: emailFontStack,
        fontSize: '17px',
        fontWeight: 600,
        textDecoration: 'none',
        textAlign: 'center',
        display: 'block',
        width: '100%',
        lineHeight: '50px',
        height: '50px',
        borderRadius: `${emailRadius.button}px`,
      }}>
      {children}
    </Button>
  );
}
