/**
 * Expo Config Plugin: withScreenCapture
 *
 * Injects Android permissions and foreground service declarations required
 * for MediaProjection-based screen capture into the AndroidManifest.xml.
 *
 * Usage in app.json:
 *   "plugins": ["expo-router", "./plugins/withScreenCapture"]
 */
const {
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');

/**
 * Add a <uses-permission> element if it doesn't already exist.
 */
function addPermission(androidManifest, permission) {
  const { manifest } = androidManifest;

  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  const exists = manifest['uses-permission'].some(
    (p) => p.$?.['android:name'] === permission
  );

  if (!exists) {
    manifest['uses-permission'].push({
      $: { 'android:name': permission },
    });
  }
}

/**
 * Add the ScreenCaptureService foreground service declaration to the
 * <application> block if it doesn't already exist.
 */
function addForegroundService(androidManifest) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return;

  if (!application.service) {
    application.service = [];
  }

  const serviceName = 'app.getascension.mobile.capture.ScreenCaptureService';

  const exists = application.service.some(
    (s) => s.$?.['android:name'] === serviceName
  );

  if (!exists) {
    application.service.push({
      $: {
        'android:name': serviceName,
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'mediaProjection',
      },
    });
  }
}

const withScreenCapture = (config) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    // Required permissions for MediaProjection + foreground service
    addPermission(androidManifest, 'android.permission.FOREGROUND_SERVICE');
    addPermission(
      androidManifest,
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
    );
    addPermission(androidManifest, 'android.permission.POST_NOTIFICATIONS');
    addPermission(androidManifest, 'android.permission.SYSTEM_ALERT_WINDOW');

    // Declare the foreground capture service
    addForegroundService(androidManifest);

    return config;
  });
};

module.exports = withScreenCapture;
