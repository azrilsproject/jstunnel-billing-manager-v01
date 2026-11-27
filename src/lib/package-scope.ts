/** Paket tanpa router (router_id null) berlaku di semua router; selain itu hanya di routernya sendiri. */
export function packageFitsRouter(packageRouterId: number | null, routerId: number | null) {
  return packageRouterId === null || packageRouterId === routerId;
}
