const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'default'];

// Hermes (React Native) doesn't support WebAssembly.
// Redirect the WASM crypto package to its pure-JS asm.js equivalent.
config.resolver.extraNodeModules = {
  '@polkadot/wasm-crypto': require.resolve('@polkadot/wasm-crypto-asmjs'),
};

module.exports = config;
