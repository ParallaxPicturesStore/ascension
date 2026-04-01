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

// Force all react imports to resolve to the same copy, even from packages/
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      moduleName,
      platform,
    );
  }
  if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    return context.resolveRequest(
      { ...context, resolveRequest: undefined },
      moduleName,
      platform,
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(
    { ...context, resolveRequest: undefined },
    moduleName,
    platform,
  );
};

module.exports = config;
