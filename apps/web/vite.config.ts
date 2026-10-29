import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const currentDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

function checkPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(250);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/**
 * Non-invasive backend readiness helper for Vite dev server.
 * Instead of spawning a competing duplicate process, it gracefully verifies
 * whether the backend API is ready on port 4000 before Vite accepts traffic.
 */
function apiReadinessPlugin(): Plugin {
  return {
    name: 'api-readiness-check',
    apply: 'serve',
    async configureServer() {
      const targetPort = 4000;
      const maxWaitMs = 15000;
      const pollIntervalMs = 200;
      const startTime = Date.now();

      // Check if backend is already listening
      let isReady = await checkPortOpen(targetPort);
      
      // If not yet ready (e.g. during concurrent npm run dev startup), wait up to maxWaitMs
      while (!isReady && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
        isReady = await checkPortOpen(targetPort);
      }

      if (isReady) {
        // eslint-disable-next-line no-console
        console.log(`\x1b[32m[vite]\x1b[0m ✓ RTR Wholesale API backend is ready on port ${targetPort} (http://127.0.0.1:${targetPort})`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`\x1b[33m[vite]\x1b[0m ⚠ RTR Wholesale API backend not detected on port ${targetPort}. Running in frontend mode.`);
        // eslint-disable-next-line no-console
        console.log(`\x1b[36m[vite]\x1b[0m ℹ Tip: To start both backend API and frontend together, run: npm run dev (or npm start)`);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), apiReadinessPlugin()],
  resolve: {
    alias: {
      '@crimpston/shared': path.resolve(currentDir, '../../packages/shared/src/index.ts')
    }
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react-router') || 
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_TARGET_URL || process.env.API_BASE_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            const isConnRefused = (err as any)?.code === 'ECONNREFUSED';
            const sanitizedUrl = req.url ? req.url.split('?')[0] : '';
            // eslint-disable-next-line no-console
            console.warn(`[vite proxy] Target 127.0.0.1:4000 unreachable for ${req.method} ${sanitizedUrl} (${(err as any)?.code || err.message})`);
            if (res && !res.headersSent && typeof (res as any).writeHead === 'function') {
              (res as any).writeHead(503, { 
                'Content-Type': 'application/json',
                'Retry-After': '1'
              });
              res.end(JSON.stringify({
                valid: false,
                error: isConnRefused ? 'BACKEND_CONNECTION_REFUSED' : 'BACKEND_SERVICE_UNAVAILABLE',
                message: isConnRefused
                  ? 'Unable to connect to RTR API at 127.0.0.1:4000. Ensure the backend server is running.'
                  : 'The RTR Wholesale backend service is currently unreachable on port 4000.'
              }));
            }
          });
        }
      }
    }
  }
});
