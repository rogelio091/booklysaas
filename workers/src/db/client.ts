import { drizzle } from 'drizzle-orm/d1';
import { eq, and, type SQL } from 'drizzle-orm';
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

export function createDbClient(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;

/**
 * Helper Mandatorio para Aislamiento Multi-Tenant
 * Garantiza que ninguna query a una tabla de dominio se ejecute sin companyId
 */
export function withTenant<T extends SQLiteTable & { companyId: SQLiteColumn }>(
  table: T,
  companyId: number,
  additionalCondition?: SQL,
) {
  const tenantCondition = eq(table.companyId, companyId);
  return additionalCondition
    ? and(tenantCondition, additionalCondition)
    : tenantCondition;
}
