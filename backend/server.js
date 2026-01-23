import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './src/config.js';
import { router as apiRouter } from './src/api/routes.js';

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

app.listen(config.port, () => {
  console.log(`OB-UDPST Control API running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Binary path: ${config.udpst.binaryPath}`);
});
