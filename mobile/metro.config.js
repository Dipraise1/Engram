const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'default'];

// Hermes (React Native) doesn't support WebAssembly.
// Redirect the WASM crypto package to its pure-JS asm.js equivalent.
config.resolver.extraNodeModules = {
  '@polkadot/wasm-crypto': require.resolve('@polkadot/wasm-crypto-asmjs'),
};

// Escape hatch for restricted environments (sandboxes, CI, containers) where
// the Watchman daemon is unavailable or flaky — its socket dropping out crashes
// Metro. Set METRO_NO_WATCHMAN=1 to fall back to Metro's built-in Node watcher.
if (process.env.METRO_NO_WATCHMAN) {
  config.resolver.useWatchman = false;
}

module.exports = config;
