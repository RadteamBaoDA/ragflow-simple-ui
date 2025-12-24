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
- `fe/`: Frontend application (React + Vite).


## 3. Build Instructions

1. **Install Dependencies**:
   ```bash
   npm run build
   ```


## 4 Coding Standards & Guidelines
-  when add new page must implement locale for new html string in en, vi, jp 
- Always check and add theme(dark and light) for new html control
- terminal using is git bash(linux command)