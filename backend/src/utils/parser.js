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

  return {
    throughput,
    packetLoss,
    latency,
    jitter,
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
