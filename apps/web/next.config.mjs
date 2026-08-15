import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  transpilePackages: ["@ratecoaster/shared"],

  /*
   * Pin the workspace root. Next infers it by walking up looking for lockfiles,
   * and any stray package-lock.json in a parent directory (a home folder, say)
   * hijacks that inference — which silently breaks CSS module resolution and
   * server-file tracing. Being explicit costs one line and removes the class.
   */
  outputFileTracingRoot: resolve(here, "../.."),

  webpack: (config) => {
    /*
     * The shared package uses explicit `.js` specifiers on relative imports,
     * which Node's ESM resolver requires and which lets the same source run
     * unbuilt under tsx in the API. Webpack needs to be taught the same rule.
     */
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};
