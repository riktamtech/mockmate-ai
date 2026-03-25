# MockMate-AI Global Theme Overhaul

Complete theme system overhaul replacing the current partial dark/light implementation (with bluish-black dark mode backgrounds) with a production-grade CSS custom properties token system. Light mode becomes the default. Dark mode switches to a pure deep-black palette.

## User Review Required

> [!IMPORTANT]
> **Default theme change**: The default theme will switch from `dark` to `light`. Existing users with no stored preference will see light mode on their next visit. Users who previously selected a theme will keep their preference (persisted in localStorage).

> [!IMPORTANT]
> **Approach choice**: Rather than converting all inline [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#55-58) ternaries to CSS custom properties (which would require rewriting 40+ components' JSX), we'll use a **hybrid approach**:
>
> 1. Add CSS custom properties for ALL token values in [index.css](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.css) (source of truth)
> 2. Create a **`useTheme()` helper** that returns token values from CSS vars, which components can use via inline styles
> 3. Gradually replace inline ternaries with CSS var references — prioritizing layout and shared components
> 4. Components that already use Tailwind classes will get `dark:` variant classes added
>
> This minimizes risk of breaking changes while establishing the proper foundation.

## Proposed Changes

### Theme Token System (Foundation)

#### [MODIFY] [index.html](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.html)

- Add Tailwind CDN config for `darkMode: 'class'` and extend color palette
- Update base `<style>` block: body colors use CSS vars, themed scrollbar, selection color
- Add `prefers-color-scheme` initial class setter before React hydration

#### [MODIFY] [index.css](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.css)

- Add complete CSS custom property token system at the top:
  - `:root` (light mode) and `.dark` (dark mode) blocks
  - Tokens: `--bg-base`, `--bg-surface`, `--bg-elevated`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-glow`, `--shadow-card`, etc.
- Light palette: `#ffffff` / `#fafafa` / `#f4f4f5` surfaces, `#e4e4e7` borders, `#09090b` text
- Dark palette: `#0a0a0a` / `#111111` / `#1a1a1a` surfaces, `#2a2a2a` borders, `#f5f5f5` text
- Theme transition utilities for smooth toggle
- Themed scrollbar, skeleton shimmer animations, glassmorphism utilities

---

### Theme Store

#### [MODIFY] [useThemeStore.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js)

- Change default from `"dark"` to `"light"`
- Add `prefers-color-scheme` media query as fallback for first-time visitors
- Add `getToken(name)` utility that reads CSS custom properties

---

### Layout Components

#### [MODIFY] [AppLayout.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppLayout.jsx)

- Replace inline [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#55-58) background gradient with CSS var `var(--bg-base)`
- Add theme transition class

#### [MODIFY] [AppHeader.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppHeader.jsx)

- Replace all inline [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#55-58) ternary colors with CSS custom properties
- Use `var(--bg-surface)`, `var(--border)`, `var(--text-primary)`, etc.

#### [MODIFY] [AppSidebar.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/AppSidebar.jsx)

- Replace all inline [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#55-58) ternary colors with CSS vars
- Update backdrop, drawer background, nav items, borders

#### [MODIFY] [ThemeToggle.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/layout/ThemeToggle.jsx)

- Use CSS vars for button bg/border instead of inline ternaries

---

### Shared / Common Components

#### [MODIFY] [Button.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ui/Button.jsx)

- Add `dark:` Tailwind variants for all button variants
- Theme-aware focus ring offset

#### [MODIFY] [Auth.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Auth.jsx)

- Add [isDark](file:///Users/harshithprathi/Zinterview/mockmate-ai/store/useThemeStore.js#55-58) support throughout (currently light-only)
- Use CSS vars for backgrounds, borders, text, inputs

#### [MODIFY] [ForgotPassword.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ForgotPassword.jsx)

- Add dark mode support with CSS vars

#### [MODIFY] [ResetPassword.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ResetPassword.jsx)

- Add dark mode support with CSS vars

#### [MODIFY] [App.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/App.jsx)

- Update [LandingPage](file:///Users/harshithprathi/Zinterview/mockmate-ai/App.jsx#91-147) and [LazyFallback](file:///Users/harshithprathi/Zinterview/mockmate-ai/App.jsx#58-90) to use pure-black palette

---

### Page-Level Components

#### [MODIFY] [Dashboard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Dashboard.jsx)

- Update [DashboardHeader](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Dashboard.jsx#20-82) (currently light-only hardcoded)
- Update [ModeCard](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Dashboard.jsx#83-124) to use CSS vars instead of inline ternaries
- Update interview list cards, badges, empty states

#### [MODIFY] [Landing.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Landing.jsx)

- Add full dark mode support (currently entirely light-mode)
- Themed card hover effects, backgrounds, text

#### [MODIFY] [ProfileSetup.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProfileSetup.jsx)

- Add dark mode support throughout

#### [MODIFY] [UserProfile.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/UserProfile.jsx)

- Add dark mode support throughout

#### [MODIFY] [ProctoredInterviewBanner.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredInterviewBanner.jsx)

- Update to use CSS vars for themed surfaces

#### [MODIFY] [ProctoredInterviewInfo.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredInterviewInfo.jsx)

- Add dark mode support

#### [MODIFY] [ProctoredChatInterface.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredChatInterface.jsx)

- Add dark mode support

#### [MODIFY] [ProctoredReport.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ProctoredReport.jsx)

- Add dark mode support for report surfaces, charts

#### [MODIFY] [ChatInterface.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ChatInterface.jsx) / [ChatMessage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ChatMessage.jsx)

- Theme-aware chat bubbles, input area

#### [MODIFY] [CandidateSession.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/CandidateSession.jsx)

- Add dark mode support

#### [MODIFY] [FeedbackView.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/FeedbackView.jsx)

- Add dark mode support

#### [MODIFY] [ConsentModal.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ConsentModal.jsx)

- Themed modal surfaces with glassmorphism

#### [MODIFY] [SideDrawer.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/SideDrawer.jsx)

- Themed drawer surfaces

---

### Feature Components

#### [MODIFY] Jobs components (6 files in `components/jobs/`)

- [JobCard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobCard.jsx), [JobOpeningsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobOpeningsPage.jsx), [JobSearchAndFilters.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobSearchAndFilters.jsx), [JobDetailView.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobDetailView.jsx), [ApplicationForm.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ApplicationForm.jsx), [FitnessScoreDisplay.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/FitnessScoreDisplay.jsx), [LifecycleTracker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/LifecycleTracker.jsx), [ProctoredGate.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ProctoredGate.jsx), [ResumePicker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/ResumePicker.jsx), [SchedulingPicker.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/SchedulingPicker.jsx)
- Add dark mode variants

#### [MODIFY] [JobAnalyticsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/analytics/JobAnalyticsPage.jsx)

- Theme-aware chart colors, grid lines, tooltips

#### [MODIFY] [EventsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/events/EventsPage.jsx)

- Add dark mode support

#### [MODIFY] [NotificationsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/notifications/NotificationsPage.jsx) / [NotificationBell.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/notifications/NotificationBell.jsx)

- Theme-aware notification cards, badges

#### [MODIFY] Admin components (11 files in `components/Admin/`)

- [AdminDashboard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/AdminDashboard.jsx), [DashboardStats.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/DashboardStats.jsx), [InterviewDetailModal.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/InterviewDetailModal.jsx), [ProctoredFiltersBar.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ProctoredFiltersBar.jsx), [ProctoredInterviewsTable.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ProctoredInterviewsTable.jsx), [UserDetailsView.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/UserDetailsView.jsx), [UserListTable.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/UserListTable.jsx), [AdminProctoredReport.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/AdminProctoredReport.jsx), [ResumeViewerModal.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ResumeViewerModal.jsx), [ProctoredInterviewsStats.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/Admin/ProctoredInterviewsStats.jsx)
- Add dark mode support throughout

#### [MODIFY] [AdminDashboard.jsx (top-level)](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/AdminDashboard.jsx)

- Add dark mode support

---

### Other Components

#### [MODIFY] [AudioRecorder.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/AudioRecorder.jsx)

- Theme-aware recording UI

#### [MODIFY] [JDPaste.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/JDPaste.jsx)

- Theme-aware textarea and surface

#### [MODIFY] [ResumeUpload.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/ResumeUpload.jsx)

- Theme-aware upload dropzone

#### [MODIFY] [MenuButton.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/MenuButton.jsx)

- Theme-aware styling

## Verification Plan

### Browser Testing

Since there are no automated tests in this project, verification will be done via browser testing:

1. **Start dev server**: `cd /Users/harshithprathi/Zinterview/mockmate-ai && npm run dev`
2. **Light mode verification** (default):
   - Navigate to the landing page (`/mockmate`) — should render with clean white/gray palette
   - Check the Auth page (`/mockmate/login`) — white cards, proper borders
   - Log in and check Dashboard — proper light surfaces, shadows
3. **Dark mode verification**:
   - Toggle theme via the sun/moon button
   - Verify background is pure black (`#0a0a0a`), NOT bluish-black
   - Check cards use `#111111`/`#161616` surfaces
   - Check text is `#f5f5f5` primary, `#a3a3a3` secondary
   - Verify sidebar, header, modals all use consistent dark palette
4. **Theme toggle animation**:
   - Toggle back and forth — transitions should be smooth (200ms)
   - No layout shift on toggle
5. **Responsiveness**:
   - Test at mobile (375px), tablet (768px), desktop (1280px) widths in both themes
6. **Persistence**:
   - Refresh page — theme should persist from localStorage
   - Clear localStorage — should default to light mode

### Manual Verification (User)

- Please verify the overall visual quality after the changes are applied
- Test any pages behind authentication that require real credentials
