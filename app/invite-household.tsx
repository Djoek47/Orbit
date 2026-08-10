/**
 * Revision F §6 / Item 5 — household invite entry now routes to per-member invites.
 * Household-level QR/token removed (Rev F §3.1.a).
 */
import { Redirect } from 'expo-router';

export default function InviteHouseholdScreen() {
  return <Redirect href="/household-members" />;
}
