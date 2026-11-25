import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DatabaseInstance = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzleDb?: DatabaseInstance;
};

function ehCloudflareWorkers(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

function obterDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Defina a variável DATABASE_URL nas configurações do servidor (Cloudflare Workers Variables & Secrets ou Vercel Environment Variables)."
    );
  }
  return url;
}

export function getPool(): Pool {
  const connectionString = obterDatabaseUrl();

  // No runtime Cloudflare Workers, sockets TCP não podem ser compartilhados entre requisições distintas.
  // `maxUses: 1` garante fechamento automático do socket assim que a query/transação termina.
  if (ehCloudflareWorkers()) {
    return new Pool({
      connectionString,
      max: 3,
      maxUses: 1,
      connectionTimeoutMillis: 10000,
    });
  }

  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString,
    });
  }

  return globalForDb.__arenaNextJsPostgresqlPool;
}

function getDbInstance(): DatabaseInstance {
  if (ehCloudflareWorkers()) {
    return drizzle(getPool(), { schema });
  }

  if (!globalForDb.__arenaNextJsDrizzleDb) {
    globalForDb.__arenaNextJsDrizzleDb = drizzle(getPool(), { schema });
  }

  return globalForDb.__arenaNextJsDrizzleDb;
}

/**
 * Proxy preguiçoso (lazy): evita erro durante `next build` / `opennextjs-cloudflare build`
 * quando `DATABASE_URL` só existe em tempo de execução, e isola conexões por requisição no Cloudflare Workers.
 */
export const db = new Proxy({} as DatabaseInstance, {
  get(_target, prop, receiver) {
    const instancia = getDbInstance();
    const valor = Reflect.get(instancia, prop, receiver);
    return typeof valor === "function" ? valor.bind(instancia) : valor;
  },
});
