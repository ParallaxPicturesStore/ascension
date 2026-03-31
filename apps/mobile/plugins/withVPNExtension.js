/**
 * Expo Config Plugin: withVPNExtension
 *
 * Adds the necessary iOS capabilities and entitlements for:
 * 1. Network Extension (VPN DNS filter) - NEPacketTunnelProvider
 * 2. Safari Content Blocker - blocks adult content in Safari
 * 3. App Groups - shared data between main app and extensions
 *
 * Note: The actual Xcode extension targets (AscensionVPN and
 * AscensionContentBlocker) require manual setup in Xcode or
 * custom EAS Build configuration, since Expo config plugins
 * cannot create new build targets. This plugin handles the
 * main app target's capabilities and entitlements.
 *
 * Usage in app.json:
 *   "plugins": ["expo-router", "./plugins/withScreenCapture", "./plugins/withVPNExtension"]
 */
const {
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

/**
 * Add Network Extension and App Groups entitlements to the main app target.
 */
function withVPNEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    // Network Extension capability - required for the main app to manage
    // the packet tunnel provider extension
    if (!config.modResults['com.apple.developer.networking.networkextension']) {
      config.modResults['com.apple.developer.networking.networkextension'] = [
        'packet-tunnel-provider',
      ];
    }

    // App Groups - shared container between main app and extensions
    if (!config.modResults['com.apple.security.application-groups']) {
      config.modResults['com.apple.security.application-groups'] = [
        'group.app.getascension',
      ];
    }

    // Personal VPN entitlement - required for NETunnelProviderManager
    if (!config.modResults['com.apple.developer.networking.vpn.api']) {
      config.modResults['com.apple.developer.networking.vpn.api'] = [
        'allow-vpn',
      ];
    }

    return config;
  });
}

/**
 * Add background modes to Info.plist for network extension support.
 */
function withVPNInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    // Background modes - network extension needs to run in background
    const bgModes = config.modResults.UIBackgroundModes || [];

    if (!bgModes.includes('network-extension')) {
      bgModes.push('network-extension');
    }

    config.modResults.UIBackgroundModes = bgModes;

    return config;
  });
}

/**
 * Main plugin entry point - composes all sub-plugins.
 */
const withVPNExtension = (config) => {
  config = withVPNEntitlements(config);
  config = withVPNInfoPlist(config);
  return config;
};

module.exports = withVPNExtension;
