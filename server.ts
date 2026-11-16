import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './src/api/routes';
import { applySecurityHeaders } from './src/api/securityMiddleware';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProd = process.env.NODE_ENV === 'production';
// In dev mode in AI Studio environment, the dev server must run on port 3000
const PORT = !isProd ? 3000 : Number(process.env.PORT) || 3000;

app.use(applySecurityHeaders);
app.use(express.json({ limit: '2mb' }));

// Mount Gemini API and health check routes
app.use(apiRouter);

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Start standalone dev/production server when not running inside a Vercel serverless function
if (!process.env.VERCEL) {
  startServer();
}

export default app;
