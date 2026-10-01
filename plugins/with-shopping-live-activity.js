/**
 * ChoreMaxx's own Lock Screen design for the shopping run.
 *
 * expo-live-activity ships a generic title / subtitle / bar template. Its config plugin copies
 * LiveActivityView.swift + LiveActivityWidget.swift into ios/LiveActivity at prebuild; this
 * plugin runs after every other mod (withFinalizedMod) and puts our files in their place.
 * Same data contract on the JS side. The logo comes from assets/liveActivity/choremaxx_mark.png.
 *
 * Also enables the App Group shared with the shopping-banner-bridge Expo module so Lock Screen
 * check-offs can sync into the grocery list when the app wakes.
 *
 * Needs a native (EAS) build — an OTA update cannot change it.
 */
const {
  withEntitlementsPlist,
  withFinalizedMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP = 'group.app.choremaxx.household';
const FILES = ['LiveActivityView.swift', 'LiveActivityWidget.swift', 'ShoppingBannerStore.swift'];

function ensureAppGroup(entitlements) {
  const next = { ...entitlements };
  const groups = Array.isArray(next['com.apple.security.application-groups'])
    ? [...next['com.apple.security.application-groups']]
    : [];
  if (!groups.includes(APP_GROUP)) groups.push(APP_GROUP);
  next['com.apple.security.application-groups'] = groups;
  return next;
}

function withMainAppGroup(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults = ensureAppGroup(cfg.modResults);
    return cfg;
  });
}

function withShoppingLiveActivityFiles(config) {
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

      // Widget extension needs the same App Group as the main app + bridge module.
      const entitlementsPath = path.join(dir, 'LiveActivity.entitlements');
      try {
        let xml = fs.existsSync(entitlementsPath)
          ? fs.readFileSync(entitlementsPath, 'utf8')
          : `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
</dict>
</plist>
`;
        if (!xml.includes(APP_GROUP)) {
          if (xml.includes('com.apple.security.application-groups')) {
            xml = xml.replace(
              /(<key>com\.apple\.security\.application-groups<\/key>\s*<array>)/,
              `$1\n\t\t<string>${APP_GROUP}</string>`
            );
          } else {
            xml = xml.replace(
              '</dict>',
              `\t<key>com.apple.security.application-groups</key>\n\t<array>\n\t\t<string>${APP_GROUP}</string>\n\t</array>\n</dict>`
            );
          }
          fs.writeFileSync(entitlementsPath, xml);
        }
      } catch (error) {
        console.warn('[with-shopping-live-activity] could not patch LiveActivity.entitlements', error);
      }

      return cfg;
    },
  ]);
}

module.exports = function withShoppingLiveActivity(config) {
  let next = withMainAppGroup(config);
  next = withShoppingLiveActivityFiles(next);
  // EAS app-extension entitlement hint so credentials include the App Group.
  next.extra = next.extra ?? {};
  next.extra.eas = next.extra.eas ?? {};
  next.extra.eas.build = next.extra.eas.build ?? {};
  next.extra.eas.build.experimental = next.extra.eas.build.experimental ?? {};
  next.extra.eas.build.experimental.ios = next.extra.eas.build.experimental.ios ?? {};
  const extensions = next.extra.eas.build.experimental.ios.appExtensions ?? [];
  const targetName = 'LiveActivity';
  const existing = extensions.find((ext) => ext.targetName === targetName);
  if (existing) {
    existing.entitlements = ensureAppGroup(existing.entitlements ?? {});
  } else {
    extensions.push({
      targetName,
      bundleIdentifier: 'app.choremaxx.household.LiveActivity',
      entitlements: ensureAppGroup({}),
    });
  }
  next.extra.eas.build.experimental.ios.appExtensions = extensions;
  return next;
};
