export function parseUdpstOutput(output) {
  const jsonMatch = output.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON found in output');
  }

  let jsonData;
  try {
    jsonData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }

  const throughput = extractThroughput(jsonData);
  const packetLoss = extractPacketLoss(jsonData);
  const latency = extractLatency(jsonData);
  const jitter = extractJitter(jsonData);
  const subIntervalData = extractSubIntervalData(jsonData);

  return {
    throughput,
    packetLoss,
    latency,
    jitter,
    hasValidData: subIntervalData.hasData,
    intervalCount: subIntervalData.count,
    completionPercentage: subIntervalData.completionPercentage,
    raw: jsonData
  };
}

function extractThroughput(json) {
  if (json.IPLayerCapacity) {
    return parseFloat(json.IPLayerCapacity) || 0;
  }

  if (json.AvgRate) {
    return parseFloat(json.AvgRate) || 0;
  }

  if (json.summary?.IPLayerCapacity) {
    return parseFloat(json.summary.IPLayerCapacity) || 0;
  }

  return 0;
}

function extractPacketLoss(json) {
  if (json.LossRatio !== undefined) {
    return parseFloat(json.LossRatio) * 100 || 0;
  }

  if (json.Delivered !== undefined) {
    const delivered = parseFloat(json.Delivered);
    return Math.max(0, 100 - delivered);
  }

  if (json.summary?.LossRatio !== undefined) {
    return parseFloat(json.summary.LossRatio) * 100 || 0;
  }

  return 0;
}

function extractLatency(json) {
  if (json.MinDelay !== undefined) {
    return parseFloat(json.MinDelay) || 0;
  }

  if (json.RTTMin !== undefined) {
    return parseFloat(json.RTTMin) || 0;
  }

  if (json.summary?.MinDelay !== undefined) {
    return parseFloat(json.summary.MinDelay) || 0;
  }

  return 0;
}

function extractJitter(json) {
  if (json.PDV !== undefined) {
    return parseFloat(json.PDV) || 0;
  }

  if (json.MaxDelay !== undefined && json.MinDelay !== undefined) {
    const maxDelay = parseFloat(json.MaxDelay) || 0;
    const minDelay = parseFloat(json.MinDelay) || 0;
    return maxDelay - minDelay;
  }

  if (json.summary?.PDV !== undefined) {
    return parseFloat(json.summary.PDV) || 0;
  }

  return 0;
}

function extractSubIntervalData(json) {
  let intervalCount = 0;
  let hasData = false;

  if (json.IncrementalResult && Array.isArray(json.IncrementalResult)) {
    intervalCount = json.IncrementalResult.length;
    hasData = intervalCount > 0;
  }

  if (!hasData && json.TestInterval !== undefined) {
    const testInterval = parseFloat(json.TestInterval) || 0;
    if (testInterval > 0) {
      intervalCount = 1;
      hasData = true;
    }
  }

  const expectedDuration = json.TestIntTime || json.TestInterval || 0;
  const completionPercentage = expectedDuration > 0 && intervalCount > 0
    ? Math.min(100, (intervalCount / expectedDuration) * 100)
    : 0;

  return {
    count: intervalCount,
    hasData,
    completionPercentage
  };
}

export function assessResultQuality(results, expectedDuration) {
  if (!results || !results.hasValidData) {
    return {
      quality: 'NO_DATA',
      score: 0,
      message: 'No valid test data collected'
    };
  }

  const intervalCount = results.intervalCount || 0;
  const expectedIntervals = expectedDuration || 0;

  if (expectedIntervals === 0 || intervalCount === 0) {
    return {
      quality: 'NO_DATA',
      score: 0,
      message: 'Insufficient interval data'
    };
  }

  const completionRatio = intervalCount / expectedIntervals;

  if (completionRatio >= 0.95) {
    return {
      quality: 'COMPLETE',
      score: 100,
      message: 'Test completed successfully with full data',
      intervalsCollected: intervalCount,
      intervalsExpected: expectedIntervals
    };
  }

  if (completionRatio >= 0.80) {
    return {
      quality: 'PARTIAL_GOOD',
      score: 80,
      message: 'Test completed with good data quality',
      intervalsCollected: intervalCount,
      intervalsExpected: expectedIntervals
    };
  }

  if (completionRatio >= 0.50) {
    return {
      quality: 'PARTIAL_POOR',
      score: 50,
      message: 'Test completed with partial data',
      intervalsCollected: intervalCount,
      intervalsExpected: expectedIntervals
    };
  }

  return {
    quality: 'INSUFFICIENT',
    score: 20,
    message: 'Test did not collect enough data',
    intervalsCollected: intervalCount,
    intervalsExpected: expectedIntervals
  };
}

export function classifyErrorSeverity(errorStatus, errorMessage2, results, testType) {
  const msg2Lower = (errorMessage2 || '').toLowerCase();
  const hasValidData = results?.hasValidData || false;

  if (errorStatus === 200 && testType === 'downstream' && hasValidData) {
    if (msg2Lower.includes('incoming traffic has completely stopped')) {
      return {
        severity: 'INFO',
        reason: 'Normal downstream test completion pattern',
        message: 'Test completed successfully. The "connection unavailable" warning is expected behavior for downstream tests where the server controls data flow termination.'
      };
    }

    return {
      severity: 'WARNING',
      reason: 'Downstream test completed with data but connection warning',
      message: 'Test completed and collected valid data, but connection terminated unexpectedly.'
    };
  }

  if (errorStatus === 200 && !hasValidData) {
    return {
      severity: 'FATAL',
      reason: 'No data collected',
      message: 'Minimum required connections unavailable and no test data was collected.'
    };
  }

  if (errorStatus === 3 || errorStatus === 200) {
    if (hasValidData) {
      return {
        severity: 'WARNING',
        reason: 'Test completed with connection issues',
        message: 'Test collected data but experienced connection problems.'
      };
    }
    return {
      severity: 'FATAL',
      reason: 'Connection unavailable',
      message: 'Could not establish or maintain required connections.'
    };
  }

  if (errorStatus === 1 || errorStatus === 2) {
    return {
      severity: 'WARNING',
      reason: 'Test inconclusive',
      message: 'Test completed but results may not be reliable.'
    };
  }

  if (errorStatus === 4 || errorStatus === 5) {
    return {
      severity: 'FATAL',
      reason: 'Configuration or protocol error',
      message: 'Test failed due to protocol mismatch or authentication error.'
    };
  }

  return {
    severity: 'FATAL',
    reason: 'Unknown error',
    message: `Test failed with error status ${errorStatus}.`
  };
}
