# @prajna-platform/platform-foundation

The official shared infrastructure library for the PRAJNA — AI Powered Faculty Companion Platform. This package provides the complete set of reusable AWS CDK constructs, environment configuration, naming conventions, IAM policy helpers, monitoring utilities, and platform constants that every PRAJNA module builds on. All platform teams are required to consume this package rather than creating platform primitives independently, ensuring naming consistency, tagging compliance, and infrastructure standards across all 30+ deployed modules.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Package Structure](#package-structure)
- [Versioning](#versioning)
- [Development](#development)
- [Publishing](#publishing)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Category | What Is Included |
|---|---|
| **Shared CDK Constructs** | `SharedLambda`, `SharedRole`, `SharedBucket`, `SharedApi`, `SharedLogGroup`, `SharedParameter`, `SharedAlarm` |
| **Resource Naming** | `ResourceNames` — deterministic, platform-standard name generators for every AWS service |
| **Module Identifiers** | `ModuleIdentifier` enum — canonical IDs for all 30+ platform modules |
| **Environment Config** | `getEnvironmentConfig`, `Stage`, `PrajnaEnvironmentConfig` — typed, exhaustive config per stage |
| **SSM Parameter Paths** | `SsmPaths`, `FoundationParameters`, `AuthParameters`, `ApiParameters` — predictable cross-module discovery paths |
| **Platform Tags** | `PrajnaTags` — enforces the mandatory tagging taxonomy across all AWS resources |
| **IAM Policy Helpers** | `LambdaPolicy`, `S3Policy`, `DynamoDbPolicy`, `SsmPolicy`, `EventBridgePolicy` |
| **Monitoring Utilities** | `PrajnaMetric`, `PrajnaDashboard`, `XRayConfig`, `AlarmFactory` |
| **Validation & Utils** | `NamingHelper`, `Validators`, `EnvironmentLoader` |
| **Common Constants** | `DEFAULT_LAMBDA_RUNTIME`, `DEFAULT_LAMBDA_MEMORY`, `DEFAULT_LOG_RETENTION`, and 20+ others |

---

## Architecture

`@prajna-platform/platform-foundation` is the base layer of the PRAJNA platform dependency graph. Every module in the platform — from the Auth layer (M3) and API Gateway (M4) to the Approval Engine (M13), Notification Service (M16), and APAR module (M18) — imports from this package to remain compliant with platform standards.

```
                        ┌──────────────────────────────────────────┐
                        │   @prajna-platform/platform-foundation   │
                        │                                          │
                        │  Constructs · Config · Names             │
                        │  Tags · Utils · IAM · Monitor            │
                        └───────────────┬──────────────────────────┘
                                        │ peerDep
          ┌─────────────────────────────┼────────────────────────┐
          │                             │                        │
   ┌──────▼──────┐              ┌───────▼───────┐        ┌──────▼──────┐
   │  M3 — Auth  │              │  M4 — API GW  │        │  M6 — Stor  │
   └─────────────┘              └───────────────┘        └─────────────┘
          │                             │                        │
          └─────────────────────────────▼────────────────────────┘
                                        │
                        ┌───────────────▼──────────────────┐
                        │   M13–M18 — Business Logic Layer  │
                        │  Approval · Reports · Notif · AI  │
                        └──────────────────────────────────┘
```

All modules rely on a single, versioned copy of this library. When a platform standard changes (runtime version, tagging taxonomy, naming convention), the change is made here once and propagates through a version bump consumed by each dependent module.

---

## Installation

This package is published to the `@prajna-platform` organization on the npm registry. Ensure you are logged in before installing.

```bash
# Authenticate to npm
npm login

# Install the package
npm install @prajna-platform/platform-foundation
```

Add the registry scope to your project's `.npmrc` if using a private or proxied registry:

```
@prajna-platform:registry=https://registry.npmjs.org/
```

This package requires the following peer dependencies:

```bash
npm install aws-cdk-lib@^2.175.0 constructs@^10.4.2
```

> **Note:** `aws-cdk-lib` and `constructs` are declared as `peerDependencies`. They must already be present in your consuming module's `package.json`.

---

## Basic Usage

All public APIs are exported from the package root. Do **not** import from internal paths such as `@prajna-platform/platform-foundation/dist/lib/foundation/constructs/shared-lambda`.

### Shared Lambda Construct

The most widely used construct in the platform. Wraps `aws_lambda.Function` with Node.js 20 (ARM64 Graviton2), AWS X-Ray tracing, structured logging, and platform-compliant IAM role pre-applied.

```typescript
import { SharedLambda, ModuleIdentifier, getEnvironmentConfig, Stage } from '@prajna-platform/platform-foundation';
import * as path from 'path';

const config = getEnvironmentConfig(Stage.DEVELOPMENT);

const handler = new SharedLambda(this, 'Handler', {
  config,
  module: ModuleIdentifier.AUTH,
  identifier: 'authorizer',
  description: 'JWT token authorizer for API Gateway',
  entry: path.join(__dirname, '../../src/auth/authorizer/index.ts'),
  handler: 'handler',
  environment: {
    USER_POOL_ID: userPool.userPoolId,
  },
});

// Access the underlying Lambda function:
handler.function.addPermission('ApiGatewayInvoke', { ... });
```

### Shared IAM Role Construct

Enforces platform IAM standards — consistent naming, automatic tagging, and managed policy attachment.

```typescript
import { SharedRole, ModuleIdentifier, getEnvironmentConfig, Stage } from '@prajna-platform/platform-foundation';
import * as iam from 'aws-cdk-lib/aws-iam';

const config = getEnvironmentConfig(Stage.DEVELOPMENT);

const executionRole = new SharedRole(this, 'LambdaExecRole', {
  config,
  module: ModuleIdentifier.AUTH,
  identifier: 'lambda-execution',
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  description: 'Execution role for Auth module Lambda functions',
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
  ],
});
```

### Shared S3 Bucket Construct

Creates S3 buckets with platform-compliant naming, versioning, lifecycle policies, and encryption pre-configured.

```typescript
import { SharedBucket, ModuleIdentifier, getEnvironmentConfig, Stage } from '@prajna-platform/platform-foundation';

const config = getEnvironmentConfig(Stage.DEVELOPMENT);

const documentsBucket = new SharedBucket(this, 'DocumentsBucket', {
  config,
  module: ModuleIdentifier.STORAGE,
  identifier: 'documents',
  versioned: true,
  lifecycleRules: [
    { expirationDays: 365, id: 'archive-old-documents' },
  ],
});
```

### Resource Naming

Generates deterministic, platform-standard AWS resource names and SSM parameter paths.

```typescript
import { ResourceNames, ModuleIdentifier, Stage } from '@prajna-platform/platform-foundation';

// → "prajna-dev-auth-fn-authorizer"
const lambdaName = ResourceNames.lambdaFunction(Stage.DEVELOPMENT, ModuleIdentifier.AUTH, 'authorizer');

// → "prajna-prod-storage-s3-documents-123456789012"
const bucketName = ResourceNames.s3Bucket(Stage.PRODUCTION, ModuleIdentifier.STORAGE, 'documents', accountId);

// → "/prajna/dev/auth/user-pool-id"
const ssmPath = ResourceNames.ssmParameter(Stage.DEVELOPMENT, ModuleIdentifier.AUTH, 'user-pool-id');
```

### Environment Configuration

Resolves the complete, typed configuration for a deployment stage. The exhaustive switch-statement in `getEnvironmentConfig` guarantees compile-time safety — adding a new stage without a config file is a TypeScript error.

```typescript
import { getEnvironmentConfig, Stage, PrajnaEnvironmentConfig } from '@prajna-platform/platform-foundation';

const config: PrajnaEnvironmentConfig = getEnvironmentConfig(Stage.PRODUCTION);

console.log(config.deploymentTarget.account); // "123456789012"
console.log(config.deploymentTarget.region);  // "ap-south-1"
console.log(config.lambda.memorySize);        // 256
```

### Platform Tags

Applies the mandatory PRAJNA tagging taxonomy to any CDK construct tree.

```typescript
import { PrajnaTags, ModuleIdentifier, Stage } from '@prajna-platform/platform-foundation';
import { App } from 'aws-cdk-lib';

const app = new App();

PrajnaTags.apply(app, {
  module: ModuleIdentifier.AUTH,
  stage: Stage.PRODUCTION,
  owner: 'platform-team',
});
```

---

## Package Structure

The published package exposes the following module tree, all accessible via the package root import:

```
@prajna-platform/platform-foundation
└── dist/lib/foundation/
    ├── index.js / index.d.ts          ← Root barrel (start here)
    │
    ├── constructs/                    ← Shared CDK L2 constructs
    │   ├── shared-lambda              ← Lambda with platform defaults
    │   ├── shared-role                ← IAM Role with platform standards
    │   ├── shared-bucket              ← S3 Bucket with compliance settings
    │   ├── shared-api                 ← API Gateway wrapper
    │   ├── shared-log-group           ← CloudWatch Log Group
    │   ├── shared-parameter           ← SSM Parameter Store helper
    │   └── shared-alarm               ← CloudWatch Alarm with thresholds
    │
    ├── config/                        ← Environment-specific configuration
    │   ├── environment.ts             ← Stage enum + config interfaces
    │   ├── dev.ts                     ← DEVELOPMENT stage config
    │   ├── qa.ts                      ← QA stage config
    │   └── prod.ts                    ← PRODUCTION stage config
    │
    ├── constants/                     ← Platform-wide constants
    │   ├── naming.ts                  ← ModuleIdentifier + ServicePrefix enums
    │   ├── resource-names.ts          ← ResourceNames class
    │   ├── ssm-parameters.ts          ← Cross-module SSM discovery paths
    │   └── defaults.ts                ← Platform-wide runtime defaults
    │
    ├── iam/                           ← IAM policy factory helpers
    │   ├── lambda-policy.ts
    │   ├── s3-policy.ts
    │   ├── dynamodb-policy.ts
    │   ├── ssm-policy.ts
    │   └── eventbridge-policy.ts
    │
    ├── monitoring/                    ← CloudWatch + X-Ray utilities
    │   ├── cloudwatch.ts              ← PrajnaMetric + PrajnaDashboard
    │   ├── alarms.ts                  ← AlarmFactory
    │   └── xray.ts                    ← XRayConfig
    │
    ├── tags/                          ← Resource tagging taxonomy
    │   └── tags.ts                    ← PrajnaTags + TagKey enum
    │
    └── utils/                         ← General utilities
        ├── naming-helper.ts           ← NamingHelper + sanitizeIdentifier
        ├── validation.ts              ← Validators + guard functions
        └── environment-loader.ts      ← EnvironmentLoader + resolveStage
```

---

## Versioning

This package follows [Semantic Versioning (SemVer)](https://semver.org/) — `MAJOR.MINOR.PATCH`.

| Increment | When to use |
|---|---|
| **Major** (`2.0.0`) | Breaking changes to public API — removed exports, renamed constructs, changed required props, altered SSM path conventions |
| **Minor** (`1.1.0`) | New constructs, new exports, or non-breaking additions to existing construct props. Backward compatible. |
| **Patch** (`1.0.1`) | Bug fixes, documentation updates, internal refactors with no API surface change |

> All consuming modules must pin to a compatible version range (e.g. `^1.0.0`). Major version bumps require coordinated upgrades across all dependent modules.

---

## Development

Clone the [PRAJNA platform repository](https://github.com/GoondlaBalaji/prajna-paltform) and follow these steps:

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run build

# 3. Run the test suite
npm test

# 4. Run tests with coverage
npm run test:coverage

# 5. Watch mode (incremental compilation)
npm run watch

# 6. Preview the package contents without publishing
npm pack --dry-run
```

The compiled output is placed in the `dist/` directory. The `dist/lib/foundation/` subtree is what is included in the published tarball.

---

## Publishing

Publishing is managed exclusively by the **Foundation module maintainers** (Module 1 owners). Consumer teams should not publish this package directly.

The publishing workflow is:

1. Merge all approved changes into the `main` branch.
2. Bump the version in `package.json` following the SemVer rules above.
3. Run `npm run build` to compile a clean build.
4. Run `npm pack --dry-run` to verify the tarball contents.
5. Run `npm publish --access public` targeting the `@prajna-platform` organization on npm.
6. Notify all dependent module teams of the new version via the team communication channel.

> Packages are published under the `@prajna-platform` npm organization scope.

---

## Contributing

All contributions to this package must be reviewed by the Foundation team (Module 1 owners) before merging.

**Guidelines:**

- **Keep constructs reusable.** A construct belongs in this package only if it is consumed by two or more modules. Module-specific logic should remain in its own module stack.
- **Avoid business logic.** This package is an infrastructure primitives library. It should contain no domain concepts (approvals, notifications, faculty data, etc.).
- **Maintain backward compatibility.** Prefer additive changes. If a breaking change is unavoidable, increment the major version and notify all dependent teams before merging.
- **Document public APIs before merging.** Every exported class, function, enum, and interface must have a JSDoc block covering its purpose, parameters, return values, and a minimal usage example.
- **Test before opening a PR.** All constructs must have unit tests using `aws-cdk-lib/assertions`. The test suite must pass with `npm test` before review is requested.

---

## License

**Internal Use Only.**

This package is proprietary software owned by the PRAJNA project. It is intended exclusively for authorized contributors working within the PRAJNA platform development team. Redistribution, publication, or use outside the authorized project context is strictly prohibited.
