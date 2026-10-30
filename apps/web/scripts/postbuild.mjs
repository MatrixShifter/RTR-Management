import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

if (fs.existsSync(distDir)) {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    const targets = [
      '404.html',
      'reset-password.html',
      'login.html',
      'forgot-password.html',
      'records.html',
      'settings.html',
      'error.html'
    ];

    targets.forEach(target => {
      fs.writeFileSync(path.join(distDir, target), htmlContent, 'utf8');
    });
    console.log(`[postbuild] Generated static SPA fallback pages: ${targets.join(', ')}`);
  }
}
