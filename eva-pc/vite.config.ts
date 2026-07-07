import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  root: 'web',
  plugins: [
    electron([
      {
        entry: resolve(__dirname, 'electron/main.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              external: [
                'electron',
                'node-pty',
                'electron-store',
                'electron-updater',
                'auto-launch',
                'screenshot-desktop',
                'systeminformation',
                'child_process',
                'fs',
                'path',
                'os',
                'crypto'
              ]
            }
          }
        }
      },
      {
        entry: resolve(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              external: [
                'electron',
                'electron-store',
                'node-pty',
                'screenshot-desktop',
                'systeminformation'
              ]
            }
          }
        },
        onstart(options) {
          options.startup()
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'web')
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'web/chat.html'),
        login: resolve(__dirname, 'web/app-login.html'),
        signup: resolve(__dirname, 'web/app-signup.html'),
        reset: resolve(__dirname, 'web/app-reset.html')
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
})
