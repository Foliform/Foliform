const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const fs = require('node:fs/promises');
const path = require('node:path');

function removeForeignSqlitePrebuilds(buildPath, _electronVersion, platform, arch, callback) {
  const prebuildsPath = path.join(
    buildPath,
    'node_modules',
    'better-sqlite3',
    'prebuilds',
  );
  const targetPrebuild = `${platform}-${arch}.node`;

  fs.readdir(prebuildsPath)
    .then(files => Promise.all(
      files
        .filter(file => file.endsWith('.node') && file !== targetPrebuild)
        .map(file => fs.rm(path.join(prebuildsPath, file))),
    ))
    .then(() => callback(), callback);
}

module.exports = {
  packagerConfig: {
    asar: true,
    afterCopy: [removeForeignSqlitePrebuilds],
    // Keep the executable name lowercase to match the Debian/RPM package
    // metadata derived from package.json's lowercase name.
    executableName: 'foliform',
    icon: 'assets/app-icon',
    extraResource: ['assets'],
    // The Vite plugin normally packages only .vite; keep dependencies that
    // remain external in the main-process bundle as well.
    ignore: file => {
      if (!file) return false;
      return !['/.vite', '/node_modules'].some(directory =>
        file === directory || file.startsWith(`${directory}/`));
    },
  },
  rebuildConfig: {
    // Use the npm prebuild, which is compatible with the packaged Electron
    // runtime, rather than requiring a local C++ toolchain during packaging.
    ignoreModules: ['better-sqlite3'],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: 'assets/app-icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
