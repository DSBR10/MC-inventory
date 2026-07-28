"use client";

import {
  Copy,
  ShieldAlert,
  ShieldCheck,
  Network,
  Server,
  Globe,
  ArrowDown,
  Boxes,
  Activity,
} from "lucide-react";

import { useMemo, useState } from "react";

import { InventoryItem } from "@/types/inventory";

import TagsList from "./TagsList";
import SecurityGroupList from "./SecurityGroupList";

type Props = {
  item: InventoryItem | null;

  allItems: InventoryItem[];

  onNavigate: (item: InventoryItem) => void;

  onClose: () => void;
};

type Tab = "overview" | "network" | "security" | "loadbalancer" | "cluster";

const simpleServices = ["S3", "DynamoDB", "API Gateway", "OBS"];

export default function ResourceModal({
  item,
  allItems,
  onNavigate,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const securityAnalysis = useMemo(() => {
    const findings: string[] = [];

    (item?.securityGroups || []).forEach((sg) => {
      (sg.inboundRules || []).forEach((rule) => {
        const openToWorld = rule.cidr === "0.0.0.0/0";

        const from = rule.fromPort;

        if (openToWorld && from === 22) {
          findings.push("SSH expuesto públicamente");
        }

        if (openToWorld && from === 3389) {
          findings.push("RDP expuesto públicamente");
        }

        if (openToWorld && rule.protocol === "-1") {
          findings.push("ALL traffic permitido");
        }
      });
    });

    return findings;
  }, [item?.securityGroups]);

  if (!item) return null;

  const isSimpleService = simpleServices.includes(item.service);
  const isELB = item.service === "ELB";

  const riskLevel =
    securityAnalysis.length >= 3
      ? "CRITICAL"
      : securityAnalysis.length > 0
        ? "WARNING"
        : "SAFE";

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        bg-black/70
        backdrop-blur-sm
        flex
        items-center
        justify-center
        p-4
      "
    >
      <div
        className="
          bg-[var(--bg-card)]
          border
          border-[var(--border)]
          rounded-2xl
          w-full
          max-w-7xl
          flex
          flex-col
          shadow-2xl
        "
        style={{ maxHeight: "92vh" }}
      >
        {/* HEADER */}

        <div
          className="
            flex-shrink-0
            bg-[var(--bg-card)]/95
            backdrop-blur-xl
            border-b
            border-[var(--border)]
            px-5
            py-4
            rounded-t-2xl
          "
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge value={item.service} />

                <Badge value={item.provider} />

                <Badge value={item.status} />

                <RiskBadge risk={riskLevel} />

                {item.publicIp && <Badge value="PUBLIC" color="orange" />}

                {item.ssmManaged && <Badge value="SSM" color="green" />}
              </div>

              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold truncate">{item.name}</h2>

                  <p
                    className="
                      text-xs
                      text-[var(--text-secondary)]
                      mt-1
                      font-mono
                      break-all
                    "
                  >
                    {item.id}
                  </p>
                </div>

                <CopyButton value={item.id} />
              </div>
            </div>

            <button
              onClick={onClose}
              className="
                px-4
                py-2
                rounded-xl
                bg-red-500/10
                text-red-400
                text-sm
                interactive-button
              "
            >
              Cerrar
            </button>
          </div>

          {/* TABS */}

          <div className="flex gap-2 mt-5 flex-wrap">
            <TabButton
              active={tab === "overview"}
              onClick={() => setTab("overview")}
              icon={<Server size={14} />}
              label="Overview"
            />

            {!isSimpleService && (
              <TabButton
                active={tab === "network"}
                onClick={() => setTab("network")}
                icon={<Network size={14} />}
                label="Network"
              />
            )}

            {!isSimpleService && (
              <TabButton
                active={tab === "security"}
                onClick={() => setTab("security")}
                icon={<ShieldAlert size={14} />}
                label="Security"
              />
            )}

            {!isSimpleService && !isELB && (
              <TabButton
                active={tab === "loadbalancer"}
                onClick={() => setTab("loadbalancer")}
                icon={<Activity size={14} />}
                label="Load Balancing"
              />
            )}

            {(item.children?.length || 0) > 0 && (
              <TabButton
                active={tab === "cluster"}
                onClick={() => setTab("cluster")}
                icon={<Server size={14} />}
                label={`Cluster (${item.children?.length || 0})`}
              />
            )}
          </div>
        </div>

        {/* BODY */}

        <div
          className="
            flex-1
            overflow-y-auto
            p-5
            min-h-0
          "
        >
          {/* EXPOSURE */}

          {!isSimpleService && (
            item.publiclyExposed ? (
              <div
                className="
                  mb-5
                  rounded-2xl
                  border
                  border-red-500/20
                  bg-red-500/10
                  p-4
                  flex
                  items-start
                  gap-4
                "
              >
                <ShieldAlert size={20} className="text-red-400 mt-1" />

                <div>
                  <p
                    className="
                      font-semibold
                      text-red-400
                      mb-1
                      text-sm
                    "
                  >
                    Public Exposure Detected
                  </p>

                  <p
                    className="
                      text-xs
                      text-red-200/80
                    "
                  >
                    Este recurso posee exposición pública o reglas abiertas hacia
                    Internet.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="
                  mb-5
                  rounded-2xl
                  border
                  border-green-500/20
                  bg-green-500/10
                  p-4
                  flex
                  items-start
                  gap-4
                "
              >
                <ShieldCheck size={20} className="text-green-400 mt-1" />

                <div>
                  <p
                    className="
                      font-semibold
                      text-green-400
                      mb-1
                      text-sm
                    "
                  >
                    No Public Exposure
                  </p>

                  <p
                    className="
                      text-xs
                      text-green-200/80
                    "
                  >
                    No se detectó exposición pública.
                  </p>
                </div>
              </div>
            )
          )}

          {/* OVERVIEW */}

          {tab === "overview" && (
            <div className="space-y-6">
              <SectionCard title="Información General">
                {!isSimpleService && (
                  <div className="mb-4">
                    <div
                      className={`
                        inline-flex
                        items-center
                        gap-3
                        px-4
                        py-2
                        rounded-2xl
                        border
                        ${getRiskStyles(item.riskLevel)}
                      `}
                    >
                      <ShieldAlert size={16} />

                      <div>
                        <p className="text-[10px] opacity-70">Risk Level</p>

                        <p className="font-semibold text-sm">
                          {item.riskLevel || "SAFE"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="
                    grid
                    grid-cols-1
                    md:grid-cols-2
                    xl:grid-cols-3
                    gap-3
                  "
                >
                  {getOverviewFields(item).map((f) => (
                    <InfoCard key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Tags">
                <TagsList tags={item.tags} />
              </SectionCard>
            </div>
          )}

          {/* NETWORK */}

          {tab === "network" && (
            <div className="space-y-6">
              {!isELB && (
                <SectionCard title="Topology">
                  <div className="space-y-4">
                    {item.publiclyExposed && (
                      <TopologyNode
                        icon={<Globe size={16} />}
                        label="Internet"
                        type="external"
                      />
                    )}

                    <TopologyNode
                      icon={<Boxes size={16} />}
                      label={`${item.service} · ${item.name}`}
                      type={item.topologyType}
                    />
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Networking">
                <div className="grid md:grid-cols-2 gap-3">
                  {isELB ? (
                    <>
                      <InfoCard label="VPC ID" value={item.vpcId} />
                      <InfoCard label="Public IP" value={item.publicIp} />
                      <InfoCard label="Availability Zones" value={item.availabilityZone} />
                    </>
                  ) : (
                    <>
                      <InfoCard label="Private IP" value={item.privateIp} />

                      <InfoCard label="Public IP" value={item.publicIp} />

                      <InfoCard label="VPC" value={item.vpcId} />

                      <InfoCard label="Subnet" value={item.subnetId} />
                    </>
                  )}
                </div>
              </SectionCard>
            </div>
          )}

          {/* CLUSTER CHILDREN */}

          {tab === "cluster" && item.children && item.children.length > 0 && (
            <div className="space-y-6">
              <SectionCard title={`Recursos del Cluster (${item.children.length})`}>
                <div className="space-y-3">
                  {item.children.map((child) => (
                    <button
                      key={child.uniqueKey || child.id}
                      onClick={() => onNavigate(child)}
                      className="
                        w-full
                        flex
                        items-center
                        gap-4
                        p-4
                        rounded-xl
                        border
                        border-[var(--border)]
                        bg-[var(--bg-hover)]/30
                        hover:bg-[var(--bg-hover)]/60
                        hover:border-[var(--primary)]/30
                        transition-all
                        text-left
                        cursor-pointer
                      "
                    >
                      <Server size={16} className="text-[var(--primary)] flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm truncate">
                            {child.name}
                          </p>
                          <Badge value={child.service} />
                          <Badge value={child.status} />
                        </div>

                        <p className="text-[11px] text-[var(--text-secondary)] font-mono truncate mt-1">
                          {child.id}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-[11px] text-[var(--text-secondary)]">
                          {child.host && <span>Host: {child.host}</span>}
                          {child.instanceType && <span>Type: {child.instanceType}</span>}
                          {child.availabilityZone && <span>AZ: {child.availabilityZone}</span>}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <TagsList tags={child.tags} />
                      </div>
                    </button>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {/* SECURITY */}

          {tab === "security" && (
            <div className="space-y-6">
              <SectionCard title="Risk Analysis">
                <div
                  className={`
                    p-4
                    rounded-2xl
                    border

                    ${
                      riskLevel === "CRITICAL"
                        ? "bg-red-500/10 border-red-500/20"
                        : riskLevel === "WARNING"
                          ? "bg-yellow-500/10 border-yellow-500/20"
                          : "bg-green-500/10 border-green-500/20"
                    }
                  `}
                >
                  <p className="font-bold text-base mb-4">{riskLevel}</p>

                  {securityAnalysis.length === 0 ? (
                    <p className="text-green-400 text-sm">
                      No se encontraron riesgos críticos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {securityAnalysis.map((f, idx) => (
                        <p key={idx} className="text-sm">
                          • {f}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Security Groups">
                <SecurityGroupList groups={item.securityGroups} />
              </SectionCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3
        py-2
        rounded-xl
        flex
        items-center
        gap-2
        text-xs
        border
        transition-all
        interactive-button

        ${
          active
            ? "bg-[var(--primary)] text-[var(--text-primary)] border-[var(--primary)]"
            : "bg-[var(--bg-hover)] border-[var(--border)]"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function Badge({ value, color }: any) {
  return (
    <span
      className={`
        px-2.5
        py-1
        rounded-full
        text-[10px]
        border

        ${
          color === "orange"
            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
            : color === "green"
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20"
        }
      `}
    >
      {value}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span
      className={`
        px-2.5
        py-1
        rounded-full
        text-[10px]
        border

        ${
          risk === "CRITICAL"
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : risk === "WARNING"
              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20"
        }
      `}
    >
      {risk}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value)}
      className="
        p-2
        rounded-xl
        border
        border-[var(--border)]
        hover:bg-[var(--bg-hover)]
        transition-all
        interactive-button
      "
    >
      <Copy size={14} />
    </button>
  );
}

function SectionCard({ title, children }: any) {
  return (
    <div
      className="
        bg-[var(--bg-hover)]/20
        border
        border-[var(--border)]
        rounded-2xl
        p-5
      "
    >
      <h3 className="text-lg font-bold mb-5">{title}</h3>

      {children}
    </div>
  );
}

type FieldDef = { label: string; value: string | undefined | null };

function getOverviewFields(item: InventoryItem): FieldDef[] {
  const base: FieldDef[] = [
    { label: "Provider", value: item.provider },
    { label: "Cuenta", value: item.accountName },
    { label: "Servicio", value: item.service },
    { label: "Estado", value: item.status },
  ];

  const s = item.service;

  if (simpleServices.includes(s)) {
    return [
      ...base,
      { label: "Región", value: item.availabilityZone },
    ];
  }

  if (s === "ELB") {
    return [
      ...base,
      { label: "Host", value: item.host },
      { label: "Tipo", value: item.operatingSystem },
      { label: "AZ", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "Lambda") {
    return [
      ...base,
      { label: "Función", value: item.host },
      { label: "Runtime", value: item.operatingSystem },
      { label: "Memoria", value: item.instanceType },
      { label: "Región", value: item.availabilityZone },
      { label: "Última modificación", value: item.launchTime },
    ];
  }

  if (s === "EKS") {
    return [
      ...base,
      { label: "Endpoint", value: item.host },
      { label: "Versión K8s", value: item.operatingSystem },
      { label: "Región", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "ECS") {
    return [
      ...base,
      { label: "Endpoint", value: item.host },
      { label: "Plataforma", value: item.operatingSystem },
      { label: "Lanzamiento", value: item.instanceType },
      { label: "Región", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "RDS" || s === "Aurora" || s === "DocumentDB" || s === "DDS") {
    return [
      ...base,
      { label: "Host", value: item.host },
      { label: "Motor", value: item.operatingSystem },
      { label: "Instancia", value: item.instanceType },
      { label: "AZ", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "ElastiCache") {
    return [
      ...base,
      { label: "Host", value: item.host },
      { label: "Motor", value: item.operatingSystem },
      { label: "Tipo nodo", value: item.instanceType },
      { label: "AZ", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "CloudFront") {
    return [
      ...base,
      { label: "Dominio", value: item.host },
      { label: "Distribución", value: item.operatingSystem },
      { label: "Región", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "CCE") {
    return [
      ...base,
      { label: "Endpoint", value: item.host },
      { label: "Red", value: item.operatingSystem },
      { label: "Flavor", value: item.instanceType },
      { label: "Región", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "CDN") {
    return [
      ...base,
      { label: "Dominio", value: item.host },
      { label: "Área", value: item.operatingSystem },
      { label: "Región", value: item.availabilityZone },
      { label: "Fecha creación", value: item.launchTime },
    ];
  }

  if (s === "VPC" || s === "Subnet") {
    return [
      ...base,
      { label: "CIDR", value: item.host },
      { label: "Región", value: item.availabilityZone },
    ];
  }

  return [
    ...base,
    { label: "Host", value: item.host },
    { label: "Sistema Operativo", value: item.operatingSystem },
    { label: "Instance Type", value: item.instanceType },
    { label: "AZ", value: item.availabilityZone },
    { label: "Launch Time", value: item.launchTime },
  ];
}

function InfoCard({ label, value }: any) {
  return (
    <div
      className="
        p-4
        rounded-xl
        bg-black/20
        border
        border-[var(--border)]
      "
    >
      <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-2">
        {label}
      </p>

      <p className="text-xs break-all">{value || "N/A"}</p>
    </div>
  );
}

function HealthBadge({ status }: any) {
  return (
    <span
      className={`
        px-2.5
        py-1
        rounded-full
        text-[10px]
        border

        ${
          status === "healthy"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }
      `}
    >
      {status}
    </span>
  );
}

function TopologyNode({
  icon,
  label,
  type,
  clickable,
  onClick,
}: {
  icon: React.ReactNode;

  label: string;

  type?: string;

  clickable?: boolean;

  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`
        w-full
        flex
        items-center
        gap-4
        p-3
        rounded-xl
        border
        text-left
        transition-all

        ${
          clickable
            ? `
              hover:scale-[1.01]
              hover:border-cyan-400
              hover:shadow-lg
              cursor-pointer
            `
            : ""
        }

        ${getTopologyStyles(type)}
      `}
    >
      <div>{icon}</div>

      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
      </div>
    </button>
  );
}

function getTopologyStyles(type?: string) {
  switch (type) {
    case "entrypoint":
      return `
        bg-cyan-500/10
        border-cyan-500/20
        text-cyan-300
      `;

    case "compute":
      return `
        bg-violet-500/10
        border-violet-500/20
        text-violet-300
      `;

    case "network":
      return `
        bg-orange-500/10
        border-orange-500/20
        text-orange-300
      `;

    case "external":
      return `
        bg-red-500/10
        border-red-500/20
        text-red-300
      `;

    default:
      return `
        bg-[var(--bg-hover)]/40
        border-[var(--border)]
      `;
  }
}

function getRiskStyles(level?: string) {
  switch (level) {
    case "CRITICAL":
      return `
        bg-red-500/10
        border-red-500/20
        text-red-400
      `;

    case "HIGH":
      return `
        bg-orange-500/10
        border-orange-500/20
        text-orange-400
      `;

    case "MEDIUM":
      return `
        bg-yellow-500/10
        border-yellow-500/20
        text-yellow-400
      `;

    case "LOW":
      return `
        bg-cyan-500/10
        border-cyan-500/20
        text-cyan-400
      `;

    default:
      return `
        bg-green-500/10
        border-green-500/20
        text-green-400
      `;
  }
}
