# Copilot Instructions for PeerRate MVP

## Project Overview
- **Architecture:**
  - Monorepo with `frontend/` (HTML/CSS/JS), `backend/` (Node.js), and `prisma/` (SQL migrations/schema).
  - Data flows from frontend forms to backend API endpoints, with persistent storage in JSON files and a Prisma-managed database.
  - Key service boundaries: `frontend` (user/admin UI), `backend` (API logic), `prisma` (DB schema/migrations).

## Developer Workflows
- **Backend:**
  - Main entry: `backend/server.js` (Node.js/Express-style API).
  - Data is stored in `backend/ratings.json` and `data/ratings.json`.
  - No build step; run with `node backend/server.js`.
- **Frontend:**
  - Static HTML/JS/CSS in `frontend/`.
  - Main logic in `frontend/script.js` (handles auth, API calls, UI updates).
  - No build step; served as static files.
- **Database:**
  - Prisma schema in `prisma/schema.prisma`.
  - Migrations in `prisma/migrations/`.
  - SQL checks in `prisma/check_rating.sql`, `prisma/check_report.sql`.

## Patterns & Conventions
- **API Communication:**
  - Frontend uses `fetch` to communicate with backend endpoints (e.g., `/api/ratings`, `/api/customers`).
  - Admin endpoints require an `x-admin-key` header (see `frontend/script.js`).
- **Auth:**
  - Simple client-side auth via `localStorage` (`peerRateUser` key).
  - Admin auth uses a password stored in `localStorage` (`peerRateAdminKey`).
- **Profile Images:**
  - Stored as data URLs in `localStorage` (`peerRateAvatar`).
- **Reporting:**
  - Ratings can include a report payload with files (max 3, <2MB each, base64-encoded in localStorage).
- **Frontend UI:**
  - DOM manipulation and event handling are done directly in JS (no framework).
  - UI state (login/profile/admin) is managed by toggling CSS classes and updating DOM elements.

## Integration Points
- **Prisma:**
  - Database schema and migrations managed in `prisma/`.
  - Backend may interact with DB via Prisma (not shown in provided files).
- **External Data:**
  - Demo endpoint `/api/profile/external-demo` for fetching external profile data.

## Examples
- **API Helper:** See `api` object in `frontend/script.js` for request patterns.
- **Admin Auth:** See `adminFetch` in `frontend/script.js` for header usage.
- **Profile Refresh:** See `refreshProfile()` for data aggregation and UI update.

## Recommendations for AI Agents
- When adding new API endpoints, update both backend and frontend helpers.
- Follow the localStorage-based auth pattern for user/admin state.
- Use direct DOM manipulation for UI changes; avoid frameworks unless refactoring.
- Place new migrations in `prisma/migrations/` and update `schema.prisma` as needed.
- Keep static assets in `frontend/` and backend logic in `backend/`.

---
If any section is unclear or missing details, please specify which workflows, patterns, or integration points need further documentation.