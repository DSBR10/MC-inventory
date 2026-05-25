import { BillingItem } from "@/types/billing";

export default function BillingCards({ billing }: { billing: BillingItem[] }) {
  const total = billing.reduce(
    (acc, item) => acc + item.cost,

    0,
  );

  const awsTotal = billing

    .filter((item) => item.provider === "AWS")

    .reduce(
      (acc, item) => acc + item.cost,

      0,
    );

  const huaweiTotal = billing

    .filter((item) => item.provider === "HUAWEI CLOUD")

    .reduce(
      (acc, item) => acc + item.cost,

      0,
    );

  const cards = [
    {
      title: "Costo total",
      value: `$${total.toFixed(2)}`,
    },

    {
      title: "AWS",
      value: `$${awsTotal.toFixed(2)}`,
    },

    {
      title: "Huawei",
      value: `$${huaweiTotal.toFixed(2)}`,
    },

    {
      title: "Items billing",
      value: billing.length,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="
            rounded-3xl
            border
            border-[var(--border)]
            bg-[var(--bg-card)]/60
            p-6
          "
        >
          <p className="text-sm text-[var(--text-secondary)]">{card.title}</p>

          <h2 className="text-3xl font-bold mt-3">{card.value}</h2>
        </div>
      ))}
    </div>
  );
}
