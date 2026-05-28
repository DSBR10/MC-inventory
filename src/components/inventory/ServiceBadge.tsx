import { getServiceColor } from '@/lib/inventory/getServiceColor';

type Props = {
  service: string;
  provider?: string;
};

export default function ServiceBadge({
  service,
  provider = 'AWS'
}: Props) {
  const color = getServiceColor(provider, service);

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
      style={{
        backgroundColor: `${color}15`,
        color: color,
        borderColor: `${color}40`,
      }}
    >
      {service}
    </span>
  );
}