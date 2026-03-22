/**
 * Jest Global Setup - Runs BEFORE test files are compiled
 *
 * This ensures process.env is populated before NestJS ConfigModule
 * tries to read from it during module compilation.
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  console.log('\n🔧 Global Setup: Loading environment variables...\n');

  // Load server/.env manually
  const envPath = path.resolve(__dirname, '../../server/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key] = value;
        }
      }
    });
    console.log('  ✅ Loaded environment from', envPath);
  } else {
    console.log('  ⚠️ .env file not found at', envPath);
  }

  // Set test environment
  process.env.NODE_ENV = 'test';

  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  AUTH_MODE:', process.env.AUTH_MODE || 'jwt');
  console.log(
    '  SUPABASE_JWT_SECRET:',
    process.env.SUPABASE_JWT_SECRET ? '[SET]' : '[NOT SET]'
  );
  console.log('');
};
