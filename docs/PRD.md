# PRD: Auto Job Application Assistant

Sep 16, 2026 · @jacob

## Overview & Problem Statement

Jacob is a marketing and sales professional (digital marketing, B2B sales, CRM, team
leadership) targeting remote roles. Manually finding, tailoring, and submitting
applications one at a time is slow and inconsistent — quality and volume trade off
against each other.

This product is a job application assistant: it surfaces remote roles that match
Jacob's background, drafts a tailored resume bullet set and cover letter for each,
and gets every application to a one-click human review and submit step. It is
explicitly **not** a silent, unattended bot that fires off applications with zero
human review — see Compliance (Section 10) for why.

## Goals & Success Metrics

1. Surface 15-30 well-matched remote roles per day, ranked by fit.
   - Fit score based on title, remote eligibility, seniority, and required skills
     overlap with Jacob's resume.
2. Cut the time to produce a tailored resume + cover letter per role from ~20
   minutes to under 2 minutes of Jacob's active time.
3. Get Jacob to a sustainable 40 quality-reviewed applications per day within the
   first two weeks.
4. Track every application's status (saved, drafted, submitted, response,
   interview) in one place.
5. Within 60 days: 3+ interview requests attributable to app-sourced applications.

## Target User / Persona

Jacob V. Nelson — Richmond, VA. Single user for v1.

- Current role: Sales Representative, HERC Rentals (B2B equipment sales)
- Background: Product Marketing Manager (team leadership, sales coaching) at
  Northeast Alliance; Social Media Marketing & Sales at Enso Media; Marketing
  Intern at VCU
- Education: B.S. Business Management, VCU (2024)
- Core tools: HubSpot, Salesforce, Google Analytics 4, Google Ads, Meta Ads
  Manager, Mailchimp, WordPress, Canva, Adobe Photoshop, CapCut
- Certifications: Google Digital Marketing & E-commerce Professional Certificate,
  Adobe Digital Marketing, Salesforce Marketing Cloud Integration Essentials,
  HubSpot/Coursera Marketing Automation
- Target work style: 100% remote, applying broadly across digital marketing,
  marketing automation, social media, e-commerce marketing, and B2B/inside sales.

## Target Job Criteria

- Remote filter is a hard requirement on every search.
- Salary filter is a hard requirement — only surface roles with a stated minimum
  of $60,000/year or higher; skip listings with no salary data unless
  title/seniority clearly implies pay above that floor.

| Tier | Titles | Why it fits |
| --- | --- | --- |
| Strong fit | Digital Marketing Specialist/Coordinator; Marketing Automation Specialist; Social Media Marketing Manager; E-commerce Marketing Specialist; CRM Marketing Specialist | Direct overlap with HubSpot/Salesforce/GA4/Meta Ads/Mailchimp experience |
| Strong fit | BDR; Inside Sales Rep; Account Executive (SMB/mid-market); SDR | Direct overlap with B2B prospecting and pipeline management at HERC Rentals |
| Good fit, stretch | Marketing Coordinator/Associate; Customer Success/Account Manager; Junior Product Marketing Manager; Sales & Marketing Operations | Adjacent to Product Marketing Manager and team-coaching experience |

Exclude: roles requiring a degree/certification Jacob doesn't have (CPA, PE, RN),
on-site/hybrid-only roles, and titles with "Senior/Director/VP".

Seed keyword sets: `["digital marketing", "marketing automation", "social media
marketing", "e-commerce marketing", "CRM marketing", "business development
representative", "inside sales", "account executive", "sales development
representative", "marketing coordinator"] × ["remote"]`.

## Core Features & User Flow

Fetch jobs via APIs → Score & rank by fit → Dashboard review queue → Generate
tailored resume + cover letter → Jacob reviews/edits → Approve? → Submit via ATS
or open apply link → Log status in tracker → Follow-up reminders.

Feature list (v1): job feed, review queue, draft generator, human-in-the-loop
submit, application tracker, daily digest.

## Application Content Engine

- Base resume stored as structured data (summary, experience bullets, skills,
  certifications) so bullets can be re-ordered/re-weighted per job.
- Tailoring pass: Claude API call takes the job description + base resume data
  and returns a re-ranked bullet order + a 150-250 word cover letter draft.
- Guardrail: never invent employers, titles, dates, metrics, or credentials not
  present in the base resume data.
- Render approved output to PDF (resume) and PDF (cover letter).
- Version log: every generated version saved and linked to its application.
- ATS-safe formatting: no tables/columns/text boxes/headers/footers/non-standard
  fonts; standard section headings; export as .docx and .pdf.

## Technical Architecture

React + Tailwind frontend, Node/Express backend, Postgres, single-user auth,
scheduled job ingestion, Anthropic API for tailoring, PDF/DOCX rendering, email
digest (phase 2).

## Data Model

`jobs`, `applications`, `resume_versions`, `cover_letter_versions`,
`base_resume`, `status_history` — see `server/src/db/schema.ts` for the
implementation.

## Integrations & Job Sources

Official APIs/feeds only: Greenhouse/Lever/Ashby job-board JSON endpoints,
RemoteOK, We Work Remotely, Remotive. No scraping of LinkedIn/Indeed. ATS
auto-fill only where a documented submission API exists; otherwise manual
submit by Jacob.

## Compliance, ToS & Risk Considerations

- No silent auto-submission — every application is generated by the tool but
  sent by Jacob.
- 40 quality-reviewed applications/day is the real target, not raw volume.
- Tailoring engine must never fabricate experience, dates, or credentials.
- Only pull from APIs/feeds that permit programmatic access.
- Personal data handling: single-user database, not shared/multi-tenant.
- EEO/disability self-identification field defaults to a pre-filled "Yes"
  (true statement), editable per-application.

## MVP Scope vs Future Phases

MVP: base resume structured data; job ingestion from Greenhouse + RemoteOK + We
Work Remotely (remote-only, keyword-matched); fit scoring + tiering; review
queue; resume/cover-letter tailoring + PDF export; manual-submit flow;
application tracker.

Phase 2: daily digest, follow-up reminders, ATS-native submission, more job
sources.

Phase 3: analytics, A/B testing of cover-letter styles.
