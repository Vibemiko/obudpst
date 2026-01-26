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

app.listen(config.port, config.host, () => {
  console.log(`OB-UDPST Control API running on ${config.host}:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Binary path: ${config.udpst.binaryPath}`);
  if (config.host === '0.0.0.0') {
    console.log(`Server accessible on all network interfaces`);
  }
});
