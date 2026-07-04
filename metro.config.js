const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const warthogTsRoot = path.resolve(projectRoot, '../warthog-ts');

const config = getDefaultConfig(projectRoot);

// Allow Metro to bundle the local file:../warthog-ts dependency.
config.watchFolders = [warthogTsRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// warthog-ts uses Node built-ins (crypto, Buffer). Polyfill for Expo Go / native bundles.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  process: require.resolve('process/browser'),
};

module.exports = config;