import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// Helper to parse .env file
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const idx = line.indexOf('=');
        return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : null;
      })
      .filter((pair): pair is [string, string] => pair !== null)
  );
}

export default defineConfig(({ mode }) => {
  // Load env from both fe/.env and be/.env (fe takes priority)
  const feEnvPath = path.resolve(__dirname, '.env');
  const beEnvPath = path.resolve(__dirname, '../be/.env');

  const beEnv = parseEnvFile(beEnvPath);
  const feEnv = parseEnvFile(feEnvPath);

  // Merge: fe/.env overrides be/.env
  const env = { ...beEnv, ...feEnv };

  const httpsEnabled = env.HTTPS_ENABLED === 'true';
  const devDomain = env.DEV_DOMAIN || 'localhost';
  const devPort = parseInt(env.DEV_PORT || '5173', 10);
  const backendPort = parseInt(env.PORT || '3001', 10);

  const certDir = path.resolve(__dirname, '../certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');
  const hasSSLCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
  const useHttps = httpsEnabled && hasSSLCerts;

  // Backend protocol should match HTTPS setting
  const backendProtocol = useHttps ? 'https' : 'http';
  const backendUrl = `${backendProtocol}://localhost:${backendPort}`;

  console.log('[Vite Config] HTTPS:', { httpsEnabled, hasSSLCerts, useHttps, devDomain, backendUrl });

  return {
    test: {
      coverage: {
        enabled: true, // You can also enable it in the config
        reporter: ['lcov', 'html'], // Output formats
        reportsDirectory: './coverage', // Optional: specify output folder
      },
    },
    plugins: [
      wasm(),
      topLevelAwait(),
      react()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['tiktoken'],
    },
    build: {
      // Production optimizations
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            ui: ['lucide-react', '@headlessui/react'],
            antd: ['antd'],
            tiktoken: ['js-tiktoken'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: devPort,
      host: true,
      allowedHosts: true,
      https: useHttps ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      } : undefined,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      '__SHARED_STORAGE_DOMAIN__': JSON.stringify(env.SHARED_STORAGE_DOMAIN || '.localhost'),
    },
  };
});
