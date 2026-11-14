/**
 * Household deletion emails (reminder / confirmed / cancelled).
 * Mirrors emails/household-deletion-*.tsx
 */
import {
  alertBoxHtml,
  EMAIL_COLORS,
  escapeHtml,
  firstName,
  infoRowsHtml,
  primaryButtonHtml,
  secondaryButtonHtml,
  wrapEmailCard,
} from '../_shared/email-brand.ts';

export type DeletionEmailKind = 'reminder' | 'confirmed' | 'cancelled';
export type DeletionReminderStage = '7d' | '3d' | '24h' | '1h11m';

const STAGE_COPY: Record<
  DeletionReminderStage,
  { headline: string; body: string; urgency: 'info' | 'warning' | 'danger'; subjectLabel: string }
> = {
  '7d': {
    headline: '7 days left to recover your household',
    body: 'Your household is still scheduled for permanent deletion. Cancel anytime in the next week to keep everything.',
    urgency: 'info',
    subjectLabel: '7 days left',
  },
  '3d': {
    headline: '3 days left — recover soon',
    body: 'In three days this household’s tasks, groceries, rewards, and member access will be permanently removed.',
    urgency: 'warning',
    subjectLabel: '3 days left',
  },
  '24h': {
    headline: '24 hours left',
    body: 'Tomorrow this household will be permanently deleted. Open Choremaxx now if you want to cancel.',
    urgency: 'danger',
    subjectLabel: '24 hours left',
  },
  '1h11m': {
    headline: 'About 1 hour left',
    body: 'This is the last reminder. Permanent deletion is imminent — cancel now if this was a mistake.',
    urgency: 'danger',
    subjectLabel: 'About 1 hour left',
  },
};

export type DeletionEmailHtmlInput = {
  kind: DeletionEmailKind;
  name: string;
  householdName: string;
  stage?: DeletionReminderStage;
  purgeDate?: string;
  recoverUrl?: string;
  optOutUrl?: string;
  confirmBy?: string;
  confirmUrl?: string;
  cancelUrl?: string;
  homeUrl?: string;
};

export function renderHouseholdDeletionEmail(input: DeletionEmailHtmlInput): {
  subject: string;
  html: string;
  text: string;
} {
  const name = firstName(input.name);
  const household = input.householdName.trim() || 'your household';
  const home = input.homeUrl?.trim() || 'https://www.choremaxx.app';
  const recover = input.recoverUrl?.trim() || home;
  const optOut = input.optOutUrl?.trim() || home;
  const cancel = input.cancelUrl?.trim() || home;
  const confirm = input.confirmUrl?.trim() || home;

  if (input.kind === 'cancelled') {
    const subject = `Deletion cancelled · ${household}`;
    const text = [
      `Hi ${name}, good news — ${household} stays. The scheduled permanent deletion is off.`,
      '',
      `Open household: ${home}`,
    ].join('\n');
    const html = wrapEmailCard({
      subject,
      badge: 'Recovered',
      badgeColor: EMAIL_COLORS.success,
      heading: 'Deletion cancelled',
      introHtml: `<p style="margin:0 0 24px;font-family:'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif;font-size:16px;line-height:24px;color:#3D3A4E;">Hi ${escapeHtml(name)}, good news — ${escapeHtml(household)} stays. The scheduled permanent deletion is off.</p>`,
      bodyHtml: [
        alertBoxHtml(
          'success',
          'Your tasks, groceries, rewards, and members are unchanged.'
        ),
        `<table role="presentation" width="100%" style="margin:0 0 28px;border-collapse:collapse;">${infoRowsHtml([{ label: 'Household', value: household }])}</table>`,
        primaryButtonHtml(home, 'Open household'),
      ].join(''),
    });
    return { subject, html, text };
  }

  if (input.kind === 'confirmed') {
    const confirmBy = (input.confirmBy ?? '24 hours').trim() || '24 hours';
    const subject = `Confirm permanent deletion · ${household}`;
    const text = [
      `Hi ${name}, you asked to delete ${household} immediately.`,
      `Tap Confirm within ${confirmBy} to finish — or cancel to keep recovering.`,
      '',
      `Confirm: ${confirm}`,
      `Keep household: ${cancel}`,
    ].join('\n');
    const html = wrapEmailCard({
      subject,
      badge: 'Confirm',
      badgeColor: EMAIL_COLORS.danger,
      heading: 'Confirm permanent deletion',
      introHtml: `<p style="margin:0 0 24px;font-family:'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif;font-size:16px;line-height:24px;color:#3D3A4E;">Hi ${escapeHtml(name)}, you asked to delete ${escapeHtml(household)} immediately. Tap Confirm within ${escapeHtml(confirmBy)} to finish — or cancel to keep recovering.</p>`,
      bodyHtml: [
        alertBoxHtml(
          'danger',
          'After confirmation this household cannot be recovered. Tasks, groceries, rewards, and member access are removed for everyone.'
        ),
        `<table role="presentation" width="100%" style="margin:0 0 28px;border-collapse:collapse;">${infoRowsHtml([
          { label: 'Household', value: household },
          { label: 'Confirm by', value: confirmBy },
        ])}</table>`,
        primaryButtonHtml(confirm, 'Confirm permanent delete'),
        secondaryButtonHtml(cancel, 'Keep household'),
      ].join(''),
    });
    return { subject, html, text };
  }

  const stage = input.stage ?? '7d';
  const copy = STAGE_COPY[stage];
  const purgeDate = (input.purgeDate ?? '').trim() || 'soon';
  const subject = `${copy.subjectLabel} · ${household}`;
  const text = [
    `Hi ${name}, ${copy.body}`,
    '',
    `Household: ${household}`,
    `Deletes on: ${purgeDate}`,
    '',
    `Cancel deletion: ${recover}`,
    `Stop reminder emails: ${optOut}`,
  ].join('\n');
  const html = wrapEmailCard({
    subject,
    badge: 'Deletion',
    badgeColor:
      copy.urgency === 'danger'
        ? EMAIL_COLORS.danger
        : copy.urgency === 'warning'
          ? EMAIL_COLORS.warning
          : EMAIL_COLORS.info,
    heading: copy.headline,
    introHtml: `<p style="margin:0 0 24px;font-family:'Bricolage Grotesque', BricolageGrotesque, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif;font-size:16px;line-height:24px;color:#3D3A4E;">Hi ${escapeHtml(name)}, ${escapeHtml(copy.body)}</p>`,
    bodyHtml: [
      alertBoxHtml(copy.urgency, copy.body),
      `<table role="presentation" width="100%" style="margin:0 0 28px;border-collapse:collapse;">${infoRowsHtml([
        { label: 'Household', value: household },
        { label: 'Deletes on', value: purgeDate },
      ])}</table>`,
      primaryButtonHtml(recover, 'Cancel deletion'),
      secondaryButtonHtml(optOut, 'Stop reminder emails'),
    ].join(''),
  });
  return { subject, html, text };
}
