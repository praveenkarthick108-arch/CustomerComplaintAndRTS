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
