import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

const currentDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

function checkPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(350);
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

function apiServerDevPlugin(): Plugin {
  return {
    name: 'api-server-dev',
    apply: 'serve', // Only active during `vite` dev server, never during build
    async configureServer(server) {
      const isRunning = await checkPortOpen(4000);
      if (!isRunning) {
        const tsxCli = path.resolve(currentDir, '../../node_modules/tsx/dist/cli.mjs');
        const serverFile = path.resolve(currentDir, '../api/src/server.ts');
        const apiCwd = path.resolve(currentDir, '../api');

        const apiProcess = spawn(process.execPath, [tsxCli, 'watch', serverFile], {
          cwd: apiCwd,
          stdio: 'inherit'
        });

        const cleanup = () => {
          try {
            apiProcess.kill();
          } catch {}
        };

        server.httpServer?.on('close', cleanup);
        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), apiServerDevPlugin()],
  resolve: {
    alias: {
      '@crimpston/shared': path.resolve(currentDir, '../../packages/shared/src/index.ts')
    }
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
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
        target: process.env.API_TARGET_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && !res.headersSent && typeof (res as any).writeHead === 'function') {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                valid: false,
                error: 'Backend API Service Unavailable',
                message: 'The RTR Wholesale backend service is currently unreachable on port 4000.'
              }));
            }
          });
        }
      }
    }
  }
});
