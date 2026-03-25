# Job Openings Page — Full Redesign & Bug Fixes

Comprehensive redesign of the Active Job Openings page with enhanced UI/UX (inspired by the provided designs), full filter implementation, bug fixes, and theme support.

## User Review Required

> [!IMPORTANT]
> **Location filter**: The plan implements a cascading Country → State → City dropdown using a local JSON data file for India (states/cities). This avoids external API dependencies but means the location data is static. Is this acceptable, or would you prefer an API-based approach?

> [!IMPORTANT]
> **"Applied", "Saved", "Needs Interview" filters**: These require the backend to cross-reference the `job_applications` collection for the current user. This adds query complexity. The plan aggregates these as query filter parameters sent to `GET /api/jobs`.

## Proposed Changes

### Backend — New Endpoints & Filter Logic

#### [MODIFY] [jobOpeningsController.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/backend/controllers/jobOpeningsController.js)

- **Experience filter rewrite**: Instead of parsing `"0-2"` strings, accept `minExp` and `maxExp` as separate query params. Support single value mode (where `minExp === maxExp`) to find all openings whose range overlaps with the given value.
- **New filters**: `applied`, `saved`, `needsInterview`, `interviewInProgress`, `interviewCompleted` — these will join with `JobApplication` collection for the current user.
- **New endpoint `getOrganisations`**: Returns distinct `orgName` values from enabled job openings.
- **New endpoint `getLocations`**: Returns distinct `location` values from enabled job openings.

#### [MODIFY] [jobRoutes.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/backend/routes/jobRoutes.js)

- Add `GET /api/jobs/meta/organisations` endpoint
- Add `GET /api/jobs/meta/locations` endpoint

---

### Frontend — Service & Hook Layer

#### [MODIFY] [jobService.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/services/jobService.js)

- Add `getOrganisations()` method
- Add `getLocations()` method
- Update [getJobOpenings()](file:///Users/harshithprathi/Zinterview/mockmate-ai/services/jobService.js#13-35) params to include `minExp`, `maxExp`, `applied`, `needsInterview`, `interviewInProgress`, `interviewCompleted`

#### [MODIFY] [useJobs.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/hooks/useJobs.js)

- Expand filter state to include all new filter keys
- Experience stored as `{ min: number, max: number }` object
- All filter changes reset cursor and re-fetch
- Debounce all text-based inputs (search, location) at 300ms

#### [NEW] [locationData.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/constants/locationData.js)

- Static JSON of India states and their major cities for the location cascading dropdown

---

### Frontend — UI Components

#### [MODIFY] [JobOpeningsPage.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobOpeningsPage.jsx)

- **Add hero banner** at the top: gradient banner with "Discover & Apply to Jobs" messaging, sparkle icon, similar to the design images. Theme-aware using CSS variables.
- **Wire up JobDetailView**: Add state for `selectedJobId` and `isDetailOpen`, pass to [JobDetailView](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobDetailView.jsx#23-594) component. Fix `onView` handler to actually open the drawer.
- **Switch to 2-column grid** for job cards instead of single-column list.
- **Results count** displayed above the grid.
- Remove the old `Back to Dashboard` button placement and integrate banner.

#### [MODIFY] [JobSearchAndFilters.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobSearchAndFilters.jsx)

Complete rewrite with:
- **Search bar** with location and job type dropdowns in the same row (inspired by design)
- **Quick filter pills row**: All, Full-Time, Contract, Remote, New, Closing Soon, Applied, Saved
- **Expandable advanced filters panel**:
  - **Experience**: Dual-range slider with min/max number inputs. Also supports single value mode. Uses custom CSS for themed slider appearance.
  - **Organisation**: Multi-select dropdown populated from `GET /api/jobs/meta/organisations`
  - **Location**: Cascading dropdown (Country → State → City) with India as default
  - **Status filters**: Applied, Needs Interview, Interview In Progress, Interview Completed (checkboxes)
- Debounce all text inputs with 300ms delay

#### [MODIFY] [JobCard.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobCard.jsx)

Redesign to match the provided mockups:
- Card layout with left-aligned company icon/avatar, title, company name
- Status badge (New/Open/Closing Soon) in top-right
- Left-colored border accent (matching status)
- Location, job type, salary info with icons
- Skills tags row
- "Posted X ago" + "Apply Now" button at bottom
- Full theme support (light/dark)

#### [MODIFY] [JobDetailView.jsx](file:///Users/harshithprathi/Zinterview/mockmate-ai/components/jobs/JobDetailView.jsx)

- No major changes. Ensure it works when `jobId` is passed correctly.

#### [MODIFY] [index.css](file:///Users/harshithprathi/Zinterview/mockmate-ai/index.css)

- Add CSS for dual-range slider styling (both light/dark themes)
- Add CSS for the job openings hero banner gradient animation
- Add dropdown/select styling for location and organisation filters

---

### Frontend — Constants

#### [MODIFY] [jobConstants.js](file:///Users/harshithprathi/Zinterview/mockmate-ai/constants/jobConstants.js)

- Remove `EXPERIENCE_LEVELS` dropdown options (replaced by slider)
- Add quick filter pill definitions

## Verification Plan

### Manual Verification

1. **Start the dev server**: `npm run dev` from the project root  
2. **Navigate to** `/mockmate/candidate/jobs` in the browser
3. **Verify Hero Banner**: Gradient banner visible at top with "Discover & Apply to Jobs" text, theme-responsive
4. **Toggle dark mode** and verify banner, cards, filters all theme correctly
5. **Click a job card** → Verify the detail drawer opens and loads job data
6. **Test Experience Filter**: Drag the range slider to set min/max, verify jobs filter correctly. Enter a single value, verify overlapping openings appear
7. **Test Organisation Filter**: Click the org dropdown, verify it loads organisation names, select one, verify filtering
8. **Test Location Filter**: Select Country (India default), then State, then City. Verify filtering works
9. **Test Quick Filter Pills**: Click "All", "Applied", "New" etc. and verify results update
10. **Test Search**: Type in search bar, verify debounce (300ms delay before results update)
11. **Test Infinite Scroll**: Scroll down past 20 results, verify more load automatically
12. **Clear All Filters**: Click clear, verify all filters reset and full results show
