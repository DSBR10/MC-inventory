export type SecurityGroupRule = {

  protocol?: string;

  fromPort?: number;

  toPort?: number;

  cidr?: string;

  direction?: "inbound" | "outbound";

};

export type SecurityGroup = {

  id: string;

  name: string;

  inboundRules?: SecurityGroupRule[];

  outboundRules?: SecurityGroupRule[];

};

export type Listener = {

  name?: string;

  protocol?: string;

  port?: number;

  arn?: string;

};

export type TargetInstance = {

  id?: string;

  port?: number;

  health?: string;

};

export type TargetGroup = {

  name?: string;

  protocol?: string;

  port?: number;

  targetType?: string;

  targets?: TargetInstance[];

};

export type Relationship = {

  type: string;

  targetId: string;

  targetName?: string;

  targetService?: string;

};

export type RiskLevel =

  | "SAFE"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type InventoryItem = {

  uniqueKey?: string;

  provider?: string;

  accountName: string;

  accountId: string;

  service: string;

  resourceType?: string;

  name: string;

  id: string;

  host: string;

  status: string;

  operatingSystem?: string;

  tags?: Record<string, string>;

  securityGroups?: SecurityGroup[];

  listeners?: Listener[];

  targetGroups?: TargetGroup[];

  privateIp?: string;

  publicIp?: string;

  vpcId?: string;

  subnetId?: string;

  platform?: string;

  architecture?: string;

  instanceType?: string;

  availabilityZone?: string;

  launchTime?: string;

  imageId?: string;

  ssmManaged?: boolean;

  internetFacing?: boolean;

  raw?: any;

  relationships?: Relationship[];

  riskLevel?: RiskLevel;

  publiclyExposed?: boolean;

  topologyType?: string;

  children?: InventoryItem[];

  clusterId?: string;

  clusterName?: string;

  parentId?: string;

  parentName?: string;

  dnsName?: string;

  ports?: number[];

  engine?: string;

  engineVersion?: string;

  encrypted?: boolean;

  backupEnabled?: boolean;

  multiAz?: boolean;

  storageType?: string;

  cidr?: string;

  environment?: string;

  owner?: string;

  project?: string;

  criticality?: string;

};