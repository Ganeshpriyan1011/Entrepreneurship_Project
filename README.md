# Secure Azure Storage App

A secure full-stack cloud storage web application with client-side encryption.

- Frontend: React + TypeScript (Vite)
- Backend: Express + TypeScript
- Storage: Azure Blob Storage (SAS URLs)
- Database: Azure Table Storage

## Quick start

1) Copy envs
- Copy `.env.example` to `.env` at the repo root and fill values.
- Optionally also copy to `backend/.env` and `frontend/.env` if you prefer per-package files.

2) Install deps
- Backend: `cd backend && npm install`
- Frontend: `cd frontend && npm install`

3) Run locally
- Backend: `npm run dev` (on port `$PORT`, default 4000)
- Frontend: `npm run dev` (Vite dev server, default 5173)

4) Azure setup
- Create a Storage Account with both Blob and Table services enabled.
- Create a Blob Container for file storage.
- Enable CORS for your frontend origin on the Blob service.
- The app will automatically create required Tables (Users, Files) on startup.
- Use connection string or account name/key for authentication.

## Security model
- All encryption/decryption happens in the browser using Web Crypto API (AES-GCM).
- Keys are derived with PBKDF2 from user-supplied password (zero-knowledge: password never leaves client).
- Server stores only file metadata and issues short-lived SAS URLs for upload/download.

## Scripts
See `frontend/package.json` and `backend/package.json` for scripts.
