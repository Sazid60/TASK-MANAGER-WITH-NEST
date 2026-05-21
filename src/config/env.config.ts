import * as dotenv from 'dotenv';
import * as path from 'path';
import { registerAs } from '@nestjs/config';

dotenv.config({ path: path.join(process.cwd(), '.env') });
const get = (key: string): string => process.env[key] ?? '';

const REQUIRED = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_FROM',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES_IN',
  'RESET_PASS_TOKEN',
  'RESET_PASS_TOKEN_EXPIRES_IN',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'SALT_ROUND',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'RESET_PASS_LINK',
  'OTP_EXPIRES_MINUTES',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing environment variables:');
  missing.forEach((k) => console.error(`  • ${k}`));
  console.error('\nPlease add them to your .env file and restart the application.\n');
  throw new Error(`Missing env vars: ${missing.join(', ')}`);
}

export default registerAs('app', () => ({
  node_env: get('NODE_ENV'),
  port: parseInt(get('PORT'), 10),
  database_url: get('DATABASE_URL'),
  email_sender: {
    SMTP_USER: get('SMTP_USER'),
    SMTP_PASS: get('SMTP_PASS'),
    SMTP_HOST: get('SMTP_HOST'),
    SMTP_PORT: parseInt(get('SMTP_PORT'), 10),
    SMTP_FROM: get('SMTP_FROM'),
  },
  jwt: {
    jwt_secret: get('JWT_SECRET'),
    expires_in: get('JWT_EXPIRES_IN'),
    refresh_token_secret: get('JWT_REFRESH_SECRET'),
    refresh_token_expires_in: get('JWT_REFRESH_EXPIRES_IN'),
    reset_pass_secret: get('RESET_PASS_TOKEN'),
    reset_pass_token_expires_in: get('RESET_PASS_TOKEN_EXPIRES_IN'),
  },
  redis: {
    host: get('REDIS_HOST'),
    port: parseInt(get('REDIS_PORT'), 10),
    password: get('REDIS_PASSWORD') || undefined,
  },
  salt_round: get('SALT_ROUND'),
  admin_email: get('ADMIN_EMAIL'),
  admin_password: get('ADMIN_PASSWORD'),
  reset_pass_link: get('RESET_PASS_LINK'),
  otp_expires_minutes: parseInt(get('OTP_EXPIRES_MINUTES'), 10),
}));

export type AppConfig = ReturnType<typeof import('./env.config').default>;
