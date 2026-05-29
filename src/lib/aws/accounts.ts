export type AWSAccount = {

  name: string;

  id: string;

  accessKeyId: string;

  secretAccessKey: string;

  region: string;

};

export function getAWSAccounts(): AWSAccount[] {

  const accounts: AWSAccount[] = [];

  let i = 1;

  while (process.env[`AWS_ACCOUNT_${i}_NAME`] || process.env[`AWS_ACCOUNT_${i}_ACCESS_KEY`] || process.env[`AWS_ACCOUNT_${i}_ACCESS_KEY_ID`]) {
    const accessKeyId =
      process.env[`AWS_ACCOUNT_${i}_ACCESS_KEY_ID`] ||
      process.env[`AWS_ACCOUNT_${i}_ACCESS_KEY`];

    const secretAccessKey =
      process.env[`AWS_ACCOUNT_${i}_SECRET_ACCESS_KEY`] ||
      process.env[`AWS_ACCOUNT_${i}_SECRET_KEY`];

    if (!accessKeyId || !secretAccessKey) {
      i++;
      continue;
    }

    accounts.push({

      name:
        process.env[`AWS_ACCOUNT_${i}_NAME`] || "N/A",

      id:
        process.env[`AWS_ACCOUNT_${i}_ID`] || "N/A",

      accessKeyId:
        accessKeyId,

      secretAccessKey:
        secretAccessKey,

      region:
        process.env[`AWS_ACCOUNT_${i}_REGION`] ||
        process.env.AWS_REGION ||
        "us-east-1"

    });

    i++;

  }

  return accounts;

}
