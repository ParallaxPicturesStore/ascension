const path = require('path');
const Module = require('module');

// react-native-svg-transformer is hoisted to the monorepo root and can't
// resolve @expo/metro-config from there. Redirect those lookups into the
// app's own node_modules before the transformer module is evaluated.
const appNodeModules = path.resolve(__dirname, 'node_modules');
const _resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (
    request === '@expo/metro-config/babel-transformer' ||
    request === '@react-native/metro-babel-transformer' ||
    request === 'metro-react-native-babel-transformer'
  ) {
    const opts = { ...(options || {}), paths: [appNodeModules] };
    return _resolveFilename.call(this, '@expo/metro-config/babel-transformer', parent, isMain, opts);
  }
  return _resolveFilename.call(this, request, parent, isMain, options);
};

const { createTransformer } = require('react-native-svg-transformer');
Module._resolveFilename = _resolveFilename;

const upstreamTransformer = require('@expo/metro-config/babel-transformer');
module.exports.transform = createTransformer(upstreamTransformer);
