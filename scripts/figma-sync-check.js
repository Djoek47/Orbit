#!/usr/bin/env node
/**
 * Validates the Figma Make design registry is present and SYNC_STATE is coherent.
 * Used by CI / pre-flight before figma-sync agents merge.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const syncStatePath = path.join(root, 'design/make/SYNC_STATE.json');
const sourceDir = path.join(root, 'design/make/source');
const automationDoc = path.join(root, 'docs/figma-sync-automation.md');

function fail(message) {
  console.error(`figma-sync-check: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(syncStatePath)) {
  fail('missing design/make/SYNC_STATE.json');
}

if (!fs.existsSync(automationDoc)) {
  fail('missing docs/figma-sync-automation.md');
}

if (!fs.existsSync(sourceDir)) {
  fail('missing design/make/source/');
}

const state = JSON.parse(fs.readFileSync(syncStatePath, 'utf8'));

const EXPECTED_FILE_KEY = 'nwBB1pEqZMWxsm6WE7dFeS';
const PREVIOUS_FILE_KEY = '4J6d4LW335tDyEDpqq3VD1';

if (state.fileKey !== EXPECTED_FILE_KEY) {
  fail(`unexpected fileKey: ${state.fileKey} (expected Design 8 ${EXPECTED_FILE_KEY})`);
}

if (state.previousFileKey && state.previousFileKey !== PREVIOUS_FILE_KEY) {
  fail(`unexpected previousFileKey: ${state.previousFileKey}`);
}

if (!state.rootNodeId) {
  fail('SYNC_STATE.json missing rootNodeId');
}

console.log('figma-sync-check: OK');
console.log(`  fileKey=${state.fileKey}`);
console.log(`  lastSyncedAt=${state.lastSyncedAt ?? 'never'}`);
console.log(`  lastSourceHash=${state.lastSourceHash ?? 'none'}`);
