# CETP 360° — College Event Management System

A centralized event management platform for managing college technical and arts events, including event discovery, participant registration, payment verification, coordinator management, and registration tracking.

The platform is designed to bring all college events into one place while simplifying registration and on-site event management for students, coordinators, and administrators.

## Overview

CETP 360° is built for college-level events such as:

* **Yukthix Techfest**
* **Vaaga Intra-College Arts**
* Technical competitions
* Arts and cultural events
* Workshops and other campus activities

Students can browse available events, register individually or as teams, submit payment proof, and receive registration information.

Administrators and coordinators can manage events, verify registrations, monitor participants, and export registration data.

## Features

### Student

* Browse all available events
* View individual event details
* Register for events
* Support for individual and team registrations
* Upload payment proof
* Receive registration confirmation
* View registration details
* QR-based participation/attendance identification

### Administrator

* Secure admin dashboard
* Create and manage events
* Manage event categories
* View all registrations
* View participant details
* Verify payment submissions
* Manage coordinators
* Export registration data to Excel
* Monitor registrations across all events

### Faculty Coordinator

Faculty coordinators can manage registrations and participants assigned to their responsibilities.

* View registered participants
* Verify registrations
* Monitor event participation
* Access registration information
* Export relevant registration data

### Student Coordinator

Student coordinators have restricted operational access.

* View assigned registrations
* Verify participants during on-site registration
* Scan/check participant QR codes
* Mark attendance
* Access only the information required for their assigned responsibilities

### Event Manager

Each event can have an event-specific manager with access restricted to that event.

* View registrations for the assigned event
* Verify participants
* Manage event-specific information
* Assist with on-site registration and attendance

## Registration Flow

```text
Student
   │
   ▼
Browse Events
   │
   ▼
Select Event
   │
   ▼
Registration Form
   │
   ├── Individual Registration
   │
   └── Team Registration
   │
   ▼
Payment via UPI
   │
   ▼
Upload Payment Screenshot
   │
   ▼
Registration Submitted
   │
   ▼
Coordinator/Admin Verification
   │
   ▼
Registration Confirmed
   │
   ▼
QR / Registration ID
   │
   ▼
On-site Verification
   │
   ▼
Attendance
```

## Technology Stack

### Frontend

* React
* Vite
* JavaScript
* CSS

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose

### File Storage

* Cloudinary

Payment screenshots and other required uploaded files are stored using Cloudinary rather than directly inside the application server.

### Deployment

The application is designed to use:

* **Vercel** — Frontend hosting
* **Railway** — Backend/API hosting
* **MongoDB Atlas** — Database
* **Cloudinary** — Image/file storage

## System Architecture

```text
                    ┌─────────────────────┐
                    │      Students       │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Frontend       │
                    │       React         │
                    │       Vite          │
                    └──────────┬──────────┘
                               │
                            REST API
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Backend       │
                    │   Node.js/Express   │
                    └──────┬───────┬──────┘
                           │       │
                ┌──────────┘       └──────────┐
                ▼                             ▼
       ┌─────────────────┐          ┌─────────────────┐
       │   MongoDB Atlas │          │    Cloudinary   │
       │                 │          │                 │
       │ Users           │          │ Payment Proofs  │
       │ Events          │          │ Event Images    │
       │ Registrations   │          │ Uploads         │
       │ Coordinators    │          └─────────────────┘
       └─────────────────┘
```

## Project Structure

```text
college-event-management/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── uploads/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

> The exact directory structure may evolve as additional modules are implemented.

## Core Data Models

The backend is designed around the following major entities.

### User

Represents authenticated users and their roles.

```text
User
├── name
├── email / phone
├── role
├── password / authentication data
└── status
```

Possible roles include:

```text
ADMIN
FACULTY_COORDINATOR
STUDENT_COORDINATOR
EVENT_MANAGER
PARTICIPANT
```

### Event

```text
Event
├── name
├── category
├── description
├── venue
├── date
├── time
├── registration deadline
├── registration fee
├── team configuration
├── rules
├── coordinator
└── status
```

### Registration

```text
Registration
├── registration ID
├── event
├── participant/team
├── payment status
├── payment proof
├── verification status
├── QR code
├── attendance status
└── timestamps
```

### Team

For team-based events:

```text
Team
├── team name
├── team leader
├── members
├── event
└── registration
```

## Role-Based Access Control

Access is restricted according to the user's role.

| Role                | Access                                       |
| ------------------- | -------------------------------------------- |
| Admin               | Full system access                           |
| Faculty Coordinator | Assigned management functions                |
| Student Coordinator | On-site verification and assigned operations |
| Event Manager       | Assigned event only                          |
| Participant         | Events and own registrations                 |

This prevents event-specific coordinators from accessing unrelated event data.

## Payment System

The initial version does not use an online payment gateway.

The payment process is:

```text
Student
   │
   ▼
Display Event UPI QR
   │
   ▼
Student makes UPI payment
   │
   ▼
Student uploads payment screenshot
   │
   ▼
Backend stores image through Cloudinary
   │
   ▼
Coordinator/Admin verifies payment
```

This approach keeps the initial system simple and reduces payment-gateway integration requirements.

## QR-Based Attendance

Each confirmed registration can be associated with a unique QR code.

For team registrations, the system can maintain:

```text
Team Registration
       │
       ├── Member 1 → QR
       ├── Member 2 → QR
       ├── Member 3 → QR
       └── Member 4 → QR
```

This allows individual attendance to be tracked while maintaining the relationship between team members.

## Environment Variables

Create a `.env` file in the backend directory.

Example:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

JWT_SECRET=your_jwt_secret

FRONTEND_URL=http://localhost:5173
```

Never commit `.env` files or production credentials to Git.

## Local Development

### 1. Clone the repository

```bash
git clone <repository-url>
cd college-event-management
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create:

```text
backend/.env
```

and add the required MongoDB, Cloudinary, authentication, and application configuration.

### 4. Start the backend

```bash
npm run dev
```

The backend will normally run on:

```text
http://localhost:5000
```

### 5. Install frontend dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

## API Structure

The backend follows a REST API architecture.

Example endpoint groups:

```text
/api/auth
/api/events
/api/registrations
/api/users
/api/coordinators
/api/attendance
/api/admin
```

Example requests:

```text
GET    /api/events
GET    /api/events/:id

POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id

POST   /api/registrations
GET    /api/registrations/:id

POST   /api/registrations/:id/payment
POST   /api/registrations/:id/verify

POST   /api/attendance/scan
```

The exact endpoints may change as the backend implementation evolves.

## Security

The application should follow these principles:

* Passwords must never be stored in plain text.
* Authentication credentials must be stored securely.
* JWT/session secrets must remain server-side.
* MongoDB credentials must never be exposed to the frontend.
* Cloudinary API secrets must remain server-side.
* Role-based authorization must be enforced on the backend.
* Users must not be able to access registrations belonging to unauthorized events.
* Uploaded files should be validated before processing.
* Sensitive API routes should require authentication and authorization.

## Deployment

### Frontend

The React frontend can be deployed using Vercel.

Build command:

```bash
npm run build
```

The production frontend should use the deployed backend URL through an environment variable.

Example:

```env
VITE_API_URL=https://your-backend-domain
```

### Backend

The Express backend can be deployed on Railway.

Production environment variables must be configured through Railway rather than committing them to the repository.

### Database

MongoDB Atlas is used as the production database.

### File Storage

Cloudinary is used for uploaded images such as:

* Payment screenshots
* Event banners
* Participant-related uploads where required

## Development Priorities

The project is being developed in phases.

### Phase 1 — MVP

* Event listing
* Event details
* Registration
* Individual/team registration
* Payment QR
* Payment screenshot upload
* Admin dashboard
* Registration management
* Coordinator access
* Excel export
* Basic QR-based verification

### Phase 2

* Advanced attendance management
* Improved coordinator workflows
* Event-specific manager dashboard
* Registration analytics
* Better validation and security
* Automated notifications

### Phase 3

* E-certificates
* Certificate generation
* Automated certificate distribution
* Advanced event analytics
* Additional automation

## Future Improvements

Possible future additions include:

* Automated email/WhatsApp notifications
* Live registration counters
* Real-time event capacity tracking
* Certificate verification
* Public certificate validation
* Advanced analytics dashboard
* QR-based venue entry
* Participant feedback
* Event scheduling
* Announcement system

## Contributing

This project is primarily developed for the college event ecosystem.

For development:

1. Create a feature branch.
2. Implement and test the feature.
3. Verify both frontend and backend integration.
4. Ensure environment variables and secrets are not committed.
5. Create a pull request for review.

## License

This project is developed for college event management purposes.

License information can be added here when the project's licensing decision is finalized.

---

## Project Status

**Current status:** Active Development

The initial focus is on delivering a reliable MVP for event registration, payment verification, participant management, and coordinator operations before adding secondary features such as e-certificates and advanced analytics.
