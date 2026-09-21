export function formatStageTapUserLine(tap: { kind: string; text: string }): string {
  const choice = tap.text.trim() || 'that';
  if (tap.kind === 'confirm') return 'On the IUI I chose assign now.';
  return `On the IUI I chose ${choice}.`;
}
