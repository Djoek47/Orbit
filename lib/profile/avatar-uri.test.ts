/**
 * Avatar URI helpers — local photos must upload; emoji/initials must not.
 * Run: npx tsx lib/profile/avatar-uri.test.ts
 */
import assert from 'node:assert/strict';

import {
  isAvatarPhotoUri,
  isLocalAvatarUri,
  isShareableAvatarUri,
  needsAvatarUpload,
} from '@/lib/profile/avatar-uri';

assert.equal(isLocalAvatarUri('file:///var/mobile/Containers/Data/avatars/a.png'), true);
assert.equal(isLocalAvatarUri('content://media/1'), true);
assert.equal(
  isLocalAvatarUri('https://x.supabase.co/storage/v1/object/public/member-avatars/h/m/1.png'),
  false
);

assert.equal(isShareableAvatarUri('https://cdn.example/a.png'), true);
assert.equal(isShareableAvatarUri('file:///x.png'), false);

assert.equal(isAvatarPhotoUri('file:///avatars/me.jpg'), true);
assert.equal(isAvatarPhotoUri('https://cdn.example/a.png'), true);
assert.equal(isAvatarPhotoUri('data:image/png;base64,abc'), true);
assert.equal(isAvatarPhotoUri('🦊'), false);
assert.equal(isAvatarPhotoUri('S'), false);
assert.equal(isAvatarPhotoUri(''), false);

assert.equal(needsAvatarUpload('file:///avatars/me.jpg'), true);
assert.equal(needsAvatarUpload('content://media/1'), true);
assert.equal(needsAvatarUpload('data:image/png;base64,abc'), true);
assert.equal(needsAvatarUpload('https://cdn.example/a.png'), false);
assert.equal(needsAvatarUpload('🦊'), false);
assert.equal(needsAvatarUpload('JL'), false);
assert.equal(needsAvatarUpload(''), false);

console.log('avatar-uri: ok');
