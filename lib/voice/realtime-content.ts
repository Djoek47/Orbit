/**
 * OpenAI Realtime GA content types are role-specific.
 * User/system: input_text. Assistant: output_text.
 * Seeding assistant turns as input_text is TF 55:
 * Invalid value: 'input_text'. Value must be 'output_text'.
 */

export type RealtimeMessageRole = 'user' | 'assistant' | 'system';

export type RealtimeTextPart = {
  type: 'input_text' | 'output_text';
  text: string;
};

export function realtimeTextContent(role: RealtimeMessageRole, text: string): RealtimeTextPart[] {
  return [
    {
      type: role === 'assistant' ? 'output_text' : 'input_text',
      text,
    },
  ];
}
