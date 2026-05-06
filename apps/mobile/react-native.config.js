const path = require('path');

/**
 * Monorepo fix: react-native-svg is hoisted to the workspace root, so the
 * React Native Gradle plugin's autolinking/codegen scan can't find it when
 * running from apps/mobile.  Declaring it explicitly here ensures the Gradle
 * codegen step generates the required RNSVG* specs and silences the
 * "Codegen didn't run for RNSVG*" New Architecture warnings.
 */
module.exports = {
  dependencies: {
    'react-native-svg': {
      root: path.dirname(require.resolve('react-native-svg/package.json')),
    },
  },
};
