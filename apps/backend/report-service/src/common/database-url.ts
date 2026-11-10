import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

/**
 * URL of another service's database: the explicit env var if set, otherwise DATABASE_URL with the
 * database name swapped (all service databases live on the same Postgres server).
 */
export function resolveDatabaseUrl(config: ConfigService, envName: string, fallbackDbName: string): string {
  const direct = config.get<string>(envName);
  if (direct) {
    return direct;
  }

  const base = config.get<string>('DATABASE_URL', '');
  if (!base) {
    throw new Error(`Missing database url for ${envName}`);
  }

  try {
    const url = new URL(base);
    url.pathname = `/${fallbackDbName}`;
    return url.toString();
  } catch {
    throw new Error(`Invalid DATABASE_URL format: ${base}`);
  }
}

export function createReadPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
}
