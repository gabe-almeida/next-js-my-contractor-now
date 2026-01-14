---
active: true
iteration: 1
max_iterations: 30
completion_promise: "ADMIN_UI_FULL_DRY_CONSISTENT_DONE"
started_at: "2026-01-14T00:10:39Z"
---

In this repo, audit and upgrade the My Contractor Now Admin UI so it is production-ready, fully consistent, DRY, and visually polished.

SCOPE (IMPORTANT):
- This task is NOT on the Linux server.
- This is purely for the My Contractor Now Admin UI codebase.
- You MUST review ALL admin routes, including but not limited to:
  - /admin
  - /admin/buyers
  - /admin/buyers/[id] (buyer detail pages)
  - any nested admin subpages, tabs, or detail views
- Every admin page must use the SAME shared, reusable UI components and styling system.

PRIMARY GOALS:
1) FULL DRY UI CONSISTENCY:
   - Every Admin UI page (lists, detail views, edit forms, dashboards) must use imported, reusable UI components.
   - No page-specific, ad-hoc UI patterns.
   - No duplicated layout, spacing, table, or form code.
   - Buyer list pages and buyer detail pages MUST use the same table, card, header, and layout primitives as the rest of Admin.

2) VISUAL CONSISTENCY WITH LEAD MANAGEMENT:
   - Match the Lead Management page exactly:
     - modern orange accent styling
     - same typography scale
     - same spacing system
     - same button, input, table, badge, and card variants
   - All Admin pages should feel like ONE cohesive product.

3) ZERO MOCK DATA ANYWHERE:
   - No mock arrays, fixtures, placeholder users, fake buyers, fake stats.
   - No commented-out mock code.
   - All pages must load real data or show clean, intentional empty/loading/error states.
   - Buyer detail pages must reflect real API data only.

4) AUTH BEARER HEADER CORRECTNESS:
   - Ensure Authorization: Bearer <token> is attached to EVERY relevant Admin API call.
   - This must be centralized in ONE shared API client (no raw fetch scattered across pages).
   - Verify buyers list, buyer detail pages, and all admin subpages are covered.
   - Ensure behavior is production-safe (no dev-only bypass logic).

5) UI POLISH & UX QUALITY:
   - Consistent margins, padding, gutters, and alignment across all Admin pages.
   - Consistent loading, empty, and error states.
   - No layout shifts, broken grids, misaligned headers, or inconsistent colors.
   - Buyer detail pages should feel intentionally designed (sections, spacing, hierarchy).

REQUIRED PROCESS (DO NOT GUESS):
A) FULL ADMIN INVENTORY:
   - Enumerate EVERY Admin route, including buyers list + buyer detail pages.
   - For each page, list:
     - UI components used
     - API calls made
     - Whether mock data exists
     - Styling inconsistencies vs Lead Management

B) COMPONENT SYSTEM STANDARDIZATION:
   - Identify the shared components used by Lead Management.
   - Create or standardize a shared Admin UI system:
     - AdminShell (nav + header + content container)
     - PageHeader (title, subtitle, actions)
     - DataTable wrapper (loading/empty/error built-in)
     - DetailPage layout (for buyer detail, etc.)
     - Card, Section, Divider primitives
     - FormSection + FieldRow
     - Button / Input / Select variants
     - Badge, StatusPill, Modal/Drawer, Toast
   - Replace ALL ad-hoc UI with these shared components.

C) BUYERS PAGES SPECIFICALLY:
   - /admin/buyers must use the shared DataTable + PageHeader.
   - Buyer detail pages must use shared detail-page layout components.
   - Remove any custom one-off styling or duplicated markup.
   - Ensure consistency with other admin detail pages.

D) REMOVE MOCK DATA:
   - Delete mock arrays and placeholder rows.
   - Replace with real API integrations.
   - If an API is missing, fail loudly in dev and show a clean “No data / Not configured” UI (NOT fake data).

E) AUTH VERIFICATION:
   - Confirm ALL admin pages (including buyers + buyer detail) use the shared API client.
   - Confirm Authorization header is present on every protected request.
   - Add consistent 401/403 handling (redirect or access-denied UI).

F) GUARDRAILS:
   - Add lint/check or simple script to prevent:
     - raw fetch usage in admin pages
     - reintroduction of mock data
   - Optional: snapshot or component test for AdminShell + buyer pages.

DELIVERABLES:
- Fully refactored Admin UI using shared, DRY components.
- Buyers list + buyer detail pages fully aligned with Admin + Lead Management UI.
- No mock data anywhere in Admin.
- Centralized API client with correct bearer auth everywhere.
- A short write-up (ADMIN_UI_AUDIT.md) describing:
  - pages audited (including buyers + detail)
  - components standardized
  - mock data removed
  - auth enforcement approach
  - any REAL backend gaps (no fake UI workarounds).

DONE CONDITION:
When ALL Admin pages (including /admin/buyers and buyer detail pages) are consistent, DRY, authenticated, mock-free, and visually polished, output exactly:
<promise>ADMIN_UI_FULL_DRY_CONSISTENT_DONE</promise>
