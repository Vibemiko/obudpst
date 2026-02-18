import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './src/config.js';
import { router as apiRouter } from './src/api/routes.js';
import { logger, logRequest } from './src/utils/logger.js';

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());
app.use(logRequest);

app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

app.listen(config.port, config.host, () => {
  logger.info(`OB-UDPST Control API started`, {
    host: config.host,
    port: config.port,
    environment: config.nodeEnv,
    machineId: config.machineId,
    binaryPath: config.udpst.binaryPath,
    networkAccess: config.host === '0.0.0.0' ? 'all interfaces' : 'restricted'
  });
});
