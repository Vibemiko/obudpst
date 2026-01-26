import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, isAbsolute } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');

dotenv.config({ path: join(PROJECT_ROOT, '.env') });

function resolveBinaryPath() {
  const envPath = process.env.UDPST_BINARY_PATH;

  if (!envPath) {
    return join(PROJECT_ROOT, 'udpst');
  }

  if (isAbsolute(envPath)) {
    return envPath;
  }

  return join(PROJECT_ROOT, envPath);
}

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 3000,

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },

  udpst: {
    binaryPath: resolveBinaryPath(),
    defaultPort: 25000,
    maxConcurrentTests: 10
  },

  projectRoot: PROJECT_ROOT,
  nodeEnv: process.env.NODE_ENV || 'development'
};

export function validateConfig() {
  const errors = [];
  const warnings = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.anonKey) {
    errors.push('SUPABASE_ANON_KEY is required');
  }

  if (!existsSync(config.udpst.binaryPath)) {
    warnings.push(`UDPST binary not found at: ${config.udpst.binaryPath}`);
    warnings.push('Server tests will fail until the binary is compiled.');
    warnings.push('Run "cmake . && make" in the project root to build the binary.');
  }

  if (warnings.length > 0) {
    console.warn('\n========== Configuration Warnings ==========');
    warnings.forEach(w => console.warn(`WARNING: ${w}`));
    console.warn('=============================================\n');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
