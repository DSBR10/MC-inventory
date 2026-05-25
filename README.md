# MC Inventory

MC Inventory is a SaaS platform designed to centralize and automate cloud infrastructure inventory management in hybrid and multicloud environments (AWS & Huawei Cloud).

## 🚀 Features

### Inventory Management

- Real-time AWS & Huawei Cloud inventory sync
- EC2 / ECS instance detection
- RDS / DocumentDB database detection
- ECS / CCE cluster detection
- CloudFront / CDN distribution detection
- Lambda functions inventory
- S3 / OBS buckets inventory
- DynamoDB / DDS tables inventory
- ElastiCache / DCS cache clusters
- API Gateway inventory
- Automatic refresh with caching
- Modern dashboard UI
- Status visualization (Running / Stopped)

### Monitoring & Logs

- Real-time log aggregation from CloudWatch (AWS) and LTS (Huawei)
- Advanced log filtering (by provider, account, severity, time range)
- Metrics dashboard (total logs, errors, warnings, info)
- Log search functionality
- Multi-account and multi-region support

### Billing & Cost Management

- AWS Cost Explorer integration
- Huawei Cloud billing integration
- Monthly cost breakdown by service
- Cost trends and forecasting
- Multi-account cost aggregation

## 🛠 Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, TailwindCSS
- **Backend:** Next.js API Routes, Server-side rendering
- **Cloud SDKs:** AWS SDK v3, Huawei Cloud SDK
- **Authentication:** NextAuth.js
- **Caching:** File-based caching system
- **Charts:** Recharts

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm
- AWS Account(s) with appropriate IAM permissions
- Huawei Cloud Account(s) with AK/SK credentials
- Environment variables configured (see `.env.example`)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd mc-inventory
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

**Required variables:**

#### AWS Accounts

```env
AWS_ACCOUNT_1_NAME=MC Inventory
AWS_ACCOUNT_1_ACCESS_KEY_ID=your_aws_access_key
AWS_ACCOUNT_1_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_ACCOUNT_1_REGION=us-east-1
```

#### Huawei Cloud Accounts

```env
HUAWEI_ACCOUNT_1_NAME=mc_inventory
HUAWEI_ACCOUNT_1_PROJECT_ID=your_project_id
HUAWEI_ACCOUNT_1_AK=your_access_key
HUAWEI_ACCOUNT_1_SK=your_secret_key
HUAWEI_ACCOUNT_1_REGION=la-north-2
```

**Note:** You can add multiple accounts by incrementing the index (1, 2, 3, etc.)

#### NextAuth Configuration

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
ALLOWED_USERS=user1@example.com,user2@example.com
```

### 4. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
mc-inventory/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── inventory/    # Inventory API
│   │   │   ├── billing/      # Billing API
│   │   │   └── logs/         # Logs & Monitoring API
│   │   ├── billing/          # Billing page
│   │   ├── monitoreo/        # Monitoring page
│   │   └── page.tsx          # Home/Dashboard page
│   ├── components/            # React components
│   │   ├── monitoring/       # Monitoring components
│   │   └── ...               # Other components
│   ├── lib/                   # Library code
│   │   ├── aws/              # AWS SDK integrations
│   │   └── huawei/           # Huawei Cloud SDK integrations
│   └── types/                 # TypeScript type definitions
├── data/                      # Cache files (gitignored)
├── .env.local            # Environment variables (gitignored)
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🔐 Security

- AWS and Huawei Cloud credentials are managed locally using environment variables
- Never commit `.env.local` to version control
- Use IAM roles with least privilege principle
- Implement proper authentication with NextAuth.js

## 🔧 IAM Permissions Required

### AWS IAM Permissions

Your AWS IAM user needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "ecs:Describe*",
        "ecs:List*",
        "lambda:List*",
        "lambda:GetFunction",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "dynamodb:ListTables",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeTimeToLive",
        "elasticache:Describe*",
        "elasticache:ListTagsForResource",
        "apigateway:GET",
        "cloudfront:List*",
        "cloudfront:GetDistribution",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "ce:GetCostAndUsage"
      ],
      "Resource": "*"
    }
  ]
}
```

### Huawei Cloud Permissions

Your Huawei Cloud IAM user needs permissions for:

- ECS (Elastic Cloud Server)
- CCE (Cloud Container Engine)
- RDS (Relational Database Service)
- DDS (Document Database Service)
- OBS (Object Storage Service)
- LTS (Log Tank Service)
- BSS (Billing)

## 🐛 Troubleshooting

### Error: `lts.undefined.myhuaweicloud.com`

**Cause:** Missing `HUAWEI_ACCOUNT_X_REGION` in `.env.local`

**Solution:** Add the region to your Huawei account configuration:

```env
HUAWEI_ACCOUNT_1_REGION=la-north-2  # Mexico City, Mexico
```

Available Huawei Cloud regions:

- `la-north-2` - Mexico City, Mexico (Latin America)
- `la-south-2` - Santiago, Chile (Latin America)
- `ap-southeast-1` - Bangkok, Thailand
- `ap-southeast-2` - Singapore
- `ap-southeast-3` - Hong Kong
- `cn-north-1` - Beijing, China
- `cn-east-2` - Shanghai, China
- `cn-south-1` - Guangzhou, China

### Error: `ThrottlingException: Rate exceeded`

**Cause:** Too many API calls to AWS services

**Solution:** The application implements automatic retry with exponential backoff. If the error persists, increase the `CACHE_TTL` value in `.env.local`.

### Error: `InvalidParameterValue: Unrecognized engine name`

**Cause:** Trying to filter DocumentDB with invalid engine names

**Solution:** This has been fixed in the latest version. Make sure you're using the updated code.

### Error: `TypeError: tags is not iterable`

**Cause:** Some AWS services return tags as objects instead of arrays

**Solution:** This has been fixed in the latest version. The `formatAwsTags` function now handles both arrays and objects.

## 📝 License

MIT License

## 👥 Contributors

Developed by the MC Inventory team.
