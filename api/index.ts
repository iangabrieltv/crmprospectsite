import express from 'express';
import { apiRouter } from '../src/api/routes';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(apiRouter);

export default app;
