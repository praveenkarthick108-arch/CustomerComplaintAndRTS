# Customer Complaint & Resolution Tracking System

A full-stack web application for centralized management of customer complaints — from submission through resolution. Built for enterprise environments where support teams need structured workflows, SLA enforcement, and audit trails.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [Features](#features)
- [Complaint Workflow](#complaint-workflow)
- [SLA Rules](#sla-rules)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Overview](#api-overview)
- [Demo Credentials](#demo-credentials)
- [Phase 2 — ETL Analytics](#phase-2--etl-analytics)
- [Future Enhancements](#future-enhancements)

---

## Overview

Organizations relying on emails and spreadsheets to manage customer complaints face delays, missed SLA commitments, and poor visibility. This system provides a unified platform to register, assign, track, escalate, and close complaints with full audit history.

**Applicable industries:** Telecom, Banking, Retail, E-Commerce, Healthcare, Logistics, IT Support.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3, WAL mode) |
| Auth | JWT (7-day expiry), bcryptjs |
| Runtime | Bun |
| File Uploads | Multer |
| HTTP Client | Axios |

---

## User Roles

| Role | Capabilities |
|---|---|
| **Customer** | Register complaints, track status, upload documents, submit feedback |
| **Support Agent** | View assigned complaints, update status, add resolution comments |
| **Supervisor** | Monitor queues, handle escalations, review SLA breaches, generate reports |
| **Administrator** | Full system access — user management, categories, configuration, analytics |
| **Quality Team** | Analyze complaint trends and service quality metrics |

---

## Features

- **Role-Based Access Control** — each role sees only what it needs
- **Complaint Registration** — auto-generated complaint IDs, category selection, priority assignment
- **Complaint Workflow** — structured status progression with history logged at every step
- **SLA Tracking** — automatic deadline calculation per priority; auto-escalation on breach
- **File Attachments** — upload supporting documents on complaints and resolutions
- **Notifications** — in-app alerts for assignment, status changes, escalations, and resolution
- **Feedback System** — customer satisfaction ratings on closed complaints
- **Dashboard & Analytics** — real-time stats, charts, agent performance, category trends
- **Audit Trail** — full history of every status change (who changed what and when)
- **Pagination & Filtering** — search, sort, and filter complaints across all views

---

## Complaint Workflow

```
Customer submits complaint
        |
        v
System auto-generates Complaint ID  →  Status: Open
        |
        v
Admin/Supervisor assigns to agent  →  Status: Assigned
        |
        v
Agent investigates issue  →  Status: In Progress
        |
        v
    [Decision]
        |
        +-- Needs customer input  →  Status: Pending Customer Response
        |
        +-- Requires escalation   →  Status: Escalated
        |                               (Supervisor takes over)
        |
        +-- Issue resolved        →  Status: Resolved
                |
                v
        Customer confirms resolution
                |
                v
          Status: Closed
          (Feedback collected)
```

### Complaint Categories

- Billing Issues
- Service Disruption
- Product Defects
- Technical Problems
- Delivery Delays
- Account Issues
- Customer Service Complaints

### Priority Levels

`Low` · `Medium` · `High` · `Critical`

---

## SLA Rules

Resolution deadlines are calculated automatically from complaint creation time.

| Priority | Resolution Time |
|---|---|
| Critical | 4 Hours |
| High | 24 Hours |
| Medium | 48 Hours |
| Low | 72 Hours |

Complaints that breach their SLA deadline are automatically escalated. SLA countdowns are displayed live in the UI.

---

## Project Structure

```
Customer_Complaint/
├── backend/
│   ├── server.js               # Express app, middleware, route mounting, SLA scheduler
│   ├── .env                    # PORT, JWT_SECRET, NODE_ENV
│   ├── uploads/                # Uploaded file attachments
│   └── src/
│       ├── config/
│       │   └── database.js     # SQLite init, table schemas, seed data
│       ├── middleware/
│       │   └── auth.js         # JWT verification, role authorization
│       ├── routes/
│       │   ├── auth.js         # Login, register, logout
│       │   ├── complaints.js   # Complaint CRUD + role-based filtering
│       │   ├── users.js        # User management (admin only)
│       │   ├── categories.js   # Complaint categories
│       │   ├── attachments.js  # File upload/download
│       │   ├── feedback.js     # Customer satisfaction ratings
│       │   ├── notifications.js
│       │   └── dashboard.js    # Analytics data
│       └── utils/
│           ├── sla.js          # SLA deadline calculation and breach detection
│           └── notificationHelper.js
├── frontend/
│   ├── index.html
│   ├── vite.config.js          # Dev server on port 5173
│   └── src/
│       ├── App.jsx             # Router with ProtectedRoute/PublicRoute wrappers
│       ├── api/axios.js        # Axios instance configured for backend
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── NotificationContext.jsx
│       ├── components/
│       │   ├── layout/         # Layout, Header, Sidebar (role-aware nav)
│       │   └── common/         # PriorityBadge, StatusBadge, SLATimer, StatCard, etc.
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Login.jsx / Register.jsx / Profile.jsx
│           ├── Notifications.jsx
│           ├── AgentWorkQueue.jsx
│           ├── EscalationDashboard.jsx
│           ├── Reports.jsx
│           ├── admin/UserManagement.jsx
│           └── complaints/
│               ├── ComplaintList.jsx
│               ├── CreateComplaint.jsx
│               └── ComplaintDetail.jsx
├── start.ps1                   # One-command launcher (starts both servers)
└── Sample.txt.txt              # Phase 1 specification document
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime installed

### Quick Start (Recommended)

Run the convenience script from the project root — it kills any existing processes on the required ports, starts both servers, and opens the browser automatically:

```powershell
.\start.ps1
```

### Manual Start

**Backend** (terminal 1):
```powershell
cd backend
bun server.js
# Runs on http://localhost:3001
```

**Frontend** (terminal 2):
```powershell
cd frontend
bun run dev
# Runs on http://localhost:5173
```

### Environment Configuration

The backend reads from `backend/.env`:

```env
PORT=3001
JWT_SECRET=your-secret-key
NODE_ENV=development
```

---

## API Overview

All responses follow the shape:

```json
{
  "success": true,
  "data": { ... },
  "pagination": { ... }
}
```

All field names are `snake_case`.

| Prefix | Description |
|---|---|
| `POST /api/auth/login` | Authenticate and receive JWT |
| `POST /api/auth/register` | Create a new user account |
| `GET/POST /api/complaints` | List or create complaints |
| `GET/PATCH /api/complaints/:id` | Retrieve or update a complaint |
| `GET /api/dashboard` | Analytics and summary stats |
| `GET /api/notifications` | User notifications |
| `POST /api/attachments` | Upload file to a complaint |
| `POST /api/feedback` | Submit resolution feedback |
| `GET/POST /api/users` | User management (admin only) |
| `GET /api/categories` | List complaint categories |
| `GET /api/health` | Server health check |

Authentication: include `Authorization: Bearer <token>` on all protected routes.

---

## Demo Credentials

All demo accounts use the password `Admin@123`.

| Role | Email |
|---|---|
| Administrator | admin@system.com |
| Supervisor | supervisor@system.com |
| Support Agent | agent1@system.com |
| Support Agent | agent2@system.com |
| Customer | customer@system.com |
| Quality Team | quality@system.com |

The database is pre-seeded with 5 sample complaints across different statuses and priorities.

---

## Phase 2 — ETL Analytics

Phase 2 extends the platform with an ETL-powered analytics layer. A Python/Pandas pipeline extracts 220 complaint records from a CSV dataset, transforms and validates the data, and loads aggregated statistics into 6 new SQLite tables. A dedicated **ETL Analytics** dashboard surfaces these insights for admin, supervisor, and quality roles.

---

### What's New in Phase 2

- **Python ETL Pipeline** — 3-stage Extract → Transform → Load pipeline with full error handling and run logging
- **220-record Dataset** — Realistic 2024 complaint dataset spanning all 12 months with categories, priorities, agents, regions, and SLA data
- **6 Analytics Tables** — Pre-aggregated reporting tables populated by the ETL pipeline
- **7 New API Endpoints** — `/api/analytics/*` serving ETL-powered data
- **4-Tab Analytics Dashboard** — Overview, SLA Analysis, Category Breakdown, Agent Performance

---

### Phase 2 Tech Stack

| Component | Technology |
|---|---|
| ETL Pipeline | Python 3.8+, Pandas 2.x |
| ETL Storage | SQLite (6 new analytics tables via `load.py`) |
| Analytics API | Node.js / Express (`backend/src/routes/analytics.js`) |
| Analytics UI | React 18, Recharts (line, bar, pie charts) |
| Dataset | CSV — 220 records, 14 columns |

---

### Running the ETL Pipeline

**Prerequisites:** Python 3.8+ installed globally.

**Step 1 — Install Python dependencies** (one time):
```
cd etl
pip install -r requirements.txt
```

**Step 2 — Run the pipeline:**
```
python run_etl.py
```

Expected output:
```
====================================================
  Customer Complaint ETL Pipeline Starting...
====================================================

[Step 1/3] Extracting data from CSV...
[Extract] Loaded 220 rows, 14 columns

[Step 2/3] Transforming and validating data...
[Transform] 220 raw rows -> 220 clean rows

[Step 3/3] Loading data into SQLite analytics tables...
[Load] Inserted 220 rows into analytics_complaints.
[Load] All aggregated analytics tables populated.

  ETL Pipeline Complete!  Status: SUCCESS
====================================================
```

**Step 3 — Start the app:**
```powershell
cd ..
.\start.ps1
```

**Step 4 — Open Analytics:**
Log in as admin, supervisor, or quality role → click **ETL Analytics** in the sidebar.

---

### Analytics Dashboard Features

| Tab | Charts & Data |
|---|---|
| **Overview** | 4 summary stat cards · Monthly trends line chart (total/resolved/escalated) · Region pie chart + table |
| **SLA Analysis** | Overall compliance banner with visual bar · Per-priority cards (breach rate, avg resolution) · Stacked bar chart by priority |
| **Category Breakdown** | Top 3 category cards · Horizontal bar chart · Full category table with ratings |
| **Agent Performance** | Top 3 agent cards · Grouped bar chart · Full agent table with resolution rates and ratings |

---

### Phase 2 API Endpoints

All endpoints require `Authorization: Bearer <token>` and role `admin`, `supervisor`, or `quality` (except `/etl-log` which requires `admin`).

| Endpoint | Description |
|---|---|
| `GET /api/analytics/summary` | Overall ETL dataset summary + last ETL run info |
| `GET /api/analytics/sla-report` | SLA breach stats by priority (overall + per-priority breakdown) |
| `GET /api/analytics/category-stats` | Complaint volume and resolution metrics per category |
| `GET /api/analytics/agent-performance` | Resolution rates, avg resolution time, feedback scores per agent |
| `GET /api/analytics/monthly-trends` | Month-by-month complaint and resolution counts for 2024 |
| `GET /api/analytics/region-stats` | Complaint volume and breach count by customer region |
| `GET /api/analytics/etl-log` | ETL run history — last 20 executions (admin only) |

---

### Phase 2 Database Tables

| Table | Populated by | Purpose |
|---|---|---|
| `etl_run_log` | `run_etl.py` | Log of every ETL execution (status, row counts, errors) |
| `analytics_complaints` | `load.py` | Full row-level clean complaint records from ETL |
| `analytics_sla_report` | `load.py` | SLA compliance aggregated by priority |
| `analytics_category_stats` | `load.py` | Complaint metrics aggregated by category |
| `analytics_agent_performance` | `load.py` | Agent-level resolution and performance metrics |
| `analytics_monthly_trends` | `load.py` | Monthly time-series data for 2024 |

---

## Future Enhancements

- AI-based complaint categorization and routing
- Sentiment analysis on complaint descriptions
- Chatbot / virtual assistant integration
- Mobile application (iOS / Android)
- WhatsApp and SMS notification channels
- Social media complaint ingestion
- Predictive analytics for SLA breach forecasting
- Voice complaint registration
- Multi-language support
