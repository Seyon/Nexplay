const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');

const config = getDefaultConfig(__dirname);

// Polyfill Node core modules with empty module stub to avoid React Native bundler errors
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'cheerio': path.resolve(__dirname, 'node_modules/cheerio/dist/commonjs/slim.js'),
  'assert': path.resolve(__dirname, 'src/empty-module.js'),
  'node:assert': path.resolve(__dirname, 'src/empty-module.js'),
  'events': path.resolve(__dirname, 'src/empty-module.js'),
  'node:events': path.resolve(__dirname, 'src/empty-module.js'),
  'stream': path.resolve(__dirname, 'src/empty-module.js'),
  'node:stream': path.resolve(__dirname, 'src/empty-module.js'),
  'undici': path.resolve(__dirname, 'src/empty-module.js'),
  'fs': path.resolve(__dirname, 'src/empty-module.js'),
  'node:fs': path.resolve(__dirname, 'src/empty-module.js'),
  'path': path.resolve(__dirname, 'src/empty-module.js'),
  'node:path': path.resolve(__dirname, 'src/empty-module.js'),
  'util': path.resolve(__dirname, 'src/empty-module.js'),
  'node:util': path.resolve(__dirname, 'src/empty-module.js'),
  'string_decoder': path.resolve(__dirname, 'src/empty-module.js'),
  'node:string_decoder': path.resolve(__dirname, 'src/empty-module.js'),
  'net': path.resolve(__dirname, 'src/empty-module.js'),
  'node:net': path.resolve(__dirname, 'src/empty-module.js'),
  'tls': path.resolve(__dirname, 'src/empty-module.js'),
  'node:tls': path.resolve(__dirname, 'src/empty-module.js'),
  'http': path.resolve(__dirname, 'src/empty-module.js'),
  'node:http': path.resolve(__dirname, 'src/empty-module.js'),
  'https': path.resolve(__dirname, 'src/empty-module.js'),
  'node:https': path.resolve(__dirname, 'src/empty-module.js'),
  'crypto': path.resolve(__dirname, 'src/empty-module.js'),
  'node:crypto': path.resolve(__dirname, 'src/empty-module.js'),
  'url': path.resolve(__dirname, 'src/empty-module.js'),
  'node:url': path.resolve(__dirname, 'src/empty-module.js'),
  'buffer': path.resolve(__dirname, 'src/empty-module.js'),
  'node:buffer': path.resolve(__dirname, 'src/empty-module.js'),
};

module.exports = config;
