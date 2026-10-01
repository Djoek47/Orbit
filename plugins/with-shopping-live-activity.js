/**
 * ChoreMaxx's own Lock Screen design for the shopping run.
 *
 * expo-live-activity ships a generic title / subtitle / bar template. Its config plugin copies
 * LiveActivityView.swift + LiveActivityWidget.swift into ios/LiveActivity at prebuild; this
 * plugin runs after every other mod (withFinalizedMod) and puts our files in their place.
 * Same data contract on the JS side. The logo comes from assets/liveActivity/choremaxx_mark.png.
 *
 * Needs a native (EAS) build — an OTA update cannot change it.
 */
const { withFinalizedMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILES = ['LiveActivityView.swift', 'LiveActivityWidget.swift'];

module.exports = function withShoppingLiveActivity(config) {
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'LiveActivity');
      if (!fs.existsSync(dir)) {
        console.warn(
          '[with-shopping-live-activity] ios/LiveActivity not found — is expo-live-activity installed?'
        );
        return cfg;
      }
      for (const name of FILES) {
        const source = path.join(__dirname, 'live-activity', name);
        const target = path.join(dir, name);
        if (!fs.existsSync(source)) {
          console.warn(`[with-shopping-live-activity] missing ${source}`);
          continue;
        }
        fs.copyFileSync(source, target);
      }
      return cfg;
    },
  ]);
};
