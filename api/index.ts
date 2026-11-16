import express from 'express';
import { apiRouter } from '../src/api/routes';
import { applySecurityHeaders } from '../src/api/securityMiddleware';

const app = express();

app.use(applySecurityHeaders);
app.use(express.json({ limit: '2mb' }));
app.use(apiRouter);

export default app;
