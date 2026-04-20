/**
 * Expo Config Plugin: withScreenCapture
 *
 * 1. Injects Android permissions and foreground service declarations required
 *    for MediaProjection-based screen capture into the AndroidManifest.xml.
 * 2. Registers ScreenCapturePackage in MainApplication.kt so the native
 *    module is available to the JS bridge at runtime.
 *
 * Usage in app.json:
 *   "plugins": ["expo-router", "./plugins/withScreenCapture"]
 */
const {
  withAndroidManifest,
  withMainApplication,
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

/**
 * Register ScreenCapturePackage in MainApplication.kt so the native module
 * is visible to the React Native JS bridge.
 *
 * Inserts the import and an `add(ScreenCapturePackage())` call inside the
 * `PackageList(this).packages.apply { … }` block that Expo prebuild generates.
 */
function withScreenCapturePackage(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    const importLine = 'import app.getascension.mobile.capture.ScreenCapturePackage';

    // Add import after the package declaration line if not already present
    if (!contents.includes(importLine)) {
      contents = contents.replace(
        /^(package .+)$/m,
        `$1\n\n${importLine}`
      );
    }

    // Inject the package registration inside the apply block
    if (!contents.includes('ScreenCapturePackage()')) {
      // Expo's generated MainApplication.kt has this comment inside apply { }
      contents = contents.replace(
        /(PackageList\(this\)\.packages\.apply \{[^}]*?\/\/ Packages that cannot be autolinked)/s,
        `$1\n              add(ScreenCapturePackage())`
      );

      // Fallback: plain apply block without the comment (new arch / different template)
      if (!contents.includes('ScreenCapturePackage()')) {
        contents = contents.replace(
          /PackageList\(this\)\.packages\.apply \{/,
          `PackageList(this).packages.apply {\n              add(ScreenCapturePackage())`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

const withScreenCapture = (config) => {
  // 1. AndroidManifest permissions + foreground service declaration
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;

    addPermission(androidManifest, 'android.permission.FOREGROUND_SERVICE');
    addPermission(
      androidManifest,
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
    );
    addPermission(androidManifest, 'android.permission.POST_NOTIFICATIONS');
    addPermission(androidManifest, 'android.permission.SYSTEM_ALERT_WINDOW');
    // For saving debug screenshots to the gallery (Android 13+)
    addPermission(androidManifest, 'android.permission.READ_MEDIA_IMAGES');
    // For saving debug screenshots to the gallery (Android 9 and below)
    addPermission(androidManifest, 'android.permission.WRITE_EXTERNAL_STORAGE');

    addForegroundService(androidManifest);

    // Allow direct writes to external storage (needed for Downloads folder)
    // requestLegacyExternalStorage is required on Android 10 (API 29)
    const application = androidManifest.manifest.application?.[0];
    if (application && application.$) {
      application.$['android:requestLegacyExternalStorage'] = 'true';
    }

    return config;
  });

  // 2. MainApplication package registration
  config = withScreenCapturePackage(config);

  return config;
};

module.exports = withScreenCapture;
