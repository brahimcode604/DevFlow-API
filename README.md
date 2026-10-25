# DevFlow API

DevFlow API is a TypeScript REST API for managing clients, projects, project teams, tasks, and work activity at a small web development agency. The goal is to provide a secure, maintainable backend foundation rather than a CRUD-only demo.

> This repository contains a portfolio project. No production deployment, production data, performance measurements, or independent security certification are claimed.

## Features

- JWT-based authentication and bcrypt password hashing.
- Global `ADMIN`, `MANAGER`, and `MEMBER` roles, enforced by the API.
- Client and project management, project membership, task assignment, and status tracking.
- Activity records for important business operations.
- Project-scoped access control to protect against cross-project IDOR.
- Zod validation, consistent error responses, pagination, filtering, and sorting allowlists.
- PostgreSQL persistence through Prisma migrations.
- Readiness endpoint and Swagger UI / OpenAPI document.
- Docker Compose, seed tooling, and GitHub Actions CI.

## Architecture

The API is a modular monolith: one Express process and one PostgreSQL database. Domain routes validate requests and delegate to controllers; controllers adapt HTTP input/output; services apply business rules and use Prisma. Shared middleware handles authentication, role authorization, request validation, and errors.

```mermaid
flowchart LR
    Client[API client] --> Express[Express app]
    Express --> Middleware[Security, auth, validation, errors]
    Middleware --> Modules[Domain modules]
    Modules --> Services[Controllers and services]
    Services --> Prisma[Prisma ORM]
    Prisma --> PostgreSQL[(PostgreSQL)]
    Express --> OpenAPI[Swagger UI and OpenAPI]
```

### Data model

```mermaid
erDiagram
    CLIENT ||--o{ PROJECT : has
    PROJECT ||--o{ PROJECT_MEMBER : includes
    USER ||--o{ PROJECT_MEMBER : joins
    PROJECT ||--o{ TASK : contains
    USER ||--o{ TASK : creates
    USER o|--o{ TASK : assigned_to
    USER o|--o{ ACTIVITY_LOG : performs
    PROJECT o|--o{ ACTIVITY_LOG : records
```

- `ProjectMember` is the explicit many-to-many relationship between users and projects.
- A task belongs to a project and has a required creator and optional assignee.
- A task assignee must be a project member; the service validates this rule.
- Projects cannot outlive a client; deleting a project cascades to its tasks and memberships.
- Deleting a client that still has projects is rejected. User accounts should be deactivated rather than deleted; task authorship restricts deleting a user whose tasks remain.
- Activity records are append-only through the API. Actor and project references are nullable so audit context can survive deletion; target IDs and metadata remain.

## Roles and permissions

| Operation                        |              ADMIN |            MANAGER |                                  MEMBER |
| -------------------------------- | -----------------: | -----------------: | --------------------------------------: |
| Read and manage clients/projects |                All |                All |        Read through accessible projects |
| List projects and tasks          |                All |                All |                       Membership-scoped |
| Manage project membership        |                Yes |                Yes |                                      No |
| Create tasks                     |                Yes |                Yes |                      In joined projects |
| Assign tasks                     | Any project member | Any project member |                               Self only |
| Change task status               |                Any |                Any | Assigned task or task created by caller |
| Edit task details                |                Any |                Any |            Only tasks created by caller |
| Change user role                 |                Yes |                 No |                                      No |
| Overview analytics               |                All |                All |                       Membership-scoped |

Public registration always creates a `MEMBER`. Elevating access is deliberately not exposed during registration. `ADMIN` and `MANAGER` checks and project membership checks are server-side.

## Technology choices

- **Node.js 20+ and TypeScript strict mode:** supported runtime with compile-time checks.
- **Express 5:** familiar HTTP routing and middleware model.
- **PostgreSQL and Prisma:** relational constraints, migrations, typed queries, and transaction support.
- **Zod:** request and environment validation at system boundaries.
- **bcryptjs:** password hashing without a native build dependency. Production deployments should benchmark the configured cost on their own runtime.
- **JWT:** stateless, short-lived access tokens; refresh-token rotation is intentionally not implemented.
- **Vitest and Supertest:** unit and HTTP tests; HTTP tests use a dedicated PostgreSQL test database.
- **Docker Compose and GitHub Actions:** repeatable local services and automated checks.

## Prerequisites

- Node.js 20.19 or newer and npm.
- PostgreSQL 16+, or Docker Desktop with Compose.
- Git (optional for cloning and contributing).

## Local installation

From the repository root:

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` and set a unique `JWT_SECRET` with at least 32 characters, plus a valid `DATABASE_URL`. The example values are local placeholders, not production credentials. Never commit `.env`.

For an existing local PostgreSQL server, update `DATABASE_URL` in `.env`, then initialize and run:

```powershell
npm run db:generate
npm run db:deploy
npm run dev
```

The API listens on `http://localhost:3000` by default.

## Environment variables

| Variable                 | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `NODE_ENV`               | `development`, `test`, or `production`.                                 |
| `PORT`                   | API listen port; default `3000`.                                        |
| `DATABASE_URL`           | PostgreSQL connection URL.                                              |
| `JWT_SECRET`             | HMAC key, at least 32 characters. Keep it secret and rotate if exposed. |
| `JWT_EXPIRES_IN_SECONDS` | Access-token lifetime; defaults to 900 seconds.                         |
| `CORS_ORIGIN`            | Comma-separated exact allowed browser origins.                          |
| `RATE_LIMIT_WINDOW_MS`   | Authentication rate-limit window in milliseconds.                       |
| `RATE_LIMIT_MAX`         | Maximum authentication requests per IP per window.                      |
| `SEED_ADMIN_EMAIL`       | Optional email for an explicitly requested admin seed.                  |
| `SEED_ADMIN_PASSWORD`    | Optional seed password; must contain at least 12 characters.            |
| `SEED_ADMIN_NAME`        | Optional display name for the admin seed.                               |

The seed command idempotently creates a clearly synthetic demo client/project. It creates an administrator and sample task only when both seed email and password are supplied. There are no default credentials, and demo seeding is disabled in production.

## Database and seeding

```powershell
npm run db:generate
npm run db:migrate -- --name descriptive_change
npm run db:deploy
npm run db:seed
npm run db:studio
```

Use `db:migrate` while developing migrations and `db:deploy` for deployment/CI. Set the `SEED_ADMIN_*` variables only in a trusted environment when you need an initial administrator.

## Run and test

```powershell
npm run dev
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

HTTP integration tests expect an isolated test PostgreSQL database. Configure its `DATABASE_URL` using a database named `devflow_test`, then apply migrations before testing:

```powershell
$env:DATABASE_URL = "postgresql://devflow:devflow_test_only@localhost:5432/devflow_test?schema=public"
npm run db:deploy
npm test
```

Do not point test runs at a production or developer database containing valuable data. The tests create and remove only uniquely named fixtures, but the test database must still be dedicated.

## Docker Compose

Create `.env` from `.env.example`, then add `POSTGRES_PASSWORD` and set `DATABASE_URL` only if running the API outside Compose. For Compose, the application constructs the database URL using the Compose variables.

```powershell
Copy-Item .env.example .env
```

Replace the example `POSTGRES_PASSWORD` and `JWT_SECRET` values in `.env`. Choose a local database password using URL-safe characters because Compose builds `DATABASE_URL` from it.

Then start:

```powershell
docker compose up --build
docker compose ps
docker compose logs -f api
docker compose down
```

The `postgres_data` named volume persists database data across container recreation. `docker compose down -v` deletes that volume and its data; use it only when you explicitly want to reset the local database. The API container applies migrations before starting the server and waits for PostgreSQL health.

## API documentation

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Readiness: `GET http://localhost:3000/api/v1/health`

### Example requests

Register a member:

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "developer@example.test",
  "password": "a-long-unique-password",
  "name": "Dev Example"
}
```

Example registration response (`201`; the token is shown as a placeholder):

```json
{
  "data": {
    "user": {
      "id": "8a9450db-1ab2-4f8f-9c68-71d9cf697f6c",
      "email": "developer@example.test",
      "name": "Dev Example",
      "role": "MEMBER",
      "createdAt": "2026-10-25T12:00:00.000Z"
    },
    "accessToken": "<short-lived-jwt>",
    "tokenType": "Bearer"
  }
}
```

Create a client as an administrator or manager:

```http
POST /api/v1/clients
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "Atlas Studio",
  "email": "contact@example.test"
}
```

List active project tasks:

```http
GET /api/v1/projects/<project-uuid>/tasks?page=1&perPage=20&status=IN_PROGRESS
Authorization: Bearer <access-token>
```

Successful JSON responses are wrapped in `data`; paginated responses also contain `meta`:

```json
{
  "data": [],
  "meta": { "page": 1, "perPage": 20, "total": 0, "totalPages": 0 }
}
```

Errors share a stable format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [],
    "requestId": "request-uuid"
  }
}
```

## Security decisions and limitations

- Passwords are bcrypt hashes; plaintext values are never stored or returned.
- Tokens have an issuer, audience, and configurable short expiration. There is no refresh-token or token-revocation system yet.
- Resource queries scope members to project membership and return `404` for inaccessible individual project resources to reduce ID enumeration.
- Authentication endpoints are rate-limited; Helmet sets common security headers; CORS uses configured exact origins.
- Request bodies and query parameters are validated and sortable fields are allowlisted.
- The analytics date window filters project/task creation dates; overdue counts are evaluated against the current date within that window.
- Production errors do not expose exception messages or stack traces; server-side logs include request IDs.
- Configure TLS, secret storage, database backups, centralized logging, monitoring, and proxy-aware rate-limit settings in the deployment environment.
- This portfolio implementation has not been independently penetration-tested. Review operational assumptions before production use.

## Roadmap

- Refresh-token rotation, revocation, and account recovery.
- Deactivation management and auditable role-change records.
- Activity log query endpoints and richer analytics dimensions.
- More service-level and database concurrency tests, especially transaction retry behavior.
- Deployment-specific observability, backup/restore validation, and operational runbooks.

## Contributing

1. Create a focused branch and describe the behavior change.
2. Add or update tests for changed behavior.
3. Run formatting, linting, type checks, migrations, and tests locally.
4. Keep credentials and customer data out of commits and test fixtures.

## License

MIT; see [LICENSE](./LICENSE).
