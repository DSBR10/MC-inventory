export interface AWSAccount {
  name: string;
  id: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

/**
 * Lee todas las cuentas de AWS configuradas en las variables de entorno
 */
export function getAWSAccounts(): AWSAccount[] {
  const accounts: AWSAccount[] = [];
  const region = process.env.AWS_REGION || "us-east-1";

  // Leer todas las cuentas AWS del .env
  let i = 1;
  while (process.env[`AWS_ACCOUNT_${i}_NAME`]) {
    const account: AWSAccount = {
      name: process.env[`AWS_ACCOUNT_${i}_NAME`] || `Account ${i}`,
      id: process.env[`AWS_ACCOUNT_${i}_ID`] || "",
      accessKey: process.env[`AWS_ACCOUNT_${i}_ACCESS_KEY`] || "",
      secretKey: process.env[`AWS_ACCOUNT_${i}_SECRET_KEY`] || "",
      region: region,
    };

    if (account.accessKey && account.secretKey) {
      accounts.push(account);
    }

    i++;
  }

  return accounts;
}

/**
 * Obtiene una cuenta de AWS específica por ID
 */
export function getAWSAccountById(id: string): AWSAccount | undefined {
  const accounts = getAWSAccounts();
  return accounts.find((acc) => acc.id === id);
}

/**
 * Obtiene una cuenta de AWS específica por nombre o ID
 */
export function getAWSAccountByNameOrId(
  nameOrId: string,
): AWSAccount | undefined {
  const accounts = getAWSAccounts();
  return accounts.find((acc) => acc.name === nameOrId || acc.id === nameOrId);
}

/**
 * Obtiene la primera cuenta de AWS disponible (por defecto)
 */
export function getDefaultAWSAccount(): AWSAccount | undefined {
  const accounts = getAWSAccounts();
  return accounts.length > 0 ? accounts[0] : undefined;
}
