export default function MonitoringCharts() {
  return (
    <div
      className="
        rounded-3xl
        border
        border-[var(--border)]
        bg-[var(--bg-card)]/60
        p-6
        min-h-[400px]
      "
    >
      <h2 className="text-xl font-semibold mb-4">
        Métricas de infraestructura
      </h2>

      <div
        className="
          h-[300px]
          flex
          items-center
          justify-center
          text-gray-500
        "
      >
        Aquí irán los gráficos CloudWatch y Huawei CES
      </div>
    </div>
  );
}
