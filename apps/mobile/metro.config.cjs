const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { resolve } = require("metro-resolver");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const sharedSourceRoot = `${path.join(workspaceRoot, "packages", "shared", "src")}${path.sep}`;
const config = getDefaultConfig(projectRoot);

// The API schemas and client live in the workspace, not a copied mobile-only
// package. Watching the root makes contract changes visible to Expo instantly.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The shared package follows Node ESM convention and writes `./thing.js` in
// source imports, even though the checked-in files are TypeScript. Node sees
// emitted .js files; Metro reads source directly, so translate only relative
// .js requests back to their .ts source counterparts.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.startsWith(sharedSourceRoot) &&
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js")
  ) {
    return resolve(context, `${moduleName.slice(0, -3)}.ts`, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
