import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
        // The `electron` module is CommonJS and exposes no ESM named exports, so
        // the main process must be CommonJS. The project is `type: module`,
        // which makes the .cjs extension necessary.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
        // Preload scripts must be CommonJS too; a sandboxed preload cannot be
        // an ES module.
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
