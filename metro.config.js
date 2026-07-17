const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
// Prefer the installed file: link (may be a nested symlink); fall back to sibling path.
const warthogTsLinked = path.resolve(projectRoot, 'node_modules/warthog-ts');
const warthogTsSibling = path.resolve(projectRoot, '../warthog-ts');
const warthogTsRoot = fs.realpathSync(
  fs.existsSync(warthogTsLinked) ? warthogTsLinked : warthogTsSibling
);

const config = getDefaultConfig(projectRoot);

// Allow Metro to bundle the local file:../warthog-ts dependency.
config.watchFolders = [warthogTsRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// warthog-ts uses Node built-ins (crypto, Buffer). Polyfill for Expo Go / native bundles.
// Map warthog-ts explicitly so release bundling follows the real package path.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'warthog-ts': warthogTsRoot,
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  events: require.resolve('events'),
  process: require.resolve('process/browser'),
};

module.exports = config;