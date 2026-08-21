import type { D1Database } from '@cloudflare/workers-types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './db/schema';

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RECURRENTE_API_KEY?: string;
  RECURRENTE_WEBHOOK_SECRET?: string;
}

export interface UserJwtPayload {
  sub: number;       // user_id
  companyId: number; // company_id
  email: string;
  role: 'admin' | 'staff' | 'superadmin';
}

export interface AppVariables {
  db: DrizzleD1Database<typeof schema>;
  user?: UserJwtPayload;
  companyId?: number;
}

export type AppContext = {
  Bindings: Env;
  Variables: AppVariables;
};
