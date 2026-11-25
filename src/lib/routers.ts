import 'server-only';
import { query, queryOne } from './db';

export type Router = {
  id: number;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
  isolir_profile: string;
  enabled: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
};

export type RouterWithStats = Router & {
  customer_total: number;
  customer_active: number;
  customer_isolated: number;
};

/** Data router yang aman dikirim ke client (tanpa password) */
export type RouterSummary = Omit<Router, 'password'> & { has_password: boolean };

export function toSummary(r: Router): RouterSummary {
  const { password, ...rest } = r;
  return { ...rest, has_password: !!password };
}

export async function listRouters(): Promise<Router[]> {
  return query<Router>('SELECT * FROM routers ORDER BY is_default DESC, name ASC');
}

export async function listRoutersWithStats(): Promise<RouterWithStats[]> {
  return query<RouterWithStats>(`
    SELECT r.*,
      count(c.id)::int AS customer_total,
      count(c.id) FILTER (WHERE c.status = 'active')::int AS customer_active,
      count(c.id) FILTER (WHERE c.status = 'isolated')::int AS customer_isolated
    FROM routers r
    LEFT JOIN customers c ON c.router_id = r.id
    GROUP BY r.id
    ORDER BY r.is_default DESC, r.name ASC`);
}

export async function getRouter(id: number | null | undefined): Promise<Router | null> {
  if (!id) return null;
  return queryOne<Router>('SELECT * FROM routers WHERE id = $1', [id]);
}

export async function getDefaultRouter(): Promise<Router | null> {
  return queryOne<Router>('SELECT * FROM routers WHERE is_default LIMIT 1');
}

export function isRouterUsable(r: Router | null | undefined): r is Router & { enabled: true } {
  return !!r && r.enabled && !!r.host;
}
