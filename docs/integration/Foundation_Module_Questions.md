# Foundation Questions for Module 21 (Morning Briefing)

**From:** Module 21 — Morning Briefing Team
**To:** Module 1 — Foundation Team (Balaji)
**Date:** 2026-07-18
**Package Under Review:** `@prajna-platform/platform-foundation@1.0.0`

---

## Introduction

The Morning Briefing module (Module 21) is beginning active development. Before writing any CDK infrastructure or Lambda code, the team wants to ensure complete alignment with Foundation standards.

The questions below cover all aspects of Foundation package consumption — from basic CDK setup to IAM permissions, secrets management, naming conventions, and versioning. Answers to these questions will directly shape the module's implementation approach.

---

## 1. Foundation Package

We would like to understand how each of the following exports should be used within a module like Morning Briefing.

- **`SharedLambda`** — What does it handle automatically, and what must the module still provide?
- **`SharedRole`** — When should we create a custom role versus using the role created automatically by `SharedLambda`?
- **`ResourceNames`** — Should every resource in our module use this, or only shared/platform resources?
- **`ModuleIdentifier`** — What identifier should Module 21 use? (see also Question 2)
- **`PrajnaTags`** — Are tags applied automatically by `SharedLambda` and `SharedRole`, or does the module need to call `PrajnaTags.apply()` explicitly?
- **`getEnvironmentConfig()`** — Should this be called once at the stack level and passed down, or called per-construct?

### Requested Example

Please provide a minimal but complete CDK stack snippet that demonstrates how these six components are used together in a real module stack — similar to what Module 3 or Module 6 looks like internally.

---

## 2. ModuleIdentifier

We noticed the following identifier may already exist in the `ModuleIdentifier` enum:

```
MORNING_BRIEFING = 'briefing'   // Module 21
```

**Questions:**

- Is `ModuleIdentifier.MORNING_BRIEFING` already defined and exported in `v1.0.0`, or does it need to be added?
- If it needs to be added, which team is responsible for raising the PR — the Foundation team or the consuming module team?
- What naming convention should be followed for the enum key and the string value?
  - Should the string value be short (`'briefing'`) or descriptive (`'morning-briefing'`)?
  - Does the string value affect SSM paths, resource names, or log group names?

---

## 3. SharedLambda

We want to confirm exactly which configurations `SharedLambda` applies automatically and which ones Module 21 must still specify.

### Configurations we believe are automatic — please confirm:

- Node.js 20 runtime (ARM64 Graviton2)
- AWS X-Ray tracing
- Dedicated CloudWatch Log Group with retention
- Platform IAM execution role (`AWSLambdaBasicExecutionRole` + X-Ray)
- Environment variables: `STAGE`, `MODULE`, `FUNCTION_NAME`, `POWERTOOLS_SERVICE_NAME`
- Consistent resource naming
- Platform tagging

### Configurations we believe must still be provided — please confirm:

- `code` — path to the pre-compiled JavaScript directory (`dist/`)
- `handler` — the exported function name (e.g., `index.handler`)
- `description` — human-readable description
- `identifier` — short unique name for this function within the module
- `environment` — module-specific environment variables
- `policyStatements` — module-specific IAM permissions

### Additional questions:

- Can `memorySize` and `timeoutSeconds` be overridden per function?
- Does `SharedLambda` support Lambda Layers? If yes, how are they attached?
- Does `SharedLambda` support Dead Letter Queues (DLQ)?
- Does `SharedLambda` support event sources (e.g., EventBridge, SQS triggers)?

---

## 4. SharedRole

When a Lambda requires access to services such as DynamoDB, Secrets Manager, EventBridge, S3, and SSM Parameter Store, what is the recommended approach for attaching IAM permissions?

**Option A — Using `policyStatements` in `SharedLambda`:**

```typescript
new SharedLambda(this, 'BriefingHandler', {
  ...
  policyStatements: [
    DynamoDbPolicy.readWriteStatements(table.tableArn)[0],
    SsmPolicy.readStatement(accountId, region, stage, 'briefing'),
  ],
});
```

**Option B — Calling `addToRolePolicy()` after construction:**

```typescript
const handler = new SharedLambda(this, 'BriefingHandler', { ... });

handler.addToRolePolicy(DynamoDbPolicy.readStatement(table.tableArn));
handler.addToRolePolicy(EventBridgePolicy.putEventsStatement(bus.eventBusArn));
```

**Option C — Creating a standalone `SharedRole` with permissions, then passing it as `existingRole`:**

```typescript
const role = new SharedRole(this, 'Role', {
  config,
  module: ModuleIdentifier.MORNING_BRIEFING,
  identifier: 'briefing-exec',
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  description: 'Briefing Lambda execution role',
  policyStatements: [ ... ],
});

new SharedLambda(this, 'Handler', {
  ...
  existingRole: role.role,
});
```

**Questions:**

- Which option is the Foundation team's recommended pattern?
- Does `SharedRole` have a `forLambda()` factory method that automatically includes `AWSLambdaBasicExecutionRole`? If yes, when should it be used instead of the constructor?
- For **Secrets Manager** access — there is no `SecretsManagerPolicy` helper in the Foundation package. Should we use a raw `iam.PolicyStatement`, or is a helper planned?

---

## 5. Environment Variables

Module 21 will need several non-sensitive environment variables at runtime. Where should each category be configured?

| Variable | Example | Where should it go? |
|---|---|---|
| DynamoDB table names | `BRIEFING_TABLE_NAME` | From `tableName` attribute at CDK synth time |
| EventBridge bus name | `EVENT_BUS_NAME` | From `eventBusName` attribute at CDK synth time |
| Feature flags | `ENABLE_AI_SUMMARY` | Hardcoded per environment, or SSM? |
| API base URLs | `NOTIFICATION_API_URL` | SSM or direct in `environment` prop? |
| Cron schedule strings | `BRIEFING_CRON_UTC` | Hardcoded per environment, or SSM? |

**Questions:**

- Is there a convention for which environment variables come from CDK attributes (resolved at synth time) vs. SSM parameters (resolved at Lambda startup)?
- Does `getEnvironmentConfig()` expose any per-stage values that modules can use directly (e.g., `config.lambda.memorySize`, account IDs)?
- Should environment variable keys follow a naming convention (e.g., `SCREAMING_SNAKE_CASE`, prefixed with module name)?

---

## 6. Secrets

Module 21 will use Google OAuth credentials. We understand that sensitive values must not be stored in environment variables or CDK code.

**Assumed approach:**

1. Store the secret in AWS Secrets Manager under `prajna/{stage}/briefing/google-oauth`.
2. Pass only the secret name (not the value) as an environment variable to the Lambda.
3. Fetch the secret at runtime inside the handler using the AWS SDK.
4. Grant read access using `googleOAuthSecret.grantRead(handler.function)`.

**Questions:**

- Is the above approach the correct platform pattern?
- Does the Foundation package provide any helper construct or utility for Secrets Manager (similar to `SsmPolicy` for SSM)? If not, is one planned?
- Should the Secrets Manager secret be created using `aws_secretsmanager.Secret` directly, or should there be a `SharedSecret` construct?
- Who is responsible for creating the secret in each environment — the CDK stack, or a separate ops runbook?
- What is the recommended naming path? `prajna/{stage}/{module}/{secret-name}` or a different format?

---

## 7. ResourceNames

We understand that `ResourceNames` generates deterministic, platform-standard AWS resource names. We want to confirm the scope of its usage.

**Questions:**

- Should `ResourceNames` be used for **all** resources in Module 21, including:
  - DynamoDB tables (e.g., `MorningBriefTable`)
  - Lambda functions (handled automatically by `SharedLambda`)
  - IAM roles (handled automatically by `SharedRole`)
  - Secrets Manager secrets
  - EventBridge rules
  - SQS queues
- Or is `ResourceNames` only intended for resources created through Shared Constructs?
- For resources where a Shared Construct does not exist (e.g., DynamoDB, SQS), should we call `ResourceNames.*` directly? For example:

```typescript
import { ResourceNames, ModuleIdentifier, Stage } from '@prajna-platform/platform-foundation';

const tableName = ResourceNames.dynamoTable(
  config.stage,
  ModuleIdentifier.MORNING_BRIEFING,
  'briefing'
);

const table = new dynamodb.Table(this, 'BriefingTable', {
  tableName,
  ...
});
```

- Does `ResourceNames` have methods for DynamoDB, EventBridge, SQS, and SNS — or only for Lambda, IAM, S3, and SSM?

---

## 8. Recommended Project Structure

Is there a standard directory and file layout that all PRAJNA modules should follow?

We are currently planning:

```
module-21-morning-briefing/
├── bin/
│   └── prajna.ts                  ← CDK app entry point
├── cdk/
│   └── morning-briefing-stack.ts  ← Main CDK stack
├── src/
│   ├── handlers/                  ← Lambda handler entry files
│   ├── services/                  ← Business logic
│   ├── repositories/              ← DynamoDB data access
│   ├── connectors/                ← External APIs (Google, etc.)
│   ├── models/                    ← TypeScript types and interfaces
│   ├── utils/                     ← Shared helpers
│   └── events/                    ← EventBridge event types
├── dist/                          ← Compiled output (gitignored)
├── test/                          ← CDK and unit tests
├── package.json
├── tsconfig.json
└── cdk.json
```

**Questions:**

- Is the above structure aligned with what other modules (e.g., M3, M6, M13) use?
- Should CDK stack files live under `lib/` or `cdk/`? (We noticed the Foundation package uses `lib/`.)
- Should each Lambda handler be in its own subdirectory so `lambda.Code.fromAsset()` can point to a specific compiled folder?
- Are there any mandatory files (e.g., `cdk.json` context values, `.npmrc` for the Foundation package scope) that all modules must include?

---

## 9. Foundation Package Versioning

Module 21 will depend on `@prajna-platform/platform-foundation`. We want to understand how upgrades are managed.

**Questions:**

- If the Foundation package is updated from `v1.0.0` to `v1.1.0` (minor version — backward compatible), is updating the `package.json` dependency and running `npm install` sufficient?
- If a breaking change is released as `v2.0.0` (major version bump):
  - Will a migration guide be provided?
  - How will consuming modules be notified (GitHub issue, Slack, team meeting)?
  - Will the Foundation team provide a support window before deprecating the old major version?
- Is the Foundation package following strict Semantic Versioning (SemVer)?
  - **Patch** — Bug fixes only, no API changes
  - **Minor** — New exports, new optional props, backward compatible
  - **Major** — Removed exports, renamed constructs, required prop changes
- Should modules pin to an exact version (e.g., `"1.0.0"`) or a compatible range (e.g., `"^1.0.0"`)?
- Where are release notes or changelogs published? (GitHub Releases, a `CHANGELOG.md`, or another location?)

---

## Summary

| # | Topic | Status |
|---|---|---|
| 1 | Foundation package overview and usage example | ⏳ Awaiting answer |
| 2 | ModuleIdentifier for M21 | ⏳ Awaiting answer |
| 3 | SharedLambda — automatic vs manual config | ⏳ Awaiting answer |
| 4 | SharedRole — recommended IAM pattern | ⏳ Awaiting answer |
| 5 | Environment variables — where to configure | ⏳ Awaiting answer |
| 6 | Secrets — recommended pattern and tooling | ⏳ Awaiting answer |
| 7 | ResourceNames — scope of usage | ⏳ Awaiting answer |
| 8 | Standard project structure | ⏳ Awaiting answer |
| 9 | Package versioning and upgrade strategy | ⏳ Awaiting answer |

---

Thank you for your time. Once we receive answers to the above, the Morning Briefing module will be fully equipped to begin development in alignment with PRAJNA platform standards.

**Module 21 — Morning Briefing Team**
