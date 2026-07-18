# PRAJNA Platform — Module Integration Guide
**For:** Module 21 (Morning Briefing) Developer
**Package:** `@prajna-platform/platform-foundation@1.0.0`
**Prepared by:** Foundation Team (Module 1)

---

## Quick Start — Install the Package

```bash
npm install @prajna-platform/platform-foundation
npm install aws-cdk-lib@^2.175.0 constructs@^10.4.2
```

All imports come from the package root — never from internal paths.

```typescript
import {
  SharedLambda,
  SharedRole,
  SharedBucket,
  ResourceNames,
  ModuleIdentifier,
  PrajnaTags,
  getEnvironmentConfig,
  Stage,
  DynamoDbPolicy,
  EventBridgePolicy,
  SsmPolicy,
} from '@prajna-platform/platform-foundation';
```

---

## Q1 — Documentation & Working Example

The package is self-documented with JSDoc on every export. Below is a complete, working example for a module stack — use this as your Module 21 starting point.

```typescript
// lib/morning-briefing/morning-briefing-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import {
  SharedLambda,
  SharedRole,
  ResourceNames,
  ModuleIdentifier,
  getEnvironmentConfig,
  Stage,
  DynamoDbPolicy,
  EventBridgePolicy,
  SsmPolicy,
} from '@prajna-platform/platform-foundation';

export interface MorningBriefingStackProps extends cdk.StackProps {
  stage: Stage;
}

export class MorningBriefingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MorningBriefingStackProps) {
    super(scope, id, props);

    // 1. Resolve stage config (dev / qa / prod)
    const config = getEnvironmentConfig(props.stage);

    // 2. Create the Lambda handler using the platform standard construct.
    //    Note: entry must point to pre-compiled JS in dist/.
    const briefingHandler = new SharedLambda(this, 'BriefingHandler', {
      config,
      module: ModuleIdentifier.MORNING_BRIEFING,
      identifier: 'generate',
      description: 'Generates the daily morning briefing for faculty',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../dist/src/morning-briefing/generate')
      ),
      handler: 'index.handler',
      environment: {
        // Module-specific env vars go here (see Q4 for secrets)
        BRIEFING_TABLE_NAME: briefingTable.tableName,
      },
    });

    // 3. Add module-specific IAM permissions after construction
    briefingHandler.addToRolePolicy(
      DynamoDbPolicy.readWriteStatements(briefingTable.tableArn)[0]
    );
  }
}
```

**Key points verified from source:**
- `SharedLambda` auto-creates a CloudWatch Log Group, IAM execution role, X-Ray tracing, and ARM64 (Graviton2) runtime.
- It auto-injects `STAGE`, `MODULE`, `FUNCTION_NAME`, and `POWERTOOLS_SERVICE_NAME` as environment variables.
- Platform defaults: **Node.js 20**, **256 MB memory**, **30s timeout**, **ap-south-1** region.

---

## Q2 — What Uses Shared Constructs vs. What Stays Module-Specific

### Always Use Shared Constructs For:

| Resource | Shared Construct | Why |
|---|---|---|
| Lambda functions | `SharedLambda` | Enforces runtime, tracing, naming, log groups |
| IAM roles | `SharedRole` | Enforces naming, tagging, trust policy |
| S3 buckets | `SharedBucket` | Enforces encryption, lifecycle, naming |
| SSM parameters | `SharedParameter` | Enforces path hierarchy and tagging |
| CloudWatch alarms | `SharedAlarm` | Enforces alarm standards and thresholds |
| API Gateway integrations | `SharedApi` | Enforces authorizer and stage settings |
| Log groups | `SharedLogGroup` | Enforces retention and removal policy |

### Keep Module-Specific (do NOT use a shared construct):

| Resource | Reason |
|---|---|
| **DynamoDB tables** | Schema, billing mode, and GSIs are unique to each module — define with `aws_dynamodb.Table` directly |
| **EventBridge rules** | Rule patterns and targets are module-specific — define with `aws_events.Rule` directly |
| **SQS queues** | Queue properties vary by use case — define directly |
| **SNS topics** | Topic subscriptions are module-owned — define directly |
| **Secrets Manager secrets** | Secret content is module-specific — define with `aws_secretsmanager.Secret` directly |

> **Rule of thumb:** Use a shared construct for the *execution fabric* (Lambda, Role, Log Group). Keep *data and messaging resources* module-owned.

---

## Q3 — Adding Module-Specific IAM Permissions

`SharedLambda` auto-creates an execution role with `AWSLambdaBasicExecutionRole` and `AWSXRayDaemonWriteAccess`. You add your module-specific permissions **after** construction using the `addToRolePolicy()` helper or the IAM policy factory classes from the Foundation package.

### DynamoDB Permissions

```typescript
import { DynamoDbPolicy } from '@prajna-platform/platform-foundation';

// Read-only access
briefingHandler.addToRolePolicy(
  DynamoDbPolicy.readStatement(briefingTable.tableArn)
);

// Write-only access
briefingHandler.addToRolePolicy(
  DynamoDbPolicy.writeStatement(briefingTable.tableArn)
);

// Full CRUD (returns array — add both statements)
for (const stmt of DynamoDbPolicy.readWriteStatements(briefingTable.tableArn)) {
  briefingHandler.addToRolePolicy(stmt);
}

// Specific GSI query access
briefingHandler.addToRolePolicy(
  DynamoDbPolicy.queryIndexStatement(briefingTable.tableArn, 'faculty-date-index')
);
```

### EventBridge Permissions

```typescript
import { EventBridgePolicy } from '@prajna-platform/platform-foundation';

// Allow the Lambda to publish events to the platform bus
briefingHandler.addToRolePolicy(
  EventBridgePolicy.putEventsStatement(platformEventBus.eventBusArn)
);
```

### SSM Parameter Store Permissions

```typescript
import { SsmPolicy } from '@prajna-platform/platform-foundation';

// Scoped read access: /prajna/{stage}/briefing/*
briefingHandler.addToRolePolicy(
  SsmPolicy.readStatement(
    config.deploymentTarget.account,
    config.deploymentTarget.region,
    config.stage,
    'briefing',   // your module path
  )
);

// Read cross-module parameters (e.g., auth user pool ID)
briefingHandler.addToRolePolicy(
  SsmPolicy.readStatement(
    config.deploymentTarget.account,
    config.deploymentTarget.region,
    config.stage,
    'auth',       // the module that owns the parameter
  )
);
```

### Secrets Manager Permissions

For Secrets Manager (e.g., Google OAuth credentials), there is no foundation helper yet — use a raw IAM statement:

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const googleOAuthSecret = secretsmanager.Secret.fromSecretNameV2(
  this, 'GoogleOAuthSecret', `prajna/${config.stage}/briefing/google-oauth`
);

briefingHandler.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'ReadGoogleOAuthSecret',
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [googleOAuthSecret.secretArn],
  })
);
```

---

## Q4 — Module-Specific Environment Variables and Secrets

### Environment Variables (non-sensitive config)

Pass them in the `environment` prop of `SharedLambda`. They merge on top of the platform-injected variables:

```typescript
const briefingHandler = new SharedLambda(this, 'BriefingHandler', {
  config,
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'generate',
  description: 'Generates the daily morning briefing',
  code: lambda.Code.fromAsset('dist/src/morning-briefing/generate'),
  environment: {
    BRIEFING_TABLE_NAME: briefingTable.tableName,
    EVENT_BUS_NAME:      platformEventBus.eventBusName,
    SEND_HOUR_UTC:       '2',   // 7:30 AM IST = 02:00 UTC
  },
});
```

**Platform variables already injected automatically (do not re-add):**
- `STAGE` — `dev` / `qa` / `prod`
- `MODULE` — `briefing`
- `FUNCTION_NAME` — `generate`
- `POWERTOOLS_SERVICE_NAME` — `briefing-generate`

### Secrets (sensitive values — Google OAuth, API keys)

**Do NOT put secret values as environment variables.** The platform standard is **AWS Secrets Manager**, fetched at runtime inside the Lambda handler:

```typescript
// At CDK synth time — pass only the secret NAME, not the value
briefingHandler.addEnvironment(
  'GOOGLE_OAUTH_SECRET_NAME',
  `prajna/${config.stage}/briefing/google-oauth`
);

// Then grant read access
googleOAuthSecret.grantRead(briefingHandler.function);
```

Inside your Lambda handler (Node.js):

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

export const handler = async () => {
  const secret = await client.send(new GetSecretValueCommand({
    SecretId: process.env.GOOGLE_OAUTH_SECRET_NAME!,
  }));
  const { clientId, clientSecret } = JSON.parse(secret.SecretString!);
  // use credentials...
};
```

---

## Q5 — Standard Module Project Structure

All PRAJNA modules follow this folder layout. Module 21 should match it exactly:

```
lib/morning-briefing/
├── morning-briefing-stack.ts   ← Main CDK stack (entry point for bin/)
├── api.ts                      ← API Gateway routes & integrations
├── lambda.ts                   ← All SharedLambda definitions
├── iam.ts                      ← All IAM policy statement composition
└── outputs.ts                  ← CfnOutput + SSM parameter exports

src/morning-briefing/
├── generate/
│   └── index.ts                ← Lambda handler — compiled to dist/
└── shared/
    └── types.ts                ← Types shared across handlers

test/morning-briefing/
└── morning-briefing-stack.test.ts   ← CDK assertion tests (Jest)

dist/src/morning-briefing/      ← Compiled JS — deployed to Lambda
```

### CDK Stack Entry Pattern

```typescript
// bin/prajna.ts
import * as cdk from 'aws-cdk-lib';
import { getEnvironmentConfig, Stage } from '@prajna-platform/platform-foundation';
import { MorningBriefingStack } from '../lib/morning-briefing/morning-briefing-stack';

const app = new cdk.App();
const stage = (app.node.tryGetContext('stage') ?? Stage.DEVELOPMENT) as Stage;
const config = getEnvironmentConfig(stage);

new MorningBriefingStack(app, `Prajna-${config.stage}-MorningBriefing`, {
  env: {
    account: config.deploymentTarget.account,
    region:  config.deploymentTarget.region,
  },
  stage,
});
```

### Registering SSM Outputs

Any cross-module SSM parameter your module publishes must use `SharedParameter`:

```typescript
import { SharedParameter } from '@prajna-platform/platform-foundation';
import * as ssm from 'aws-cdk-lib/aws-ssm';

new SharedParameter(this, 'BriefingTableNameParam', {
  config,
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'briefing-table-name',
  value: briefingTable.tableName,
  type: ssm.ParameterType.STRING,
  description: 'Morning Briefing DynamoDB table name',
});
// Publishes to: /prajna/{stage}/briefing/briefing-table-name
```

---

## Summary Reference Card

| Question | Answer |
|---|---|
| **Install** | `npm install @prajna-platform/platform-foundation` |
| **Module ID for M21** | `ModuleIdentifier.MORNING_BRIEFING` → `'briefing'` |
| **Lambda entry format** | Pre-compiled JS: `lambda.Code.fromAsset('dist/src/morning-briefing/...')` |
| **Default runtime** | Node.js 20 (ARM64 Graviton2) |
| **Default region** | `ap-south-1` |
| **DynamoDB table** | Module-specific — create with `aws_dynamodb.Table`, grant access via `DynamoDbPolicy` |
| **EventBridge** | Module-specific — create rule with `aws_events.Rule`, grant via `EventBridgePolicy` |
| **IAM permissions** | Use `DynamoDbPolicy`, `EventBridgePolicy`, `SsmPolicy` factory classes |
| **Secrets** | Store in Secrets Manager, fetch at Lambda runtime, never in env vars |
| **SSM params** | Use `SharedParameter` construct; path: `/prajna/{stage}/briefing/{key}` |

If you have further questions, reach out to the Foundation team (Module 1 — Balaji).
