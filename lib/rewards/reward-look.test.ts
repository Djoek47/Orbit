import assert from 'node:assert/strict';

import { DEFAULT_REWARD_LOOK, rewardLook } from '@/lib/rewards/reward-look';

// A preset is matched by id, whatever it was renamed to.
assert.equal(rewardLook({ presetId: 'preset-dessert', title: 'Pudding night' }).moji, 'icecream');
assert.equal(rewardLook({ presetId: 'preset-screen-time' }).moji, 'tv');

// A family's own reward is matched on its words.
assert.equal(rewardLook({ title: 'Extra Roblox time' }).moji, 'gamepad');
assert.equal(rewardLook({ title: 'Pick the movie on Friday' }).moji, 'clapper');
assert.equal(rewardLook({ title: 'Trip to the trampoline park' }).moji, 'rocket');
assert.equal(rewardLook({ title: 'Stay up late' }).moji, 'moon');

// Nothing recognisable still gets a look, never a blank.
assert.deepEqual(rewardLook({ title: 'Zorblat' }), DEFAULT_REWARD_LOOK);
assert.deepEqual(rewardLook({}), DEFAULT_REWARD_LOOK);

// Every look has a colour.
for (const title of ['Dessert', 'New game', 'Anything']) {
  assert.match(rewardLook({ title }).color, /^#[0-9A-F]{6}$/i);
}

console.log('reward-look: ok');
