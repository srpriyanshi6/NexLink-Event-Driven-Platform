
<div align="center">

# NexLink — Event-Driven Microservices Platform

**Production-grade backend platform built with Node.js, Apache Kafka, GraphQL, and MongoDB**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-2.8+-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![GraphQL](https://img.shields.io/badge/GraphQL-Apollo-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)

[Architecture](#architecture) · [Services](#services) · [Quick Start](#quick-start) · [API Docs](#api-reference) · [Tech Stack](#tech-stack)

</div>

---

> **NexLink** is a fully decoupled, event-driven backend platform that orchestrates multi-step workflows, dispatches real-time notifications, and aggregates live analytics — all wired together through Apache Kafka and surfaced via a unified GraphQL API.

---

## Architecture

<img width="3170" height="2925" alt="image" src="https://github.com/user-attachments/assets/655e3764-8e5b-471f-a0cb-aa3a1c661bd4" />

---

## Key Features

| Feature | Details |
|---|---|
| **Secure Auth** | JWT authentication with role-based access control (user/admin) |
| **Event-Driven** | Kafka producers/consumers decoupling all service communication |
| **Workflow Engine** | Multi-step workflows with retry logic, exponential backoff, and parallel execution |
| **Smart Notifications** | Kafka-triggered email notifications via Resend (with SMTP/SendGrid fallback) |
| **Live Analytics** | Real-time metrics aggregation and daily rollup dashboards |
| **GraphQL API** | Apollo Server federated gateway — query users, workflows, analytics, notifications in one request |
| **Production Hardened** | Helmet.js, CORS, tiered rate limiting (global + auth + workflow), Winston logging |
| **Docker Ready** | Kafka + Zookeeper orchestrated via Docker Compose |
| **Integration Tested** | End-to-end test suite covering full user → workflow → notification → analytics flow |

--- 


## 17/17 Integration Tests Passed

<img width="770" height="341" alt="Screenshot 2026-06-23 at 6 38 39 AM" src="https://github.com/user-attachments/assets/02e53c41-27ce-4df3-86ac-6bf8e5daff78" />


---

## Services

### 1. API Gateway (Port 3000)
The single front door to the platform. Routes all traffic to downstream services with:
- JWT validation on every request
- Tiered rate limiting: `100 req/15 min` global · `5 attempts/hr` on auth · `50 creates/hr` on workflows
- Request ID injection (`X-Request-ID`) for distributed tracing
- User context forwarding (`X-User-Id`, `X-User-Role`) to services
- Winston structured logging

### 2. User Service (Port 3001)
Authentication and user lifecycle management:
- `POST /auth/register` — bcrypt password hashing, publishes `USER_CREATED` Kafka event
- `POST /auth/login` — JWT issuance (24h expiry), publishes `USER_UPDATED`
- `GET/PUT /users/:id` — Profile management with role-based authorization
- `GET /users` — Admin-only paginated user listing

### 3. Workflow Service (Port 3002)
The core of NexLink — a stateful workflow orchestration engine:
- **Step Types:** `task`, `notification`, `webhook`, `delay`, `condition`, `parallel`
- **Retry Logic:** Per-step configurable retries with exponential backoff
- **Duplicate Prevention:** In-memory `runningWorkflows` map prevents concurrent re-execution
- **Kafka Events:** Emits `WORKFLOW_CREATED`, `WORKFLOW_COMPLETED`, `WORKFLOW_STEP_COMPLETED`, `WORKFLOW_FAILED`

### 4. Notification Service (Port 3003)
Kafka-driven notification dispatch:
- Consumes `workflow-events` and `user-events` topics
- Multi-provider email: **Resend** (primary) → SMTP → SendGrid fallback
- Persists notification history to MongoDB
- Triggered both by direct API calls and workflow steps

### 5. Analytics Service (Port 3004)
Real-time metrics pipeline:
- Consumes all Kafka events and stores raw `AnalyticsEvent` documents
- Aggregates into `DailyMetrics` with rolling averages (e.g., avg workflow execution time)
- REST endpoints: `/analytics/dashboard`, `/analytics/users/:id`, `/analytics/system`, `/analytics/workflows/:id`

### 6. GraphQL Service (Port 3005)
Unified query layer (Apollo Server):
- Federated resolvers: users, workflows, notifications, analytics — one request, any combination
- JWT context extraction for auth-aware resolvers
- GraphQL Playground enabled in non-production environments

---

## Quick Start

**Prerequisites:** Node.js 18+, Docker Desktop

```bash
# 1. Clone the repo
git clone https://github.com/srpriyanshi6/nexlink-event-driven-platform
cd nexlink-event-driven-platform

# 2. Start Kafka + Zookeeper
docker-compose up -d

# 3. Set environment variables (see .env.example in each service folder)

# 4. Start all services (open 6 terminals or use a process manager)
cd api-gateway && npm install && npm run dev          # :3000
cd user-service && npm install && npm run dev         # :3001
cd workflow-service && npm install && npm run dev     # :3002
cd notification-service && npm install && npm run dev # :3003
cd analytics-service && npm install && npm run dev    # :3004
cd graphql-service && npm install && npm run dev      # :3005

# 5. Verify all services are healthy
curl http://localhost:3000/health
```

---

## API Reference

### Authentication
```http
POST /api/auth/register
Content-Type: application/json

{ "name": "Test User", "email": "test1@example.com", "password": "Secure123!" }
```

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "test1@example.com", "password": "Secure123!" }
```

### Workflows
```http
POST /api/workflows
Authorization: Bearer <token>

{
  "name": "Onboarding Flow",
  "steps": [
    { "type": "task", "order": 1, "config": { "task": "Send welcome email", "duration": 500 } },
    { "type": "notification", "order": 2, "config": { "message": "Welcome aboard!", "type": "email" } },
    { "type": "webhook", "order": 3, "config": { "url": "https://hooks.example.com/onboard", "method": "POST" } }
  ]
}
```

### GraphQL
```graphql
# Get user profile + their workflows + analytics in one query
query {
  user(id: "abc123") {
    name
    email
    workflows {
      name
      status
      steps { type status }
    }
    analytics(days: 30) {
      workflowsCompleted
      averageExecutionTime
    }
  }
}
```


---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 18, Express.js |
| **Message Broker** | Apache Kafka (KafkaJS), Zookeeper |
| **Database** | MongoDB (Mongoose ODM) |
| **API** | REST + GraphQL (Apollo Server) |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Email** | Resend API, Nodemailer (SMTP/SendGrid fallback) |
| **Security** | Helmet.js, CORS, express-rate-limit |
| **Logging** | Winston |
| **Containers** | Docker, Docker Compose (Confluent Platform images) |
| **Testing** | Jest, Axios-based integration test suite |
| **Dev Tools** | Nodemon, dotenv |

---

## Testing

```bash
# Integration test — runs full E2E flow across all 6 services
node tests/integration/workflow.test.js

# Load test
node tests/load/load-test.js
```

The integration suite tests:
1. Health checks across all 6 services
2. User registration + login (with Kafka event emission)
3. Workflow creation, execution, step progression
4. Notification dispatch via Kafka consumer
5. Analytics event recording and aggregation
6. GraphQL resolver correctness

<img width="750" height="341" alt="Screenshot 2026-06-23 at 6 38 39 AM" src="https://github.com/user-attachments/assets/ce0cf7d3-75eb-4071-b375-c98961d22cd3" />


---
