const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const resolveModulePath = (moduleName) => {
  const appPath = path.resolve(projectRoot, 'node_modules', moduleName);
  if (fs.existsSync(appPath)) {
    return appPath;
  }

  return path.resolve(monorepoRoot, 'node_modules', moduleName);
};

const config = getDefaultConfig(projectRoot);

// SVG support - mirrors ally app setup
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: path.resolve(projectRoot, 'svg-transformer.js'),
};
config.resolver = {
  ...config.resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
};

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from the app first, then fall back to the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// In this workspace most packages are hoisted to the repo root, so point Metro
// at whichever physical install actually exists.
config.resolver.extraNodeModules = {
  'react': resolveModulePath('react'),
  'react-native': resolveModulePath('react-native'),
  'react-native-svg': resolveModulePath('react-native-svg'),
  'react-native-web': resolveModulePath('react-native-web'),
  'react-dom': resolveModulePath('react-dom'),
};

// Match the working ally app setup and force all react-native-svg imports,
// including subpaths, to resolve to a single package instance.
const svgPath = resolveModulePath('react-native-svg');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg' || moduleName.startsWith('react-native-svg/')) {
    const filePath = require.resolve(moduleName.replace('react-native-svg', svgPath));
    return { filePath, type: 'sourceFile' };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
