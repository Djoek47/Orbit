import { Redirect } from 'expo-router';

/** Legacy route — join approval removed; send everyone straight home. */
export default function PendingApprovalScreen() {
  return <Redirect href="/" />;
}
