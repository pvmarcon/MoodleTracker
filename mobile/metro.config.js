// Metro config: lets the app import the shared, platform-agnostic code
// (domain logic, AI layer, store) from the web project's ../src via "@/...".
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../src');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // "@/x" -> ../src/x (shared code)
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(context, path.join(sharedRoot, moduleName.slice(2)), platform);
  }
  // Bare imports from shared files (e.g. "react") resolve from the mobile app,
  // so the web project's node_modules never leak in (single React copy).
  if (context.originModulePath.startsWith(sharedRoot + path.sep) && !moduleName.startsWith('.') && !path.isAbsolute(moduleName)) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, 'package.json') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
