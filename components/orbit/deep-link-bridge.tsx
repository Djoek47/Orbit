import { useDeepLinkInvite } from '@/lib/hooks/use-deep-link-invite';

export function DeepLinkBridge() {
  useDeepLinkInvite();
  return null;
}
