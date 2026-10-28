import assert from 'node:assert/strict';
import { realMembersOnly } from './profiles-for-switch';
import type { HouseholdMember } from '@/types/orbit';

const m = (id: string, name: string) => ({ id, name, role: 'child', status: 'active' }) as HouseholdMember;
const people = [m('m3', 'Emma'), m('m8', 'Jack'), m('3f1c2a9e-1b2c-4d5e-8f90-123456789abc', 'Emilie')];
assert.deepEqual(realMembersOnly(people, 'supabase').map((p) => p.name), ['Emilie'], 'demo people never on a real account');
assert.equal(realMembersOnly(people, 'mock').length, 3, 'demo mode keeps its demo people');
console.log('real-members-only: ok');
