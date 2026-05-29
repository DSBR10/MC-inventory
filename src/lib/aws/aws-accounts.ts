import { getAWSAccounts as getConfiguredAWSAccounts } from "@/lib/aws/accounts";

export interface AWSAccount {
  name: string;
  id: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export function getAWSAccounts(): AWSAccount[] {
  return getConfiguredAWSAccounts().map((account) => ({
    name: account.name,
    id: account.id,
    accessKey: account.accessKeyId,
    secretKey: account.secretAccessKey,
    region: account.region,
  }));
}

export function getAWSAccountById(id: string): AWSAccount | undefined {
  return getAWSAccounts().find((acc) => acc.id === id);
}

export function getAWSAccountByNameOrId(nameOrId: string): AWSAccount | undefined {
  return getAWSAccounts().find((acc) => acc.name === nameOrId || acc.id === nameOrId);
}

export function getDefaultAWSAccount(): AWSAccount | undefined {
  return getAWSAccounts()[0];
}
