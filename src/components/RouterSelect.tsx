export type RouterOption = {
  id: number;
  name: string;
  host: string;
  enabled: boolean;
  is_default: boolean;
};

type Props = {
  routers: RouterOption[];
  defaultValue?: number | null;
  name?: string;
  id?: string;
  /** tampilkan opsi "tanpa router" (hanya simpan di database) */
  allowNone?: boolean;
  noneLabel?: string;
  help?: React.ReactNode;
  label?: string;
};

/** Dropdown pemilihan router MikroTik untuk form pelanggan / import */
export function RouterSelect({
  routers,
  defaultValue,
  name = 'router_id',
  id = 'router_id',
  allowNone = true,
  noneLabel = '— Tanpa router (hanya database) —',
  help,
  label = 'Router MikroTik (NAS)',
}: Props) {
  const fallback = routers.find((r) => r.is_default)?.id ?? routers[0]?.id ?? '';
  const value = defaultValue === undefined ? fallback : defaultValue ?? '';

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        📡 {label}
      </label>
      <select id={id} name={name} defaultValue={value} className="form-select">
        {allowNone && <option value="">{noneLabel}</option>}
        {routers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} — {r.host}
            {r.is_default ? ' ★ default' : ''}
            {!r.enabled ? ' (nonaktif)' : ''}
          </option>
        ))}
      </select>
      <div className="form-help">
        {help ??
          (routers.length
            ? 'Secret PPPoE, isolir, dan cek sesi online pelanggan ini dijalankan di router yang dipilih.'
            : 'Belum ada router. Tambahkan di Pengaturan → Router MikroTik.')}
      </div>
    </div>
  );
}
