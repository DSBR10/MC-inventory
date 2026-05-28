/**
 * Obtiene el color personalizado para cada servicio de AWS y Huawei Cloud
 * Cada servicio tiene un color único para facilitar su identificación visual
 */

type ServiceColors = {
  [key: string]: string;
};

const AWS_COLORS: ServiceColors = {
  // Compute & Containers
  EC2: "#FF9900",
  ECS: "#FF9900",
  EKS: "#FF9900",
  Lambda: "#FF9900",

  // Storage
  S3: "#569A31",
  EBS: "#C925D1",

  // Database
  RDS: "#527FFF",
  DynamoDB: "#4053D6",
  DocumentDB: "#527FFF",
  ElastiCache: "#C925D1",

  // Networking
  VPC: "#7AA116",
  Subnet: "#7AA116",
  ELB: "#8C4FFF",
  NLB: "#8C4FFF",
  ALB: "#8C4FFF",
  CLB: "#8C4FFF",
  "Internet Gateway": "#7AA116",
  "NAT Gateway": "#4B612C",
  "Transit Gateway": "#C925D1",
  "VPC Peering": "#7AA116",
  "Elastic IP": "#146EB4",
  "Network Interface": "#8C4FFF",
  "Route Table": "#545B64",

  // Security
  "Security Group": "#DD344C",
  IAM: "#DD344C",
  WAF: "#DD344C",

  // Content Delivery & API
  CloudFront: "#8C4FFF",
  "API Gateway": "#FF4F8B",
  Route53: "#8C4FFF",

  // Monitoring & Messaging
  CloudWatch: "#FF6F91",
  SNS: "#FF4F8B",
  SQS: "#FF4F8B",

  // Load Balancer Components
  "Target Group": "#FF9900",
};

const HUAWEI_COLORS: ServiceColors = {
  // Compute
  ECS: "#0E74BC",
  CCE: "#06B6D4",
  "CCE Node": "#47A1AD",

  // Storage
  OBS: "#569A31",
  EVS: "#C925D1",

  // Database
  RDS: "#527FFF",
  DDS: "#47A1AD",

  // Networking
  VPC: "#7AA116",
  Subnet: "#7AA116",
  ELB: "#8C4FFF",
  "NAT Gateway": "#4B612C",
  "VPC Peering": "#7AA116",
  "Security Group": "#DD344C",

  // Content Delivery
  CDN: "#8C4FFF",
};

/**
 * Obtiene el color para un servicio específico
 * @param provider - Proveedor del servicio (AWS o HUAWEI CLOUD)
 * @param service - Nombre del servicio
 * @returns Color hexadecimal del servicio o color por defecto
 */
export function getServiceColor(provider: string, service: string): string {
  const normalizedProvider = provider.toUpperCase();
  const normalizedService = service.trim();

  if (normalizedProvider === "AWS") {
    return AWS_COLORS[normalizedService] || "#232F3E"; // AWS dark gray como default
  }

  if (normalizedProvider === "HUAWEI CLOUD") {
    return HUAWEI_COLORS[normalizedService] || "#E60012"; // Huawei red como default
  }

  return "#64748b"; // Gray como fallback
}

/**
 * Obtiene todos los colores disponibles para un proveedor
 * @param provider - Proveedor del servicio
 * @returns Objeto con los colores de todos los servicios
 */
export function getAllServiceColors(provider: string): ServiceColors {
  const normalizedProvider = provider.toUpperCase();

  if (normalizedProvider === "AWS") {
    return AWS_COLORS;
  }

  if (normalizedProvider === "HUAWEI CLOUD") {
    return HUAWEI_COLORS;
  }

  return {};
}

/**
 * Verifica si un servicio tiene un color personalizado
 * @param provider - Proveedor del servicio
 * @param service - Nombre del servicio
 * @returns true si el servicio tiene color personalizado
 */
export function hasCustomColor(provider: string, service: string): boolean {
  const normalizedProvider = provider.toUpperCase();
  const normalizedService = service.trim();

  if (normalizedProvider === "AWS") {
    return normalizedService in AWS_COLORS;
  }

  if (normalizedProvider === "HUAWEI CLOUD") {
    return normalizedService in HUAWEI_COLORS;
  }

  return false;
}
