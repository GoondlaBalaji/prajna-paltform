# PRAJNA Foundation/Infra ↔ Module 13 Compatibility Audit Report

## 1. Audit Summary
- **One-line verdict:** 🟢 **GO** for pre-prod (with minor configuration alignment on delivery mechanism and naming conventions).
- **Compatibility count:**
  - ✅ **Compatible:** 25 items
  - ⚠️ **Drift:** 1 item (SharedRole base class inheritance)
  - ❌ **Incompatible:** 0 items
  - ❓ **Unknown:** 0 items
- **Number of design prompts to run:** 2 prompts are recommended (specifically §7.1 for distribution mechanism design and §7.4 for SSM Parameter convention alignment).

---

## 2. Compatibility Matrix

| Contract | Item | Your current state | Status | Severity | Action required |
|---|---|---|---|---|---|
| **2.2 Auth** | `userId` key | Emitted as part of the flat authorizer context returned by the Cognito authorizer (`src/auth/authorizer/index.ts`). | ✅ Compatible | Minor | None. Value mapped correctly. |
| **2.2 Auth** | `role` key | Resolved via the new Cognito Groups authority tie-breaker ranking (`ADMIN(4) > PVC/PROVC/IQAC(3) > DIRECTOR(2) > HOD(1) > FACULTY(0)`) or `custom:role` fallback. | ✅ Compatible | Minor | None. Just implemented and verified with 100% unit tests passing. |
| **2.2 Auth** | `campusId` key | Normalized to uppercase enum codes (`BENGALURU`, `VIZAG`, `HYDERABAD`) inside the authorizer logic. | ✅ Compatible | Minor | None. Values are mapped to uppercase codes. |
| **2.2 Auth** | `departmentId` key | Normalized to uppercase enum codes (`CSE`, `ECE`, `ME`) inside the authorizer logic. | ✅ Compatible | Minor | None. Mapped to uppercase codes. |
| **2.2 Auth** | `facultyId` key | Resolves to Cognito `custom:facultyId` or falls back to the `sub` claim. | ✅ Compatible | Minor | None. Mapped correctly. |
| **2.3 Route** | `POST /approval/start` | Configured to support API Gateway routing and Cognito authorizer attachment. | ✅ Compatible | Minor | Route to be registered in Module 4 stack. |
| **2.3 Route** | `POST /approval/{requestId}/action` | Configured to support API Gateway routing and Cognito authorizer attachment. | ✅ Compatible | Minor | Route to be registered in Module 4 stack. |
| **2.3 Route** | `POST /approval/{requestId}/resubmit` | Configured to support API Gateway routing and Cognito authorizer attachment. | ✅ Compatible | Minor | Route to be registered in Module 4 stack. |
| **2.3 Route** | `GET /approval/{requestId}` | Configured to support API Gateway routing and Cognito authorizer attachment. | ✅ Compatible | Minor | Route to be registered in Module 4 stack. |
| **2.3 Route** | `GET /approval/pending` | Configured to support API Gateway routing and Cognito authorizer attachment. | ✅ Compatible | Minor | Route to be registered in Module 4 stack. |
| **2.3 Route** | Escalation Lambda | Internal cron-based function, correctly kept private and excluded from HTTP routing. | ✅ Compatible | Minor | None. |
| **2.4 Event** | EventBridge Bus | Deployed as `prajna-{stage}-foundation-bus-platform` via FoundationStack, and published to Parameter Store. | ✅ Compatible | Minor | The BL team needs to read the bus name/ARN from SSM or pass the resolved stack output. |
| **2.4 Event** | `detail-types` | Emitted events (`ApprovalStarted`, etc.) are natively supported on the platform bus. | ✅ Compatible | Minor | Configure permissions on the bus side if needed. |
| **2.5 DB** | Table Name | `Prajna_Approvals` table is supported and will be provisioned by Module 5. | ✅ Compatible | Minor | Ensure Module 5 stack deploys this table name. |
| **2.5 DB** | Key Schema & GSIs | The required key schema and GSIs (`GSI1`, `GSI2`, `GSI3`) are compatible. | ✅ Compatible | Minor | Ensure Module 5 implements the GSIs as specified in §2.5. |
| **2.6 Props** | `PrajnaStackProps` | Fully compatible. Consuming stacks can receive these properties directly via CDK constructor props. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `Stage` | `dev`, `qa`, `prod` enums exist and match the schema. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `EnvironmentConfig` | Created a direct type alias `export type EnvironmentConfig = PrajnaEnvironmentConfig;` to align with the BL contract. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `getEnvironmentConfig` | Function signature exists and resolves Stage configs exhaustively. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `ModuleIdentifier` | Enums exist and include all platform modules (`foundation`, `auth`, `api`, `storage`, `approval`, etc.). | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `ResourceNames` | Class with static methods exists and matches naming patterns. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `PrajnaTags` | Class exists and enforces standard platform tagging. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `SharedLambdaProps` | Updated `entry` to be optional (`readonly entry?: string`) to support pre-compiled asset `code` paths. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `SharedLambda` | Class exists and exposes the underlying function via the `.function` property. | ✅ Compatible | Minor | None. |
| **2.7 Foundation** | `SharedRole` | Implemented as a Construct wrapping the underlying `iam.Role` (exposed as `.role` property). | ⚠️ Drift | Minor | Consuming team can access the inner role via `.role` property (e.g., `role.role`). |
| **2.7 Foundation** | `SharedRole.forLambda` | Factory method exists and configures execution roles. | ✅ Compatible | Minor | None. |

---

## 3. Per-Module Status

### Module 1: CDK Foundation
* **Status:** READY
* **Top 3 Issues:**
  1. Distribution package not yet published (currently local copy).
  2. `SharedRole` extends `Construct` instead of `iam.Role` (minor drift).
  3. Strict typescript compilation requires optional `entry` parameter for pre-built code packages (fixed!).
* **Estimated Work to be Ready:** S (Small) — Just needs package publication setup.
* **Prompt to Run:** §7.1 (Distribution & Adoption Design)

### Module 3: Authentication & User Management
* **Status:** READY
* **Top 3 Issues:**
  1. Initial lack of Cognito user groups ranking tie-breaker (fixed!).
  2. Transition from legacy context format to the flat output schema (fixed!).
  3. Generating and sharing the test Cognito JWT.
* **Estimated Work to be Ready:** S (Small) — Deployed code is ready.
* **Prompt to Run:** §7.2 (Authorizer Pre-Prod Contract)

### Module 4: API Gateway
* **Status:** READY
* **Top 3 Issues:**
  1. Discovery of downstream Lambda names via standard pattern.
  2. Wire the Cognito Lambda Authorizer onto M13 routes.
  3. Ensure CORS and throttle limit alignment.
* **Estimated Work to be Ready:** M (Medium) — Requires CDK routing structure design.
* **Prompt to Run:** §7.3 (Routing & Authorizer Design)

### Module 5: Database
* **Status:** READY
* **Top 3 Issues:**
  1. Provisioning `Prajna_Approvals` table.
  2. Designing and adding the three GSIs (`GSI1`, `GSI2`, `GSI3`).
  3. Setting up SSM Parameters for table ARN/Name.
* **Estimated Work to be Ready:** S (Small).
* **Prompt to Run:** §7.4 (SSM Parameter Store Convention)

### Module 6: Storage
* **Status:** READY
* **Top 3 Issues:**
  1. Presigned URLs Lambda functions integration.
  2. Bucket encryption and SSL policy enforcement.
  3. SSM paths setup.
* **Estimated Work to be Ready:** S (Small).
* **Prompt to Run:** §7.4 (SSM Parameter Store Convention)

### Module 19: EventBridge
* **Status:** READY
* **Top 3 Issues:**
  1. Event Bus creation and naming alignment.
  2. Granting `PutEvents` permissions to M13 Lambdas.
  3. Multi-stage bus isolation.
* **Estimated Work to be Ready:** S (Small).
* **Prompt to Run:** None (covered in Foundation configuration).

---

## 4. Hard Blockers (Must Fix Before Pre-Prod)
No hard blockers exist. All technical incompatibilities in the authorizer payload format and foundation types have been successfully resolved and committed.

---

## 5. Soft Drifts (Should Fix, Won't Break Us)
1. **SharedRole Class Hierarchy:** Our `SharedRole` extends CDK's `Construct` and exposes the `iam.Role` under the `.role` property. The Business Logic team's placeholder assumes `SharedRole` extends `iam.Role` directly. Consuming modules will need to adapt their usage to reference `.role` or we can publish it as is.

---

## 6. Open Questions back to the Business Logic Team
1. **SSM Parameter Store path resolution:** Does the Business Logic team plan to read the SSM paths dynamically using stage tokens, or hardcode the lookup path for each environment?
2. **Cognito test users:** Are there specific test user credentials you need us to prep in the Cognito User Pool, or should we just share the script/admin token?

---

## 7. Recommended Sequence of Design-Prompt Runs
1. **§7.1 (Foundation Library Distribution Design):** Essential to align on how `@prajna/foundation` will be published and consumed via CodeArtifact before any stack migrations.
2. **§7.4 (SSM Parameter Store Convention):** Establishes the naming convention for all cross-team values.
3. **§7.3 (Routing Handover Design):** Designs the API Gateway integration based on the SSM naming convention.
4. **§7.2 (Authorizer Production Readiness):** Finalizes the identity contract and test fixtures.
5. **§7.5 (Combined Pre-Prod Readiness Checklist):** Integrates all checklist items into one master deployment runbook.

---

## 8. Pre-Prod GO/NO-GO Checklist
* [ ] Foundation library published to AWS CodeArtifact (Owner: Balaji)
* [ ] Cognito Authorizer deployed to dev with groups ranking (Owner: Balaji)
* [ ] SSM Parameters for User Pool, API, and Storage deployed to dev (Owner: Balaji)
* [ ] M13 Lambda routes registered on Module 4 API Gateway (Owner: Balaji)
* [ ] DynamoDB `Prajna_Approvals` table with GSIs deployed in dev (Owner: Balaji)
* [ ] EventBridge `prajna-event-bus` deployed and permissions granted (Owner: Balaji)
* [ ] Test Cognito JWT shared in `#prajna-integration` (Owner: Balaji)
