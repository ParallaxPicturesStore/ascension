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

// Ensure only one copy of react - use the LOCAL copy (React 18 for Expo)
config.resolver.extraNodeModules = {
  'react': path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-web': path.resolve(projectRoot, 'node_modules/react-native-web'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

// Force all react/react-native imports to resolve to the app's local copy
const allyReactPath = path.resolve(projectRoot, 'node_modules/react');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { type: 'sourceFile', filePath: path.resolve(allyReactPath, 'index.js') };
  }
  if (moduleName === 'react/jsx-runtime') {
    return { type: 'sourceFile', filePath: path.resolve(allyReactPath, 'jsx-runtime.js') };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return { type: 'sourceFile', filePath: path.resolve(allyReactPath, 'jsx-dev-runtime.js') };
  }
  return context.resolveRequest(
    { ...context, resolveRequest: undefined },
    moduleName,
    platform,
  );
};

module.exports = config;
