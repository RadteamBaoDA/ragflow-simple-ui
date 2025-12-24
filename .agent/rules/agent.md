---
trigger: always_on
---

# RAGFlow Project Instructions for Google Antigravity
This file provides context, build instructions, and coding standards for the RAGFlow Simple UI.


## 1. Project Overview
RAGFlow Simple UI is an opensource UI centrailze and manage AI Search and Chat and Knowledge base in one repo, backend is using nodejs and frontend is reactjs.

- **Backend**: Nodejs 22+ (ExpressJS)
- **Frontend**: TypeScript, React, vite
- **Architecture**: One repo for backend and front end
  - `be/`: Backend API server.
  - `fe/`: Frontend application.

## 2. Directory Structure
- `be/`: Backend API server (reactjs).
    src/
        ├── config/             # Environment-specific configuration and secrets management
        ├── db/                 # database providers and migration
        ├── controllers/        # handles incoming requests and calls appropriate services. It is responsible for request/response logic.
        ├── middlewares/        # Express middleware (auth, logging, error handling)
        ├── models/             # Defines data schemas and interacts directly with the database(postgres, redis, etc) and external service(langfuse, minio, etc). In this folder apply Factory Pattern to design all data schemas and interfaces.
        ├── routes/             # Express routes (API endpoints)
        ├── scripts/            # scripts for one time tasks
        ├── services/           # Business logic, the core application code
        ├── types/              # Global/shared TypeScript definitions
        └── utils/              # General utility functions (helpers, formatters)
- `fe/`: Frontend application (React + Vite).
      src/
        ├── app/                # Application entry points, global providers, and router
        ├── assets/             # Static files (images, fonts, global styles)
        ├── components/         # Shared UI components (Atomic design: buttons, inputs)
        ├── constants/          # Global constants, enums, and configuration
        ├── features/           # Domain-driven modules (the core business logic)
        ├── hooks/              # Global reusable hooks (useAuth, useLocalStorage)
        ├── layouts/            # Page shell wrappers (Admin, Auth, Public)
        ├── lib/                # Config for 3rd party libraries (Axios, React Query)
        ├── services/           # Global singletons (Analytics, Logging)
        ├── store/              # Global state management (Zustand, Redux)
        ├── types/              # Global/shared TypeScript definitions
        └── utils/              # Pure utility helper functions

## 3. Build Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   npm run build
   ```


## 4 Coding Standards & Guidelines
1. General
- terminal using is git bash(linux command). If change too much need run : npm run build 

2. FE 
- when add new page must implement locales for new html string in en, vi, jp.
- Always check and add theme(dark and light) for new html control or new pages
- The "Public API" Rule (Barrel Files): Avoid "deep imports" that reach into the internals of another feature.
- Component Colocation: Keep files as close to their usage as possible.
- UI Layer: Uses ref as a prop directly.
- Feature Layer: Implements useActionState and useFormStatus.
- Service Layer: Optimized for the use hook and Server Actions.

3. BE
- Nodejs 22+ (ExpressJS)
- Implement Factory Pattern to design all data schemas and interfaces.
- Implement Singleton Pattern to design all global services and utils in be.
- If change or create impact to database, must create migration file in be/db/migrations.