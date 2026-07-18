# Foundation Integration Guide for Module 21 (Morning Briefing)

**Package:** `@prajna-platform/platform-foundation@1.0.0`
**Prepared by:** Foundation Team — Module 1 (Balaji)
**Audience:** Module 21 — Morning Briefing development team
**Last Updated:** 2026-07-18

> This document is the single source of truth for integrating with the PRAJNA Foundation package. Every statement is verified against the current `v1.0.0` implementation. Features that are not yet implemented are explicitly marked.

---

## Table of Contents

1. [Foundation Package Overview](#1-foundation-package-overview)
2. [ModuleIdentifier](#2-moduleidentifier)
3. [SharedLambda](#3-sharedlambda)
4. [SharedRole & IAM Permissions](#4-sharedrole--iam-permissions)
5. [Environment Variables](#5-environment-variables)
6. [Secrets Management](#6-secrets-management)
7. [ResourceNames](#7-resourcenames)
8. [Recommended Project Structure](#8-recommended-project-structure)
9. [Foundation Package Versioning](#9-foundation-package-versioning)
10. [Best Practices for Module 21](#10-best-practices-for-module-21)

---

## 1. Foundation Package Overview

### Question

What is the purpose of each of the following exports, and how do they work together in a typical module stack?

- `SharedLambda`
- `SharedRole`
- `ResourceNames`
- `ModuleIdentifier`
- `PrajnaTags`
- `getEnvironmentConfig()`

### Answer

Each export serves a distinct but complementary role. Together they form the complete infrastructure contract that all 30+ PRAJNA modules must follow.

### Current Foundation Implementation

| Export | Type | Purpose |
|---|---|---|
| `SharedLambda` | CDK Construct | Creates a Lambda function with all platform standards pre-applied (runtime, tracing, log group, naming, role, tags) |
| `SharedRole` | CDK Construct | Creates an IAM Role with consistent naming, tagging, and trust policy |
| `ResourceNames` | Static Class | Generates deterministic, platform-standard AWS resource names and SSM paths |
| `ModuleIdentifier` | Enum | Canonical string IDs for every module — used in resource names, SSM paths, and tags |
| `PrajnaTags` | Static Class | Applies the 8 mandatory tags (`Application`, `Project`, `Environment`, `Module`, `Owner`, `ManagedBy`, `CostCenter`, `Version`) to any CDK construct |
| `getEnvironmentConfig()` | Function | Resolves the complete `PrajnaEnvironmentConfig` for a given `Stage` |

**Tagging behaviour (verified):**
- `SharedLambda` and `SharedRole` both call `PrajnaTags.applyToStack()` internally. **The module does not need to tag individual Lambda or Role resources.**
- The module must call `PrajnaTags.applyToApp()` once in `bin/prajna.ts` and `PrajnaTags.applyToStack()` once in its stack constructor.

**`getEnvironmentConfig()` call pattern (verified):**
- Call it **once at the stack level**, store the result as `config`, and pass it down to every construct via props.

### Recommendation for Module 21

Call `getEnvironmentConfig()` in the stack constructor and propagate the `config` object. Never call it inside individual construct files.

### Example — Complete Module 21 CDK Stack

```typescript
// bin/prajna.ts
import * as cdk from 'aws-cdk-lib';
import {
  getEnvironmentConfig,
  Stage,
  PrajnaTags,
} from '@prajna-platform/platform-foundation';
import { MorningBriefingStack } from '../lib/morning-briefing/morning-briefing-stack';

const app = new cdk.App();
const stage = (app.node.tryGetContext('stage') ?? Stage.DEVELOPMENT) as Stage;

// Apply platform-wide tags to the entire app (one call covers all stacks)
PrajnaTags.applyToApp(app, stage);

const config = getEnvironmentConfig(stage);

new MorningBriefingStack(app, ResourceNames.stackName(stage, ModuleIdentifier.MORNING_BRIEFING), {
  env: {
    account: config.deploymentTarget.account,
    region:  config.deploymentTarget.region,
  },
  config,
});

app.synth();
```

```typescript
// lib/morning-briefing/morning-briefing-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import {
  SharedLambda,
  ResourceNames,
  ModuleIdentifier,
  PrajnaTags,
  DynamoDbPolicy,
  EventBridgePolicy,
  SsmPolicy,
  PrajnaEnvironmentConfig,
} from '@prajna-platform/platform-foundation';

interface MorningBriefingStackProps extends cdk.StackProps {
  config: PrajnaEnvironmentConfig;
}

export class MorningBriefingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MorningBriefingStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Apply module-level tags (adds "Module: briefing" on top of app tags)
    PrajnaTags.applyToStack(this, config.stage, ModuleIdentifier.MORNING_BRIEFING);

    // --- DynamoDB Table (module-specific, not a shared construct) ---
    const briefingTable = new dynamodb.Table(this, 'BriefingTable', {
      tableName: ResourceNames.dynamoDbTable(
        config.stage,
        ModuleIdentifier.MORNING_BRIEFING,
        'briefing',
      ), // → "prajna-dev-briefing-table-briefing"
      partitionKey: { name: 'facultyId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: config.dynamoDb.pointInTimeRecovery,
      removalPolicy: config.dynamoDb.removalPolicy,
    });

    // --- Lambda (uses SharedLambda — platform standard) ---
    const generateHandler = new SharedLambda(this, 'GenerateHandler', {
      config,
      module: ModuleIdentifier.MORNING_BRIEFING,
      identifier: 'generate',
      description: 'Generates the daily morning briefing for faculty',
      code: lambda.Code.fromAsset('dist/src/morning-briefing/generate'),
      handler: 'index.handler',
      environment: {
        BRIEFING_TABLE_NAME:      briefingTable.tableName,
        GOOGLE_OAUTH_SECRET_NAME: `prajna/${config.stage}/briefing/google-oauth`,
      },
      policyStatements: [
        ...DynamoDbPolicy.readWriteStatements(briefingTable.tableArn),
        SsmPolicy.readStatement(
          config.deploymentTarget.account,
          config.deploymentTarget.region,
          config.stage,
          'briefing',
        ),
      ],
    });
  }
}
```

---

## 2. ModuleIdentifier

### Question

Which `ModuleIdentifier` should Module 21 use? Is it already defined? If not, how should a new one be created?

### Answer

### Current Foundation Implementation

`ModuleIdentifier.MORNING_BRIEFING` **is already defined** in `v1.0.0` at `lib/foundation/constants/naming.ts`:

```typescript
/** Module 21 (AI Morning Briefing). */
MORNING_BRIEFING = 'briefing',
```

The string value `'briefing'` is the canonical identifier used in:
- Resource names: `prajna-{stage}-briefing-fn-generate`
- SSM paths: `/prajna/{stage}/briefing/{key}`
- CloudWatch log groups: `/prajna/{stage}/briefing/fn/generate`
- IAM role names: `prajna-{stage}-briefing-role-generate-exec`
- All resource tags (`Module: briefing`)

### Naming Convention (verified from source)

| Component | Convention | Example |
|---|---|---|
| Enum key | `SCREAMING_SNAKE_CASE` | `MORNING_BRIEFING` |
| String value | `lowercase-kebab-case`, kept short | `'briefing'` |
| Resource names | `prajna-{stage}-{value}-{service}-{id}` | `prajna-dev-briefing-fn-generate` |
| SSM paths | `/{app}/{stage}/{value}/{key}` | `/prajna/dev/briefing/table-name` |

### Recommendation for Module 21

Use `ModuleIdentifier.MORNING_BRIEFING` everywhere. Never hardcode the string `'briefing'`.

### Example

```typescript
import { ModuleIdentifier } from '@prajna-platform/platform-foundation';

// Correct
module: ModuleIdentifier.MORNING_BRIEFING

// Incorrect — do not hardcode
module: 'briefing'
```

---

## 3. SharedLambda

### Question

When using `SharedLambda`, what does Foundation configure automatically? What must the module developer still provide?

### Answer

### Current Foundation Implementation — Automatic Configurations

The following are applied automatically on every `SharedLambda` (verified from source):

| Configuration | Value | Overridable? |
|---|---|---|
| **Runtime** | `Node.js 20.x` | ❌ No |
| **Architecture** | `ARM_64` (Graviton2) | ❌ No |
| **Tracing** | Active X-Ray (if `config.lambda.tracingEnabled`) | Via config |
| **Log Group** | `SharedLogGroup` with environment-appropriate retention | Via `createLogGroup: false` |
| **IAM Role** | `SharedRole.forLambda()` with `AWSLambdaBasicExecutionRole` + `AWSXRayDaemonWriteAccess` | Via `existingRole` |
| **Memory** | From `config.lambda.memorySize` | Via `memorySize` prop |
| **Timeout** | From `config.lambda.timeoutSeconds` | Via `timeoutSeconds` prop |
| **Reserved Concurrency** | From `config.lambda.reservedConcurrency` | Via `reservedConcurrency` prop |
| **Function Name** | `ResourceNames.lambdaFunction(stage, module, identifier)` | ❌ No |
| **Platform Tags** | All 8 mandatory tags | ❌ No |
| **Lambda Insights** | Enabled if `config.lambda.insightsEnabled` | Via config |

**Environment variables injected automatically (do NOT re-add these):**

| Variable | Value |
|---|---|
| `STAGE` | `'dev'` / `'qa'` / `'prod'` |
| `MODULE` | `'briefing'` |
| `FUNCTION_NAME` | `'generate'` |
| `POWERTOOLS_SERVICE_NAME` | `'briefing-generate'` |

### Required Configurations (must be provided by module)

| Prop | Required | Description |
|---|---|---|
| `config` | ✅ Yes | The `PrajnaEnvironmentConfig` resolved from `getEnvironmentConfig()` |
| `module` | ✅ Yes | The `ModuleIdentifier` enum value |
| `identifier` | ✅ Yes | Short unique name for this function (e.g., `'generate'`) |
| `description` | ✅ Yes | Human-readable description |
| `code` **or** `entry` | ✅ One required | Pre-compiled JS asset path or directory path |
| `handler` | Optional | Defaults to `'index.handler'` |
| `environment` | Optional | Module-specific env vars (merged on top of platform vars) |
| `policyStatements` | Optional | Module-specific IAM statements added to auto-created role |

> **Important:** `SharedLambda` uses `lambda.Code.fromAsset()` — it executes pre-compiled JavaScript. Passing a `.ts` file path as `entry` will throw an error at synth time. Always compile to `dist/` first.

**Additional capabilities (verified from source):**

| Feature | How to use |
|---|---|
| Lambda Layers | `layers: [myLayer]` prop |
| Dead Letter Queue | `deadLetterQueue: myDlq` prop |
| Event Sources | `events: [new SqsEventSource(queue)]` prop, or `handler.addEventSource()` after construction |
| Per-function memory override | `memorySize: 512` prop |
| Per-function timeout override | `timeoutSeconds: 60` prop |
| Use existing IAM role | `existingRole: myRole.role` prop |

### Recommendation for Module 21

All Morning Briefing Lambda functions must be created with `SharedLambda`. Never use `aws_lambda.Function` or `aws_lambda_nodejs.NodejsFunction` directly.

### Example

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
  SharedLambda,
  ModuleIdentifier,
  DynamoDbPolicy,
} from '@prajna-platform/platform-foundation';

const generateHandler = new SharedLambda(this, 'GenerateHandler', {
  config,                                          // resolved from getEnvironmentConfig()
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'generate',
  description: 'Generates the daily AI morning briefing',
  code: lambda.Code.fromAsset('dist/src/morning-briefing/generate'),
  handler: 'index.handler',                        // optional — this is the default
  memorySize: 512,                                 // override config default
  timeoutSeconds: 60,                              // override config default
  environment: {
    BRIEFING_TABLE_NAME: briefingTable.tableName,
  },
  policyStatements: [
    ...DynamoDbPolicy.readWriteStatements(briefingTable.tableArn),
  ],
});

// Post-construction additions
generateHandler.addToRolePolicy(EventBridgePolicy.putEventsStatement(bus.eventBusArn));
generateHandler.addEventSource(new events_sources.SqsEventSource(queue));
```

---

## 4. SharedRole & IAM Permissions

### Question

How should module-specific IAM permissions be attached for DynamoDB, EventBridge, CloudWatch, Secrets Manager, S3, and SSM Parameter Store?

### Answer

### Current Foundation Implementation

The Foundation package provides ready-made IAM policy factory classes for the most common services:

| Class | Services | Key Methods |
|---|---|---|
| `DynamoDbPolicy` | DynamoDB | `readStatement()`, `writeStatement()`, `readWriteStatements()`, `queryIndexStatement()`, `streamReadStatement()`, `transactionStatements()` |
| `EventBridgePolicy` | EventBridge | `putEventsStatement()`, `manageRulesStatement()` |
| `SsmPolicy` | SSM Parameter Store | `readStatement()`, `writeStatement()`, `readAllPlatformStatement()` |
| `S3Policy` | S3 | `readStatement()`, `writeStatement()`, `readWriteStatements()` |
| `LambdaPolicy` | Lambda invocation | Available in package |

> **Secrets Manager:** No `SecretsManagerPolicy` helper is currently implemented. Use a raw `iam.PolicyStatement` (see example below).

**Recommended IAM attachment pattern:** Pass `policyStatements` in the `SharedLambda` props for permissions that are always needed, then call `addToRolePolicy()` after construction for conditional or post-deployment additions. Both approaches are equivalent.

`SharedRole.forLambda()` is the factory method used **internally by `SharedLambda`**. It automatically attaches `AWSLambdaBasicExecutionRole` + `AWSXRayDaemonWriteAccess`. Modules should only use `SharedRole` directly when they need a role for a resource other than a Lambda (e.g., an ECS task, a Step Functions state machine, or a standalone API Gateway role).

### Recommendation for Module 21

Prefer the `policyStatements` prop in `SharedLambda` for clarity. Use `addToRolePolicy()` for permissions that depend on resources created after the Lambda.

### Example — All Services

```typescript
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import {
  DynamoDbPolicy,
  EventBridgePolicy,
  SsmPolicy,
  S3Policy,
} from '@prajna-platform/platform-foundation';

// ── DynamoDB ──────────────────────────────────────────────────────────────────
// Full CRUD on the briefing table
policyStatements: [
  ...DynamoDbPolicy.readWriteStatements(briefingTable.tableArn),
]

// Query a specific GSI
handler.addToRolePolicy(
  DynamoDbPolicy.queryIndexStatement(briefingTable.tableArn, 'faculty-date-index')
);

// ── EventBridge ───────────────────────────────────────────────────────────────
handler.addToRolePolicy(
  EventBridgePolicy.putEventsStatement(platformEventBus.eventBusArn)
);

// ── SSM Parameter Store ───────────────────────────────────────────────────────
// Read own module parameters: /prajna/{stage}/briefing/*
handler.addToRolePolicy(
  SsmPolicy.readStatement(
    config.deploymentTarget.account,
    config.deploymentTarget.region,
    config.stage,
    'briefing',
  )
);

// Read cross-module parameters (e.g., auth user pool ID)
handler.addToRolePolicy(
  SsmPolicy.readStatement(
    config.deploymentTarget.account,
    config.deploymentTarget.region,
    config.stage,
    'auth',
  )
);

// ── S3 ────────────────────────────────────────────────────────────────────────
handler.addToRolePolicy(
  S3Policy.readStatement(documentsBucket.bucketArn)
);

// ── Secrets Manager (no helper — use raw statement) ───────────────────────────
const googleOAuthSecret = secretsmanager.Secret.fromSecretNameV2(
  this, 'GoogleOAuthSecret', `prajna/${config.stage}/briefing/google-oauth`
);

handler.addToRolePolicy(
  new iam.PolicyStatement({
    sid: 'ReadGoogleOAuthSecret',
    effect: iam.Effect.ALLOW,
    actions: ['secretsmanager:GetSecretValue'],
    resources: [googleOAuthSecret.secretArn],
  })
);
// Alternatively, use the CDK grant helper:
googleOAuthSecret.grantRead(handler.function);
```

---

## 5. Environment Variables

### Question

Where should module-specific environment variables be defined? How does `getEnvironmentConfig()` help?

### Answer

### Current Foundation Implementation

`PrajnaEnvironmentConfig` exposes the following per-stage values that modules can use directly (verified from `qa.ts` and `environment.ts`):

```typescript
config.stage                          // 'dev' | 'qa' | 'prod'
config.deploymentTarget.account       // AWS account ID
config.deploymentTarget.region        // 'ap-south-1'
config.lambda.memorySize              // 256 (dev) | 512 (qa) | 512 (prod)
config.lambda.timeoutSeconds          // 30
config.lambda.tracingEnabled          // true / false
config.lambda.insightsEnabled         // true / false
config.dynamoDb.pointInTimeRecovery   // true / false
config.dynamoDb.removalPolicy         // DESTROY / RETAIN
config.monitoring.logRetention        // RetentionDays enum value
config.monitoring.alarmsEnabled       // true / false
config.s3.versioned                   // true / false
```

### Recommendation for Module 21

| Variable Category | Where to Configure |
|---|---|
| CDK resource attributes (`tableName`, `eventBusName`, `bucketName`) | Pass directly in `environment` prop — resolved at synth time |
| Stage-specific config values (`account`, `region`, `memorySize`) | Read from `config.*` — do not hardcode |
| External API base URLs | Store in SSM Parameter Store; read at Lambda runtime using `GetParameterCommand` |
| Feature flags (rarely changing) | Hardcode per stage in a config constant, or use SSM |
| Cron expressions, schedule strings | Hardcode per stage in the stack or a constants file |

**Naming convention:** Environment variable keys must be `SCREAMING_SNAKE_CASE`. No module prefix is required because the `MODULE` variable already identifies the source.

### Example

```typescript
const generateHandler = new SharedLambda(this, 'GenerateHandler', {
  config,
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'generate',
  description: 'Generates the daily morning briefing',
  code: lambda.Code.fromAsset('dist/src/morning-briefing/generate'),
  environment: {
    // ✅ From CDK resource attributes (synth-time resolution)
    BRIEFING_TABLE_NAME:  briefingTable.tableName,
    EVENT_BUS_NAME:       platformEventBus.eventBusName,

    // ✅ Secret name only — never the secret value
    GOOGLE_OAUTH_SECRET_NAME: `prajna/${config.stage}/briefing/google-oauth`,

    // ✅ Hardcoded per-feature config
    ENABLE_AI_SUMMARY:    config.stage === Stage.PRODUCTION ? 'true' : 'false',
    SEND_HOUR_UTC:        '2',  // 7:30 AM IST = 02:00 UTC

    // ❌ Never do this — do not hardcode account IDs or secret values
    // AWS_ACCOUNT: '123456789012',
    // GOOGLE_CLIENT_SECRET: 'abc123...',
  },
});
```

---

## 6. Secrets Management

### Question

Should sensitive credentials be stored in AWS Secrets Manager? Does Foundation provide helpers for secret injection?

### Answer

### Current Foundation Implementation

> **No `SharedSecret` construct or `SecretsManagerPolicy` helper is currently implemented** in `@prajna-platform/platform-foundation@1.0.0`.

Secrets management follows the AWS best-practice pattern using the native CDK `aws_secretsmanager.Secret` construct and the AWS SDK in Lambda handlers.

### Recommendation for Module 21

**Never store secret values in environment variables, CDK code, or version control.** The standard pattern:

1. Create the secret in Secrets Manager with the platform naming convention.
2. Pass only the secret **name** (not its value) as an environment variable.
3. Grant the Lambda read access via CDK.
4. Fetch the secret at Lambda startup using the AWS SDK.

**Naming convention for secrets:** `prajna/{stage}/{module}/{secret-name}`
- Example: `prajna/dev/briefing/google-oauth`

**Who creates the secret:** The CDK stack creates the secret resource (shell only — no value). The actual secret value is populated manually via the AWS Console, AWS CLI, or a secure pipeline step after first deployment.

### Example — CDK Stack

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// Create secret resource in CDK (value populated manually out-of-band)
const googleOAuthSecret = new secretsmanager.Secret(this, 'GoogleOAuthSecret', {
  secretName: `prajna/${config.stage}/briefing/google-oauth`,
  description: 'Google OAuth credentials for Morning Briefing',
});

const generateHandler = new SharedLambda(this, 'GenerateHandler', {
  config,
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'generate',
  description: 'Generates the daily morning briefing',
  code: lambda.Code.fromAsset('dist/src/morning-briefing/generate'),
  environment: {
    GOOGLE_OAUTH_SECRET_NAME: googleOAuthSecret.secretName,
  },
});

// Grant Lambda read access
googleOAuthSecret.grantRead(generateHandler.function);
```

### Example — Lambda Handler

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const smClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

// Cache outside the handler to reuse across warm invocations
let cachedSecret: { clientId: string; clientSecret: string } | null = null;

async function getGoogleCredentials() {
  if (cachedSecret) return cachedSecret;

  const response = await smClient.send(new GetSecretValueCommand({
    SecretId: process.env.GOOGLE_OAUTH_SECRET_NAME!,
  }));

  cachedSecret = JSON.parse(response.SecretString!);
  return cachedSecret;
}

export const handler = async (event: unknown) => {
  const { clientId, clientSecret } = await getGoogleCredentials();
  // ... use credentials
};
```

---

## 7. ResourceNames

### Question

Should every resource created by Module 21 use `ResourceNames`? What services are supported?

### Answer

### Current Foundation Implementation

`ResourceNames` is a static utility class. Every method produces a deterministic name following the pattern `prajna-{stage}-{module}-{servicePrefix}-{identifier}`.

**All methods currently implemented (verified from source):**

| Method | Service | Output Pattern | Example |
|---|---|---|---|
| `lambdaFunction()` | Lambda | `prajna-{s}-{m}-fn-{id}` | `prajna-dev-briefing-fn-generate` |
| `lambdaLayer()` | Lambda Layer | `prajna-{s}-{m}-layer-{id}` | `prajna-dev-briefing-layer-utils` |
| `s3Bucket()` | S3 | `prajna-{s}-{m}-s3-{id}-{account}` | `prajna-dev-briefing-s3-assets-123456789012` |
| `dynamoDbTable()` | DynamoDB | `prajna-{s}-{m}-table-{id}` | `prajna-dev-briefing-table-briefing` |
| `apiGateway()` | API Gateway | `prajna-{s}-{m}-api-{id}` | `prajna-dev-briefing-api-main` |
| `iamRole()` | IAM Role | `prajna-{s}-{m}-role-{id}` | `prajna-dev-briefing-role-exec` |
| `iamPolicy()` | IAM Policy | `prajna-{s}-{m}-policy-{id}` | `prajna-dev-briefing-policy-dynamo` |
| `logGroup()` | CloudWatch Logs | `/prajna/{s}/{m}/fn/{id}` | `/prajna/dev/briefing/fn/generate` |
| `alarm()` | CloudWatch Alarms | `prajna-{s}-{m}-alarm-{id}` | `prajna-dev-briefing-alarm-errors` |
| `dashboard()` | CloudWatch Dashboards | `prajna-{s}-{m}-dashboard-{id}` | `prajna-dev-briefing-dashboard-main` |
| `eventBus()` | EventBridge Bus | `prajna-{s}-{m}-bus-{id}` | `prajna-dev-briefing-bus-platform` |
| `eventRule()` | EventBridge Rule | `prajna-{s}-{m}-rule-{id}` | `prajna-dev-briefing-rule-cron` |
| `ssmParameter()` | SSM Parameter | `/prajna/{s}/{m}/{id}` | `/prajna/dev/briefing/table-name` |
| `cognitoUserPool()` | Cognito User Pool | `prajna-{s}-{m}-userpool-{id}` | `prajna-dev-auth-userpool-faculty` |
| `cognitoClient()` | Cognito Client | `prajna-{s}-{m}-client-{id}` | `prajna-dev-auth-client-web` |
| `sqsQueue()` | SQS | `prajna-{s}-{m}-queue-{id}` | `prajna-dev-briefing-queue-jobs` |
| `snsTopic()` | SNS | `prajna-{s}-{m}-topic-{id}` | `prajna-dev-briefing-topic-alerts` |
| `stackName()` | CloudFormation Stack | `Prajna-{Stage}-{Module}` | `Prajna-Dev-Briefing` |
| `cloudWatchNamespace()` | CloudWatch Metrics | `Prajna/{Module}` | `Prajna/Briefing` |

> **Note:** `SharedLambda`, `SharedRole`, `SharedBucket`, `SharedLogGroup`, and `SharedParameter` call `ResourceNames` internally. You do not need to call `ResourceNames` manually for those constructs.

### Recommendation for Module 21

Use `ResourceNames` for **every** module-owned resource — DynamoDB tables, EventBridge rules, SQS queues, SNS topics, and any resource that does not have a Shared Construct wrapper.

### Example

```typescript
import {
  ResourceNames,
  ModuleIdentifier,
} from '@prajna-platform/platform-foundation';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as sqs from 'aws-cdk-lib/aws-sqs';

// DynamoDB Table
const briefingTable = new dynamodb.Table(this, 'BriefingTable', {
  tableName: ResourceNames.dynamoDbTable(
    config.stage, ModuleIdentifier.MORNING_BRIEFING, 'briefing'
  ), // → "prajna-dev-briefing-table-briefing"
  partitionKey: { name: 'facultyId', type: dynamodb.AttributeType.STRING },
});

// EventBridge Rule (cron)
const cronRule = new events.Rule(this, 'BriefingCron', {
  ruleName: ResourceNames.eventRule(
    config.stage, ModuleIdentifier.MORNING_BRIEFING, 'daily-briefing'
  ), // → "prajna-dev-briefing-rule-daily-briefing"
  schedule: events.Schedule.cron({ minute: '0', hour: '2' }),
});

// SQS Queue
const jobQueue = new sqs.Queue(this, 'JobQueue', {
  queueName: ResourceNames.sqsQueue(
    config.stage, ModuleIdentifier.MORNING_BRIEFING, 'jobs'
  ), // → "prajna-dev-briefing-queue-jobs"
});
```

---

## 8. Recommended Project Structure

### Question

What repository structure should Module 21 follow?

### Answer

### Current Foundation Implementation

The Foundation package itself (`lib/foundation/`) uses the following layout, which all modules are expected to mirror:

```
lib/{module}/          ← CDK infrastructure code
src/{module}/          ← Lambda handler source code
test/{module}/         ← Infrastructure and unit tests
dist/                  ← Compiled output (gitignored)
```

### Recommendation for Module 21

```
module-21-morning-briefing/
│
├── bin/
│   └── prajna.ts                      ← CDK App entry point
│
├── lib/
│   └── morning-briefing/
│       ├── morning-briefing-stack.ts  ← Main CDK stack
│       ├── database.ts                ← DynamoDB table definitions
│       ├── lambda.ts                  ← All SharedLambda definitions
│       ├── iam.ts                     ← IAM policy composition helpers
│       ├── events.ts                  ← EventBridge rules and buses
│       └── outputs.ts                 ← CfnOutputs + SharedParameter exports
│
├── src/
│   └── morning-briefing/
│       ├── generate/
│       │   └── index.ts               ← Lambda: generate briefing
│       ├── deliver/
│       │   └── index.ts               ← Lambda: deliver briefing via SES/SNS
│       ├── services/
│       │   ├── briefing.service.ts    ← Business logic
│       │   └── google.service.ts      ← Google API connector
│       ├── repositories/
│       │   └── briefing.repo.ts       ← DynamoDB data access layer
│       ├── models/
│       │   └── briefing.types.ts      ← TypeScript interfaces and types
│       ├── events/
│       │   └── briefing.events.ts     ← EventBridge event schemas
│       └── utils/
│           └── date.ts                ← Shared utilities
│
├── test/
│   ├── morning-briefing-stack.test.ts ← CDK assertion tests
│   └── services/
│       └── briefing.service.test.ts   ← Unit tests
│
├── dist/                              ← Compiled JS (gitignored — Lambda source)
│
├── .npmrc                             ← @prajna-platform registry scope
├── cdk.json                           ← CDK context (stage, account)
├── package.json
├── tsconfig.json
└── .gitignore
```

**Key structural rules:**

1. **One subdirectory per Lambda handler** inside `src/{module}/`. `lambda.Code.fromAsset()` points to `dist/src/morning-briefing/generate/` — compiling to a flat directory makes handler isolation impossible.
2. **CDK code in `lib/`**, not `cdk/`. The `lib/` convention is used by all existing modules.
3. **Mandatory `.npmrc`** to resolve the `@prajna-platform` scope:

```
# .npmrc
@prajna-platform:registry=https://registry.npmjs.org/
```

4. **Mandatory `cdk.json`** with at minimum:

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/prajna.ts",
  "context": {
    "stage": "dev"
  }
}
```

---

## 9. Foundation Package Versioning

### Question

How are Foundation upgrades managed? What is the versioning strategy?

### Answer

### Current Foundation Implementation

The Foundation package follows **Semantic Versioning (SemVer)** strictly:

| Increment | When Used | Action Required by Consuming Module |
|---|---|---|
| **Patch** `1.0.x` | Bug fixes, JSDoc corrections, internal refactors — zero API surface change | `npm install` — no code changes |
| **Minor** `1.x.0` | New exports, new optional props on existing constructs — backward compatible | `npm install` — no code changes; optionally adopt new features |
| **Major** `x.0.0` | Removed exports, renamed constructs, required prop changes, SSM path changes | Coordinated upgrade required — migration guide provided |

### Recommendation for Module 21

**Use a compatible range in `package.json`, not an exact pin:**

```json
{
  "dependencies": {
    "@prajna-platform/platform-foundation": "^1.0.0"
  }
}
```

`^1.0.0` accepts all `1.x.x` releases (minor and patch) but blocks `2.0.0`. This gives you automatic bug fixes and new features without accidental breaking changes.

**Breaking change communication protocol:**

1. Major version PRs are announced in the team communication channel **at least one sprint before merging**.
2. A `CHANGELOG.md` entry is required for every release documenting added, changed, deprecated, and removed APIs.
3. The Foundation team maintains a **minimum two-sprint support window** for the previous major version after a new major is published.
4. Migration guides are provided as files in `docs/migration/` in the Foundation repository.

---

## 10. Best Practices for Module 21

The following rules apply to all PRAJNA modules. Module 21 must follow these from day one.

| # | Practice | Why |
|---|---|---|
| 1 | **Always use `SharedLambda`** | Guarantees runtime, tracing, naming, and log group standards are applied |
| 2 | **Always use `SharedRole` for non-Lambda roles** | Ensures IAM naming, tagging, and trust policies are consistent |
| 3 | **Always use `ResourceNames.*` for every resource name** | Prevents naming collisions and enables cross-module SSM discovery |
| 4 | **Use `ModuleIdentifier.MORNING_BRIEFING` consistently** | The enum value flows into resource names, SSM paths, tags, and log groups |
| 5 | **Call `PrajnaTags.applyToApp()` once in `bin/prajna.ts`** | Guarantees all resources inherit the 8 mandatory tags |
| 6 | **Call `PrajnaTags.applyToStack()` in every stack constructor** | Adds the `Module` tag scoped to the owning module |
| 7 | **Resolve `getEnvironmentConfig()` once at the stack level** | Avoids duplicating stage resolution logic across constructs |
| 8 | **Never hardcode stage names, account IDs, or region strings** | These must come from `config.*` — see `PrajnaEnvironmentConfig` |
| 9 | **Never store secrets in environment variables or CDK code** | Store in Secrets Manager; inject only the secret name as an env var |
| 10 | **Compile Lambda handlers to individual `dist/` subdirectories** | Enables `lambda.Code.fromAsset('dist/src/morning-briefing/generate')` |
| 11 | **Use `DynamoDbPolicy`, `EventBridgePolicy`, `SsmPolicy` helpers** | These generate least-privilege, platform-standard IAM statements |
| 12 | **Use `SharedParameter` for any cross-module SSM outputs** | Ensures SSM path follows `/prajna/{stage}/{module}/{key}` hierarchy |
| 13 | **Pin Foundation to `"^1.0.0"` in `package.json`** | Receives patches and minor additions without accidental breaking upgrades |
| 14 | **Write CDK assertion tests for every stack** | Use `aws-cdk-lib/assertions` to verify resource counts, properties, and outputs |
| 15 | **Request Foundation additions via PR, not workarounds** | If a helper or construct is missing, raise a PR to Foundation — do not reinvent the wheel in the module |

---

*This document is maintained by the Foundation team. For questions, corrections, or feature requests, open an issue in the PRAJNA platform repository.*
