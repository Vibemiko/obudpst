import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

export const config = {
  port: process.env.PORT || 3000,

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  },

  udpst: {
    binaryPath: process.env.UDPST_BINARY_PATH || join(__dirname, '../../udpst'),
    defaultPort: 25000,
    maxConcurrentTests: 10
  },

  nodeEnv: process.env.NODE_ENV || 'development'
};

export function validateConfig() {
  const errors = [];

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL is required');
  }

  if (!config.supabase.anonKey) {
    errors.push('SUPABASE_ANON_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
