const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.transformer.babelTransformerPath = require.resolve('./svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

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
  'react-native-svg': path.resolve(monorepoRoot, 'node_modules/react-native-svg'),
  'react-native-web': path.resolve(projectRoot, 'node_modules/react-native-web'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

module.exports = config;
