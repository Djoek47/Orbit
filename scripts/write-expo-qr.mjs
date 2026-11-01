#!/usr/bin/env node
/**
 * Write a scannable Expo Go QR PNG for a tunnel/LAN URL.
 * Usage: node scripts/write-expo-qr.mjs [exp://url] [out.png]
 */
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] || process.env.EXPO_QR_URL;
const out = process.argv[3] || '/opt/cursor/artifacts/expo-go-qr.png';
if (!url || !url.startsWith('exp://')) {
  console.error('Usage: node scripts/write-expo-qr.mjs exp://HOST [/path/out.png]');
  process.exit(1);
}
await QRCode.toFile(out, url, { type: 'png', width: 512, margin: 2, errorCorrectionLevel: 'M' });
writeFileSync(out.replace(/\.png$/, '.txt'), url + '\n');
console.log(`QR written: ${out}\nURL: ${url}`);
