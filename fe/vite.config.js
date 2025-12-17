var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
// Helper to parse .env file
function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    return Object.fromEntries(fs.readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(function (line) { return line && !line.startsWith('#'); })
        .map(function (line) {
        var idx = line.indexOf('=');
        return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : null;
    })
        .filter(function (pair) { return pair !== null; }));
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    // Load env from both fe/.env and be/.env (fe takes priority)
    var feEnvPath = path.resolve(__dirname, '.env');
    var beEnvPath = path.resolve(__dirname, '../be/.env');
    var beEnv = parseEnvFile(beEnvPath);
    var feEnv = parseEnvFile(feEnvPath);
    // Merge: fe/.env overrides be/.env
    var env = __assign(__assign({}, beEnv), feEnv);
    var httpsEnabled = env.HTTPS_ENABLED === 'true';
    var devDomain = env.DEV_DOMAIN || 'localhost';
    var devPort = parseInt(env.DEV_PORT || '5173', 10);
    var backendPort = parseInt(env.PORT || '3001', 10);
    var certDir = path.resolve(__dirname, '../certs');
    var keyPath = path.join(certDir, 'key.pem');
    var certPath = path.join(certDir, 'cert.pem');
    var hasSSLCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
    var useHttps = httpsEnabled && hasSSLCerts;
    // Backend protocol should match HTTPS setting
    var backendProtocol = useHttps ? 'https' : 'http';
    var backendUrl = "".concat(backendProtocol, "://localhost:").concat(backendPort);
    console.log('[Vite Config] HTTPS:', { httpsEnabled: httpsEnabled, hasSSLCerts: hasSSLCerts, useHttps: useHttps, devDomain: devDomain, backendUrl: backendUrl });
    return {
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
