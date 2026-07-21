# PRAJNA Platform — Cognito Integration Guide for Module 30 (Data Migration Tools)

**To:** Module 30 (Data Migration Tools) Development Team  
**From:** PRAJNA Platform / Auth Team (Module 3 & Module 1)  
**Date:** July 21, 2026  
**Package Scope:** `@prajna-platform/platform-foundation`

---

## Executive Summary

This guide provides the exact SSM parameter paths, Cognito claim names, and CDK/TypeScript code snippets required to connect Module 30 (Data Migration Tools) with the PRAJNA Cognito authentication system.

---

## 1. Cognito User Pool ID & ARN

The Auth module (Module 3) publishes all Cognito configuration parameters to AWS Systems Manager (SSM) Parameter Store using deterministic paths.

### SSM Parameter Paths

| Resource | SSM Parameter Path | Foundation Helper (`SsmPaths.Auth`) |
|---|---|---|
| **User Pool ID** | `/prajna/{stage}/auth/user-pool-id` | `SsmPaths.Auth.userPoolId(stage)` |
| **User Pool ARN** | `/prajna/{stage}/auth/user-pool-arn` | `SsmPaths.Auth.userPoolArn(stage)` |
| **App Client ID** | `/prajna/{stage}/auth/user-pool-client-id` | `SsmPaths.Auth.userPoolClientId(stage)` |
| **Authorizer Lambda ARN** | `/prajna/{stage}/auth/authorizer-lambda-arn` | `SsmPaths.Auth.authorizerFunctionArn(stage)` |

> *Note: `{stage}` evaluates to `dev`, `qa`, or `prod` depending on the environment.*

### CDK Usage Example (Fetching User Pool ID & ARN in CDK)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { SsmPaths, Stage } from '@prajna-platform/platform-foundation';

// Fetching User Pool ID from SSM in your Module 30 CDK Stack
const stage = Stage.DEVELOPMENT; // or resolved from environment config

const userPoolId = ssm.StringParameter.valueForStringParameter(
  this,
  SsmPaths.Auth.userPoolId(stage)
);

const userPoolArn = ssm.StringParameter.valueForStringParameter(
  this,
  SsmPaths.Auth.userPoolArn(stage)
);

// Import the User Pool reference in CDK to attach to Authorizers
const userPool = cognito.UserPool.fromUserPoolArn(this, 'ImportedUserPool', userPoolArn);
```

---

## 2. Role Attribute & User Group Claims

PRAJNA Cognito supports both **Custom User Attributes** and **Cognito User Groups** for Role-Based Access Control (RBAC).

### Claim Specifications

| Claim Name | Claim Type | Standard Values | Description |
|---|---|---|---|
| `custom:role` | `string` | `ADMIN`, `PVC`, `IQAC`, `DIRECTOR`, `HOD`, `FACULTY` | Primary user role attribute assigned on user profile. |
| `cognito:groups` | `string[]` (Array) | `["ADMIN"]`, `["FACULTY"]`, etc. | List of assigned Cognito User Groups present in ID & Access tokens. |
| `custom:facultyId` | `string` | e.g. `FAC-10024` | Faculty identifier (if applicable). |

### Standard Platform User Roles

- **`ADMIN`**: Full administrative access (can perform data migration uploads).
- **`PVC`**: Pro-Vice-Chancellor.
- **`IQAC`**: Internal Quality Assurance Cell lead.
- **`DIRECTOR`**: Campus / School Director.
- **`HOD`**: Head of Department.
- **`FACULTY`**: Regular faculty member.

---

## 3. Lambda Implementation Example (Role & Permission Verification)

Inside your Module 30 upload endpoint handler, you can check user permissions using either `custom:role` or `cognito:groups` extracted from the API Gateway authorizer claims context.

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface CognitoClaims {
  sub: string;
  email: string;
  'custom:role'?: string;
  'cognito:groups'?: string | string[];
  'custom:facultyId'?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // 1. Extract claims from API Gateway RequestContext (populated by Authorizer / Cognito)
  const claims = event.requestContext.authorizer?.claims as CognitoClaims | undefined;

  if (!claims) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Unauthorized: Missing token claims' }),
    };
  }

  // 2. Extract Primary Role & Groups
  const userRole = claims['custom:role'];
  
  // cognito:groups can arrive as an array or comma-separated string depending on authorizer setup
  const rawGroups = claims['cognito:groups'];
  const userGroups: string[] = Array.isArray(rawGroups) 
    ? rawGroups 
    : (typeof rawGroups === 'string' ? rawGroups.split(',') : []);

  // 3. Verify Admin Authorization for Migration Upload
  const isAdmin = userRole === 'ADMIN' || userGroups.includes('ADMIN');

  if (!isAdmin) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Forbidden: Migration upload endpoints require ADMIN permissions.',
        currentRole: userRole ?? 'NONE'
      }),
    };
  }

  // 4. Authorized — proceed with migration processing
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Migration processing started',
      uploadedBy: claims.email,
      role: userRole,
    }),
  };
};
```

---

## 4. API Gateway Route Protection Example

If you are using API Gateway with `CognitoUserPoolsAuthorizer` in CDK for Module 30:

```typescript
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { SsmPaths, Stage } from '@prajna-platform/platform-foundation';

// 1. Import User Pool via SSM ARN
const userPoolArn = ssm.StringParameter.valueForStringParameter(
  this, 
  SsmPaths.Auth.userPoolArn(stage)
);
const userPool = cognito.UserPool.fromUserPoolArn(this, 'UserPoolRef', userPoolArn);

// 2. Create Authorizer
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'MigrationApiAuthorizer', {
  cognitoUserPools: [userPool],
  authorizerName: `prajna-${stage}-migration-authorizer`,
});

// 3. Protect Migration Routes
const migrationResource = api.root.addResource('migration');
const uploadResource = migrationResource.addResource('upload');

uploadResource.addMethod('POST', new apigateway.LambdaIntegration(migrationUploadLambda), {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

---

## 5. Summary Reference

- **UserPool ID SSM Path:** `/prajna/{stage}/auth/user-pool-id`
- **UserPool ARN SSM Path:** `/prajna/{stage}/auth/user-pool-arn`
- **Role Claim:** `custom:role`
- **Group Claim:** `cognito:groups`
- **Admin Value:** `"ADMIN"`

If you need any adjustments or add-ons as Module 30 builds out, feel free to reach out to the Auth / Platform Team!
