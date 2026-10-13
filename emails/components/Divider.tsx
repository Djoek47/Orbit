import { Hr } from '@react-email/components';
import * as React from 'react';

import { emailColors } from '../theme';

export function Divider() {
  return <Hr style={{ borderColor: emailColors.divider, margin: '24px 0' }} />;
}
