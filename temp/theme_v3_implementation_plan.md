# MockMate-AI Global Theme Overhaul

Complete theme overhaul to make every UI component theme-aware using CSS custom properties. Light mode is the default. Dark mode uses a pure deep-black palette (not bluish).

## Current State

The codebase already has a solid foundation:
- **Token system** in [index.css](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.css) with `:root` (light) and `.dark` (dark) CSS custom properties
- **Theme store** via Zustand ([useThemeStore.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js)) with localStorage persistence and `prefers-color-scheme` fallback
- **Layout components** ([AppHeader](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppHeader.jsx#15-111), [AppSidebar](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppSidebar.jsx#29-248)) already mostly use CSS vars

**Problems to fix:**
1. ~27 component files contain hardcoded hex colors (e.g. `#8B5CF6`, `#EF4444`, `#f1f1f4`)
2. Several components use `rgba(255,255,255,...)` patterns that only look correct on dark backgrounds
3. Some components use [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#63-66) ternary patterns in JSX instead of CSS vars
4. Missing tokens for notification, glassmorphism, and component-specific surfaces

## Proposed Changes

### Token System Enhancement

#### [MODIFY] [index.css](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.css)

Add new theme tokens for both `:root` and `.dark`:
- `--bg-glass` — glassmorphism surface for dropdowns/popovers
- `--bg-glass-border` — border for glass surfaces
- `--bg-notification-unread` — unread notification background
- `--bg-notification-read` — read notification background
- `--notification-border-unread` / `--notification-border-read`
- `--text-heading` — for prominent headings (same as primary but semantic)
- `--badge-new-bg` — "NEW" badge gradient
- `--spinner-track` / `--spinner-fill` — loading spinners
- Add `@media (prefers-color-scheme: dark)` block before `.dark` for pre-JS fallback
- Add Tailwind dark-mode overrides for any newly discovered gaps
- Remove hardcoded values in existing overrides (e.g. `.dark .bg-slate-200` uses `#1a1a1a`)

---

### Notification Components (Complete Rewrite of Colors)

#### [MODIFY] [NotificationBell.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/notifications/NotificationBell.jsx)

Replace all inline hardcoded colors:
- Bell button color: `rgba(255,255,255,0.6)` → `var(--text-muted)`
- Badge bg: `#EF4444` → `var(--error)`
- Panel bg: `rgba(25,25,40,0.95)` → `var(--bg-glass)`
- Panel border: `rgba(255,255,255,0.08)` → `var(--bg-glass-border)`
- Header text: `#f1f1f4` → `var(--text-primary)`
- Dividers: `rgba(255,255,255,0.06)` → `var(--border-subtle)`
- Accent links: `rgba(139,92,246,0.8)` → `var(--accent-text)`
- Empty state text: `rgba(255,255,255,0.3)` → `var(--text-muted)`
- Notification title/body colors → `var(--text-primary)` and `var(--text-muted)`
- Timestamp: `rgba(255,255,255,0.25)` → `var(--text-muted)`
- Unread dot: `#8B5CF6` → `var(--accent)`

#### [MODIFY] [NotificationsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/notifications/NotificationsPage.jsx)

Replace all hardcoded colors with CSS vars following the same pattern as above. Fix the back button, heading, badges, notification cards, spinners, and empty state.

---

### Analytics & Events

#### [MODIFY] [JobAnalyticsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/analytics/JobAnalyticsPage.jsx)

Replace page background, card backgrounds, borders, text colors, tab backgrounds, and stat containers with theme tokens. Keep accent color hex values for chart data series (these are semantic/data colors, not surface colors).

#### [MODIFY] [EventsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/events/EventsPage.jsx)

Replace card backgrounds, tab controls, and surface colors with theme tokens.

---

### Layout Components (Minor Refinements)

#### [MODIFY] [AppSidebar.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppSidebar.jsx)

- Replace `#f59e0b` icon color for badged items → `var(--warning)`
- Replace hardcoded badge gradient → `var(--badge-new-bg)`

---

### Shared Components

#### [MODIFY] [ConsentModal.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ConsentModal.jsx)
#### [MODIFY] [SideDrawer.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/SideDrawer.jsx)
#### [MODIFY] [ChatInterface.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ChatInterface.jsx)
#### [MODIFY] [Auth.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Auth.jsx)
#### [MODIFY] [Dashboard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Dashboard.jsx)
#### [MODIFY] [Landing.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Landing.jsx)

Replace hardcoded hex colors with CSS vars. Remove unused [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#63-66) state where no longer needed.

---

### Job Components

#### [MODIFY] [JobCard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobCard.jsx)
#### [MODIFY] [JobDetailView.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobDetailView.jsx)
#### [MODIFY] [JobSearchAndFilters.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobSearchAndFilters.jsx)
#### [MODIFY] [LifecycleTracker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/LifecycleTracker.jsx)
#### [MODIFY] [ApplicationForm.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ApplicationForm.jsx)
#### [MODIFY] [FitnessScoreDisplay.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/FitnessScoreDisplay.jsx)
#### [MODIFY] [ProctoredGate.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ProctoredGate.jsx)
#### [MODIFY] [ResumePicker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ResumePicker.jsx)
#### [MODIFY] [SchedulingPicker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/SchedulingPicker.jsx)

Replace hardcoded hex/rgba colors with theme tokens.

---

### Admin Components

#### [MODIFY] [AdminDashboard.jsx (Admin)](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/AdminDashboard.jsx)
#### [MODIFY] [DashboardStats.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/DashboardStats.jsx)
#### [MODIFY] [ProctoredFiltersBar.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ProctoredFiltersBar.jsx)
#### [MODIFY] [ProctoredInterviewsTable.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ProctoredInterviewsTable.jsx)
#### [MODIFY] [AdminProctoredReport.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/AdminProctoredReport.jsx)

Replace all hardcoded colors with theme tokens.

---

### Large Interview/Report Components

#### [MODIFY] [ProctoredReport.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredReport.jsx)
#### [MODIFY] [ProctoredChatInterface.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredChatInterface.jsx)
#### [MODIFY] [ProctoredInterviewBanner.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredInterviewBanner.jsx)
#### [MODIFY] [ProctoredInterviewInfo.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredInterviewInfo.jsx)
#### [MODIFY] [AudioRecorder.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/AudioRecorder.jsx)
#### [MODIFY] [CandidateSession.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/CandidateSession.jsx)
#### [MODIFY] [ProfileSetup.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProfileSetup.jsx)
#### [MODIFY] [UserProfile.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/UserProfile.jsx)

Replace all hardcoded colors with theme tokens.

## Verification Plan

### Automated Verification
- Run `grep -rn "#[0-9a-fA-F]\{6\}" components/ --include="*.jsx"` and verify only intentional data-series/accent colors remain (not surface colors)
- Run `npm run build` to confirm no compile errors

### Browser Testing
- Open the app in browser, toggle between light and dark modes on:
  1. Landing page
  2. Dashboard
  3. Notifications page
  4. Job openings page
  5. Analytics page
  6. Admin panel (if accessible)
- Verify no white-on-white or black-on-black text
- Verify cards/surfaces have visible borders and correct backgrounds in both modes

### Manual Verification
- The user should visually inspect key pages in both themes after changes are complete, toggling the theme toggle
