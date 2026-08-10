/**
 * Shared Auth Send Email Hook → React Email template map.
 * Used by Node tests and mirrored by `supabase/functions/send-auth-email`.
 */
import * as emailChanged from './email-changed';
import * as magicLink from './magic-link';
import * as passwordReset from './password-reset';
import { render } from './render';
import * as verification from './verification';

export type AuthEmailAction =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | string;

export type AuthEmailRenderInput = {
  action: AuthEmailAction;
  confirmUrl: string;
  /** Display name or email local-part. */
  name: string;
  otp?: string;
  oldEmail?: string;
  newEmail?: string;
};

export async function renderAuthHookEmail(
  input: AuthEmailRenderInput
): Promise<{ subject: string; html: string; text: string }> {
  const name = input.name.trim() || 'there';
  const action = input.action || 'signup';

  let result: { subject: string; html: string; text: string };

  switch (action) {
    case 'recovery':
      result = await render(passwordReset, {
        name,
        resetUrl: input.confirmUrl,
        expiresInMinutes: 60,
      });
      break;
    case 'magiclink':
    case 'email':
      result = await render(magicLink, {
        name,
        signInUrl: input.confirmUrl,
        expiresInMinutes: 15,
      });
      break;
    case 'email_change':
      result = await render(emailChanged, {
        name,
        oldEmail: input.oldEmail?.trim() || 'previous address',
        newEmail: input.newEmail?.trim() || name,
        confirmUrl: input.confirmUrl,
      });
      break;
    case 'signup':
    case 'invite':
    default:
      result = await render(verification, {
        name,
        confirmUrl: input.confirmUrl,
        expiresInHours: 24,
      });
      break;
  }

  const otp = input.otp?.trim();
  if (otp) {
    result = {
      ...result,
      text: `${result.text}\n\nOr enter this code: ${otp}`,
      html: result.html.replace(
        /<\/body>/i,
        `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#8A7A70;text-align:center;margin:24px 16px;">Or enter this code: <strong style="letter-spacing:0.12em;color:#712B13;">${otp}</strong></p></body>`
      ),
    };
  }

  return result;
}
