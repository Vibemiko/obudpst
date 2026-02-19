import express from 'express';
import * as udpst from '../services/udpst.js';
import * as db from '../services/database.js';
import { logger } from '../utils/logger.js';

export const router = express.Router();

router.post('/server/start', async (req, res) => {
  try {
    const params = {
      port: req.body.port || 25000,
      interface: req.body.interface || '',
      daemon: req.body.daemon || false,
      authKey: req.body.authKey || '',
      verbose: req.body.verbose || false
    };

    logger.info('Starting UDPST server', params);
    const result = await udpst.startServer(params);
    logger.info('UDPST server started successfully', { processId: result.processId, pid: result.pid });

    res.json({
      success: true,
      processId: result.processId,
      pid: result.pid,
      message: 'Server started successfully',
      config: result.config
    });
  } catch (error) {
    logger.error('Failed to start UDPST server', { error: error.message, code: error.code });
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.message.includes('already running') ? 'ALREADY_RUNNING' : 'EXECUTION_FAILED'
    });
  }
});

router.post('/server/stop', async (req, res) => {
  try {
    await udpst.stopServer();

    res.json({
      success: true,
      message: 'Server stopped successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'NOT_RUNNING'
    });
  }
});

router.get('/server/status', async (req, res) => {
  try {
    const status = await udpst.getServerStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

router.get('/server/connections', async (req, res) => {
  try {
    const connections = await udpst.getServerConnections();
    res.json({ success: true, connections });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'INTERNAL_ERROR' });
  }
});

router.post('/client/start', async (req, res) => {
  try {
    const params = {
      testType: req.body.testType,
      servers: req.body.servers || [],
      port: req.body.port || 25000,
      duration: req.body.duration || 10,
      connections: req.body.connections || 1,
      interface: req.body.interface || '',
      ipVersion: req.body.ipVersion || 'ipv4',
      jumboFrames: req.body.jumboFrames !== false,
      bandwidth: req.body.bandwidth || 0,
      verbose: false,
      jsonOutput: true
    };

    if (!params.testType || !['upstream', 'downstream'].includes(params.testType)) {
      logger.warn('Invalid test type provided', { testType: params.testType });
      return res.status(400).json({
        success: false,
        error: 'testType must be "upstream" or "downstream"',
        code: 'INVALID_PARAMETERS'
      });
    }

    if (!params.servers || params.servers.length === 0) {
      logger.warn('No servers specified for test');
      return res.status(400).json({
        success: false,
        error: 'At least one server must be specified',
        code: 'INVALID_PARAMETERS'
      });
    }

    logger.info('Starting client test', { testType: params.testType, servers: params.servers, duration: params.duration });
    const result = await udpst.startClientTest(params);
    logger.info('Client test started', { testId: result.testId });

    res.json({
      success: true,
      testId: result.testId,
      status: result.status,
      message: 'Test started successfully'
    });
  } catch (error) {
    logger.error('Failed to start client test', { error: error.message, code: error.code });
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'EXECUTION_FAILED'
    });
  }
});

router.get('/test/status/:testId', async (req, res) => {
  try {
    const status = await udpst.getTestStatus(req.params.testId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: 'NOT_FOUND'
    });
  }
});

router.get('/test/results/:testId', async (req, res) => {
  try {
    const results = await udpst.getTestResults(req.params.testId);

    res.json({
      success: true,
      ...results
    });
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: 'NOT_FOUND'
    });
  }
});

router.post('/test/stop/:testId', async (req, res) => {
  try {
    await udpst.stopTest(req.params.testId);

    res.json({
      success: true,
      message: 'Test stopped successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'NOT_RUNNING'
    });
  }
});

router.get('/test/list', async (req, res) => {
  try {
    const params = {
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const result = await udpst.listTests(params);

    res.json({
      success: true,
      tests: result.tests,
      total: result.total,
      limit: params.limit,
      offset: params.offset
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

router.get('/binary/info', async (req, res) => {
  try {
    const binaryInfo = await udpst.checkBinary();

    res.json({
      success: true,
      ...binaryInfo,
      capabilities: {
        authentication: true,
        gso: true,
        jumboFrames: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});

router.delete('/test/:testId', async (req, res) => {
  try {
    logger.info('Deleting test', { testId: req.params.testId });
    await db.deleteTest(req.params.testId);
    logger.info('Test deleted successfully', { testId: req.params.testId });

    res.json({
      success: true,
      message: 'Test deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete test', { testId: req.params.testId, error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR'
    });
  }
});

router.delete('/test', async (req, res) => {
  try {
    logger.info('Deleting all tests');
    await db.deleteAllTests();
    logger.info('All tests deleted successfully');

    res.json({
      success: true,
      message: 'All tests deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete all tests', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
});
