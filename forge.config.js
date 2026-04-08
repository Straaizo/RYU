module.exports = {
  packagerConfig: {
    asar: true,
    name: 'RYU',
    executableName: 'RYU',
  },
  rebuildConfig: {},
  makers: [
    {
      // Solo ZIP portable — el instalador lo genera electron-builder por separado
      name: '@electron-forge/maker-zip',
      platforms: ['win32', 'darwin'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'electron/main.js',
            config: 'vite.main.config.js',
          },
          {
            entry: 'electron/preload.js',
            config: 'vite.preload.config.js',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.js',
          },
        ],
      },
    },
  ],
};
