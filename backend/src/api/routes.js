import express from 'express';
import * as udpst from '../services/udpst.js';

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

    const result = await udpst.startServer(params);

    res.json({
      success: true,
      processId: result.processId,
      pid: result.pid,
      message: 'Server started successfully',
      config: result.config
    });
  } catch (error) {
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
      verbose: req.body.verbose || false,
      jsonOutput: req.body.jsonOutput !== false
    };

    if (!params.testType || !['upstream', 'downstream'].includes(params.testType)) {
      return res.status(400).json({
        success: false,
        error: 'testType must be "upstream" or "downstream"',
        code: 'INVALID_PARAMETERS'
      });
    }

    if (!params.servers || params.servers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one server must be specified',
        code: 'INVALID_PARAMETERS'
      });
    }

    const result = await udpst.startClientTest(params);

    res.json({
      success: true,
      testId: result.testId,
      status: result.status,
      message: 'Test started successfully'
    });
  } catch (error) {
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
