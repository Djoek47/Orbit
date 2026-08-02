/** Thrown when Supabase Auth blocks sign-in until the inbox link is used. */
export class EmailNotConfirmedError extends Error {
  readonly email: string;

  constructor(email: string) {
    super('Email not confirmed');
    this.name = 'EmailNotConfirmedError';
    this.email = email.trim();
  }
}

export function isEmailNotConfirmedError(err: unknown): err is EmailNotConfirmedError {
  return err instanceof EmailNotConfirmedError;
}
