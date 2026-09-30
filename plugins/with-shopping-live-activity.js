/**
 * ChoreMaxx's own Lock Screen design for the shopping run.
 *
 * expo-live-activity ships a generic title / subtitle / bar template. Its config plugin copies
 * LiveActivityView.swift into ios/LiveActivity at prebuild; this plugin runs after every other
 * mod (withFinalizedMod) and puts our view in its place. Same data contract, so the JS side and
 * the Dynamic Island are untouched. The logo comes from assets/liveActivity/choremaxx_mark.png,
 * which expo-live-activity adds to the widget's asset catalog.
 *
 * Needs a native (EAS) build — an OTA update cannot change it.
 */
const { withFinalizedMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'live-activity', 'LiveActivityView.swift');

module.exports = function withShoppingLiveActivity(config) {
  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const target = path.join(cfg.modRequest.platformProjectRoot, 'LiveActivity', 'LiveActivityView.swift');
      if (fs.existsSync(path.dirname(target))) {
        fs.copyFileSync(SOURCE, target);
      } else {
        console.warn('[with-shopping-live-activity] ios/LiveActivity not found — is expo-live-activity installed?');
      }
      return cfg;
    },
  ]);
};
