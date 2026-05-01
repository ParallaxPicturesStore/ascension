const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all packages in the monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from the monorepo root node_modules first
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Ensure only one copy of react - use the app's local copy
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(projectRoot, 'node_modules/react-native-web'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  'react-native-svg': path.resolve(projectRoot, 'node_modules/react-native-svg'),
};

// Force all react-native-svg imports to resolve to the app's single copy
const svgPath = path.resolve(projectRoot, 'node_modules/react-native-svg');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg' || moduleName.startsWith('react-native-svg/')) {
    const filePath = require.resolve(moduleName.replace('react-native-svg', svgPath));
    return { filePath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// SVG support
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

module.exports = config;
