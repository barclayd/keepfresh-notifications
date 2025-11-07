import * as z from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required'),
  SUPABASE_SERVICE_ROLE: z.string().min(1, 'SUPABASE_SERVICE_ROLE is required'),
  SUPABASE_JWT_SECRET: z
    .string()
    .min(32, 'SUPABASE_JWT_SECRET must be at least 32 characters'),
  APNS_SIGNING_KEY: z
    .string()
    .min(1, 'APNS_SIGNING_KEY must be at least 32 characters'),
  APNS_TEAM_ID: z
    .string()
    .min(1, 'APNS_TEAM_ID must be at least 32 characters'),
  APNS_KEY_ID: z.string().min(1, 'APNS_TEAM_ID must be at least 32 characters'),
  APNS_BUNDLE_ID: z
    .string()
    .min(1, 'APNS_BUNDLE_ID must be at least 32 characters'),
  APNS_ENVIRONMENT: z.enum(['development', 'production']).default('production'),
});

export const env = envSchema.parse(process.env);
