# Zinterview × MockMate-AI Integration — Implementation Plan

## Overview
This document outlines the zero-code architectural and implementation strategy for the upgraded Zinterview and MockMate-AI job openings integration. It details the system design, algorithmic choices, cost/latency tradeoffs, and edge case mitigations across the 5 core feature pillars.

---

## Proposed Changes

### Feature 1 — Centralised Zinterview Resume + Application Flow (MockMate-AI)

**Approach & Reasoning**
We will implement an event-driven flow where the frontend evaluates resume fitness via a cached LLM endpoint immediately prior to application submission. MockMate-AI's DB will store a `CentralisedResume` document per candidate. For returning candidates, an on-the-fly diff algorithm compares the current Job Description's extracted skills against the candidate's `CentralisedResume` skills. If missing, we generate a bespoke add-on interview session focused strictly on the delta skills, which is subsequently unioned into the centralized resume.

**Alternatives Considered**
- *Alternative A (Strict Re-interviewing):* Force candidates to take a full interview again for every application. High fidelity, but terrible candidate UX and huge compute cost.
- *Alternative B (Soft Self-Rating):* Allow candidates to self-rate missing skills without an interview. Good UX, but defeats the "verified hiring" premise.

**Best Approach Verdict**
The **Delta/Add-on Interview System**. It respects candidate prior effort, ensures verified skills for the recruiter, and minimizes LLM video/audio processing costs.

**Cost & Latency Analysis**
- *Cost:* LLM processing per JD vs Resume diff (~$0.01/run). Add-on interviews scale down LLM streaming costs drastically based on shorter duration.
- *Latency:* Initial resume fitness takes 2-4 seconds (masked via cinematic loading UI).

**Optimisation Techniques**
- *Semantic Caching:* Use `GPTCache` or Redis to cache JD+Resume hashes. If >95% cosine similarity, return early.
- *Lazy Evaluation:* Calculate delta skills only if the fitness score passes the recruiter threshold.

**Edge Cases & Mitigations**
- *Candidate drops mid add-on interview:* Treat missing skills as "unassessed" (score 0), submit partial application, flag to recruiter.
- *LLM hallucinating missing skills:* Enforce strict structured output schemas (JSON) for NLP skill extraction.

**Blockers & Mitigations**
- *Zinterview API candidate overwrites:* Abstract by maintaining distinct MockMate records mapped sequentially to update calls, ensuring MockMate is the authoritative historical source.

**Feature Flag Integration**
- `FEATURE_CENTRALISED_RESUME_APPLICATION_FLOW` (Toggled across Zinterview API endpoints and MockMate UI logic).

**System Design & DSA Choices**
- *DSA:* Skill Union Operations use a `HashMap` ($O(n)$) to merge skills, resolving conflicts via `Math.max(existing_score, new_score)`. Skill diffing utilizes `HashSet` intersection ($O(n+m)$).
- *Decoupling:* Centralised resume updates are eventually consistent, executed via background MQ job post-interview.

---

### Feature 2 — Proctored Interview Overhaul (MockMate-AI)

**Approach & Reasoning**
Move from a 1:1 user-to-interview model to 1:N. MockMate-AI maintains an immutable ledger of `InterviewAttempt` documents. Overlapping questions are avoided by maintaining a `CandidateQuestionHistory` collection. A backend config flag restricts limits where monetisation is required.

**Alternatives Considered**
- *Alternative A:* Mutate old records upon a new interview attempt. (Violates historical data requirements).
- *Alternative B:* Soft-delete old records. (Results in lost recruiter insight).

**Best Approach Verdict**
**Immutable Ledger + Centralised Resume Roll-up**. Ensures data integrity and historical compliance while giving recruiters the "best-of" view.

**Cost & Latency Analysis**
- *Cost:* Multiplied DB storage per user $O(N)$. Increased S3 video storage.
- *Latency:* Negligible impact to API requests if heavily indexed.

**Optimisation Techniques**
- Array partitioning for documents to prevent unbounded BSON document growth.
- TTL on raw video recordings (e.g., 90 days) to curb S3 costs.

**Edge Cases & Mitigations**
- *Question bank exhaustion:* Fall back to broader semantic question equivalents if exact skills are exhausted.

**Blockers & Mitigations**
- Zinterview candidate overwrite limits mitigated by only pushing the summarized high-water mark `CentralisedResume` snapshot to Zinterview.

**Feature Flag Integration**
- `FEATURE_INTERVIEW_LIMIT_OVERHAUL` controls access limits, history tracking, and the config selector dropdown UI.

**System Design & DSA Choices**
- *DSA:* Implement a **Bloom Filter** ($O(k)$) initialized on candidate session start to rapidly check against historically asked questions, avoiding linear timeline scans.

---

### Feature 3 — Recruiter Candidate Pool View (Zinterview-Frontend)

**Approach & Reasoning**
A centralized top-level tab in Zinterview. Since MockMate-AI owns the authoritative Centralised Resume structure, Zinterview will fetch this via secure service-to-service API calls with server-side cursor pagination and robust filtering.

**Alternatives Considered**
- *Alternative A:* Replicate all MockMate data entirely into Zinterview DB via CDC. (Complex dependency; high coupling).
- *Alternative B:* Client-side filtering in browser. (Performance bottleneck with >1k applications).

**Best Approach Verdict**
**Direct Synchronous API with Server-Side Pagination**. Prevents massive data duplication while ensuring recruiters have real-time access. 

**Cost & Latency Analysis**
- *Latency:* Minor cross-service penalty.
- *Optimisation:* Materialized views in MockMate DB continuously aggregate scores for $O(1)$ read delivery to Zinterview.

**Edge Cases & Mitigations**
- Massive dataset filtering locks up DB: Enforce compound indexes limit and restrict wild-card queries.

**Feature Flag Integration**
- `FEATURE_GLOBAL_CANDIDATE_POOL` on frontend routing and backend aggregations.

**System Design & DSA Choices**
- API Gateway / BFF (Backend for Frontend) model.
- *DSA:* B-Tree indexing on `(skill_rating, experience)` for quick multidimensional bounding queries.

---

### Feature 4 — Per-Opening MockMate Applications Section

**Approach & Reasoning**
Sub-route rendering specifically filtered MockMate applicants inside the opening UI. The follow-up scheduling integrates with existing Zinterview APIs but augments the payload with custom AI-proctorable questions.

**Alternatives Considered**
- *Alternative A:* Duplicate all scheduling logic within MockMate. (Diverging codebases).

**Best Approach Verdict**
**Payload Augmentation + Shared Service Layer**. Reuse Zinterview's scheduling logic entirely, only injecting question arrays dynamically.

**Feature Flag Integration**
- `FEATURE_OPENING_MOCKMATE_TAB` limits UI sub-rendering in Zinterview.

**System Design & DSA Choices**
- Synchronous UI component fetching. Deep merging custom questions arrays with the standard questions array ($O(k)$).

---

### Feature 5 — Notifications & Events Sync (Cross-Platform)

**Approach & Reasoning**
Event-driven architecture. Zinterview triggers events to a Message Queue / PubSub interface. MockMate consumes these events asynchronously, saving to the `Notifications` DB schema, pushing WebSockets for live UI updates, and queueing Email/SMS tasks.

**Alternatives Considered**
- *Alternative A:* Heavy HTTP Polling from MockMate client. (Kills DB capacity quickly).
- *Alternative B:* Blocking synchronous API calls from Zinterview. (Slows recruiter usage).

**Best Approach Verdict**
**Message Bus / Redis PubSub Integration**. Ensures highest resilience, zero-blocking recruiter flows, and scalable consumer tracking.

**Cost & Latency Analysis**
- *Latency:* Under 200ms end-to-end delivery when web sockets alive.
- *Optimisation:* Debounce UI rapid-fire transitions to prevent notification fatigue. Batch emails securely.

**Edge Cases & Mitigations**
- *Network partition:* Implement Dead Letter Queues (DLQ) and exponential backoff retry policies.

**Feature Flag Integration**
- `FEATURE_EVENTS_SYNC` wraps producer emission and consumer listener mounts.

**System Design & DSA Choices**
- Pub/Sub message topics partitioned by tenant/orgId.
- *DSA:* Priority queues (Heaps) for processing high-urgency notifications (e.g. `IMMEDIATE` interview mode applied) above standard batch notifications.
