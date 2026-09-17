/**
 * Apple Review demo credentials matcher.
 * Run: npx --yes tsx lib/auth/review-demo.test.ts
 */
import assert from 'node:assert/strict';
import {
  REVIEW_DEMO_EMAIL,
  REVIEW_DEMO_PASSWORD,
  matchesReviewDemoCredentials,
} from '@/lib/auth/review-demo';

assert.equal(matchesReviewDemoCredentials(REVIEW_DEMO_EMAIL, REVIEW_DEMO_PASSWORD), true);
assert.equal(matchesReviewDemoCredentials('  Review@Choremaxx.app  ', REVIEW_DEMO_PASSWORD), true);
assert.equal(matchesReviewDemoCredentials(REVIEW_DEMO_EMAIL, 'wrong'), false);
assert.equal(matchesReviewDemoCredentials('sarah@orbit.test', 'orbit-demo'), false);

console.log('review-demo tests passed');
