const path = require('node:path');
const { getDefaultConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const root = path.resolve(__dirname, '..');
const appNodeModules = path.resolve(__dirname, 'node_modules');
const defaultConfig = getDefaultConfig(__dirname);

module.exports = {
  ...defaultConfig,
  watchFolders: [root],
  resolver: {
    ...defaultConfig.resolver,
    unstable_enableSymlinks: true,
    nodeModulesPaths: [
      appNodeModules,
      ...(defaultConfig.resolver.nodeModulesPaths ?? []),
    ],
    extraNodeModules: {
      ...defaultConfig.resolver.extraNodeModules,
      '@babel/runtime': path.join(appNodeModules, '@babel/runtime'),
      react: path.join(appNodeModules, 'react'),
      'react-native': path.join(appNodeModules, 'react-native'),
      'react-native-nitro-modules': path.join(appNodeModules, 'react-native-nitro-modules'),
      'react-native-safe-area-context': path.join(appNodeModules, 'react-native-safe-area-context'),
    },
  },
};
