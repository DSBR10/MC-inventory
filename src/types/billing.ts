export type BillingTagMap = {
  Cliente?: string;
  Proyecto?: string;
  Environment?: string;
  Owner?: string;
  CostCenter?: string;
  Application?: string;
  [key: string]: string | undefined;
};

export type BillingItem = {
  provider: string;
  accountName: string;
  accountId: string;
  service: string;
  region?: string;
  resourceId?: string;
  resourceName?: string;
  usageType?: string;
  usageQuantity?: number;
  cost: number;
  currency: string;
  month: string;
  tags?: BillingTagMap;
};

export type BillingFilters = {
  start?: string;
  end?: string;
  provider?: string;
  service?: string;
  account?: string;
  tagKey?: string;
  tagValue?: string;
  groupBy?: "SERVICE" | "ACCOUNT" | "PROVIDER" | "TAG";
  providers?: string[];
  accounts?: string[];
  services?: string[];
  regions?: string[];
  tags?: Record<string, string[]>;
  startDate?: string;
  endDate?: string;
  minCost?: number;
  maxCost?: number;
};

export type BillingGroupedData = {
  name: string;
  value: number;
};

export type BillingTrendPoint = {
  date: string;
  cost: number;
};

export type BillingSummary = {
  totalCost: number;
  awsCost: number;
  huaweiCost: number;
  topService: string;
  topAccount: string;
  topProject: string;
};
