import { getServiceColor } from '@/lib/inventory/getServiceColor';

type Props = {
  service: string;
  provider?: string;
};

export default function ServiceBadge({
  service,
  provider
}: Props) {
  // Sin provider explícito no se asume color (evita teñir Huawei como AWS).
  const color = provider ? getServiceColor(provider, service) : null;

  return (
    <span
      className="
        inline-flex
        items-center
        px-3
        py-1
        rounded-full
        text-xs
        font-semibold
        border
        whitespace-nowrap
      "
      style={color
        ? {
            backgroundColor: `${color}15`,
            color: color,
            borderColor: `${color}40`,
          }
        : {
            backgroundColor: "var(--bg-hover)",
            color: "var(--text-secondary)",
            borderColor: "var(--border)",
          }}
    >
      {service}
    </span>
  );
}