import { resolveSecret } from "@/lib/secrets/crypto";

export type HuaweiAccount = {
  name: string;
  projectId: string;
  ak: string;
  sk: string;
  region: string;
};

// ─────────────────────────────────────────────
// Obtener cuentas dinámicamente desde .env
// ─────────────────────────────────────────────

export function getHuaweiAccounts(): HuaweiAccount[] {

  const accounts: HuaweiAccount[] = [];

  let index = 1;

  while (true) {

    const name =
      process.env[`HUAWEI_ACCOUNT_${index}_NAME`];

    const projectId =
      process.env[`HUAWEI_ACCOUNT_${index}_PROJECT_ID`];

    const ak = resolveSecret(
      process.env[`HUAWEI_ACCOUNT_${index}_AK`],
    );

    const sk = resolveSecret(
      process.env[`HUAWEI_ACCOUNT_${index}_SK`],
    );

    const region =
      process.env[`HUAWEI_ACCOUNT_${index}_REGION`] || 'la-south-2';

    if (
      !name ||
      !projectId ||
      !ak ||
      !sk
    ) {
      break;
    }

    accounts.push({
      name,
      projectId,
      ak,
      sk,
      region
    });

    index++;

  }

  return accounts;

}

// ─────────────────────────────────────────────
// Helper map
// ─────────────────────────────────────────────

export const HUAWEI_ACCOUNT_MAP: Record<string, string> =

  getHuaweiAccounts().reduce(

    (acc, account) => {

      acc[account.projectId] =
        account.name;

      return acc;

    },

    {} as Record<string, string>

  );