# Custom Instructions -- career-ops

<!-- ============================================================
     THIS FILE IS YOURS. It will NEVER be auto-updated.

     Put your own house rules, custom workflows, and automations
     here -- anything you want the agent to ALWAYS do (or never do).

     This is for PROCEDURAL rules ("HOW I want things done").
     For WHO you are (archetypes, narrative, comp, negotiation),
     use modes/_profile.md instead. Keeping the two separate keeps
     each one readable.

     The agent reads this file alongside the system instructions;
     your rules here take precedence over the defaults, as long as
     they don't break the Data Contract (your files are never
     touched, and we never auto-submit an application for you).

     Because this is a user-layer file, anything you write here
     survives `node update-system.mjs`. Put customizations HERE,
     not in CLAUDE.md / modes/_shared.md / other system files --
     those get overwritten on update.
     ============================================================ -->

## House Rules

<!-- Rules the agent should always follow. Examples:
     - Always write evaluation summaries in British English.
     - Never include a photo in my CV (US / ATS-first market).
     - Cap each batch run at 20 listings unless I say otherwise.
     - If a report scores below 6, skip the cover letter. -->

- Never fabricate, exaggerate, or infer experience, metrics, responsibilities, skills, certifications, or achievements.
- Treat every metric in `cv.md` as factual unless Alanis explicitly says otherwise.
- Tailor wording, emphasis, ordering, and keywords only from facts in `cv.md` or statements Alanis explicitly provides.
- When a role requires experience Alanis does not have, flag the gap; never imply she has it.
- Ask before adding information that is ambiguous or cannot be verified from Alanis's provided information.

## Custom Workflows

<!-- Multi-step routines you run often, given a short name. Examples:
     - "weekly review": scan my saved portals, evaluate the new roles,
       then give me a one-paragraph summary of the top 3.
     - "prep <company>": pull the JD, generate STAR stories from
       article-digest.md, and draft 5 likely interview questions. -->

- Keep all CVs ATS-friendly while preserving factual accuracy.

## Job Search Master Rules

- Use a broad radar first, then strict JD evaluation. Do not search, apply, or submit automatically without the requested workflow.
- Primary targets: Associate Clinical Project Manager; junior/early-mid Clinical Project Manager; Associate Project Manager — Clinical/Life Sciences; Clinical Project Coordinator; Clinical Operations Project Coordinator; Clinical Trial Project Coordinator.
- Rank adjacent Clinical Operations Associate/Specialist, Clinical Trial Associate, Clinical Operations Project Specialist, GxP/Validation project roles, Scientific Project Manager, and qualifying biotech/pharma operational-excellence roles below primary targets.
- Adjacent operational-excellence, GMP/GxP, scientific-project, and validation-project roles qualify only when meaningful project coordination, timelines, cross-functional delivery, vendor coordination, quality/compliance projects, validation planning, technical documentation, risk management, or operational readiness are explicit.
- Do not treat generic laboratory operations as an acceptable adjacent PM role. Pure bench research, pure QA/QC, pure Clinical Data Management, and purely administrative coordination are excluded only when meaningful project-management content is absent.
- Do not reject a role solely because the candidate lacks an official PM title. Evaluate verified planning, task assignment, dependency awareness, ClickUp tracking, status reporting, CRO/vendor coordination, issue resolution, and cross-functional coordination.
- Relocation is unavailable. Remote roles are US-wide, subject to employer residence restrictions, and may span time zones. Apply the commuting policy in `config/profile.yml` and `modes/_profile.md`: Cocoa, Florida is the general home/search area; approximately a one-hour practical drive is the main preference for regular/frequent onsite work. Eastern Orlando-area opportunities can be acceptable, but not all Orlando locations are automatically acceptable. Somewhat longer drives can be acceptable for hybrid roles requiring only a small number of onsite days. Review uncertain but potentially reasonable commutes rather than automatically rejecting them. Do not convert the preference into a fixed mileage radius or invent exact cities, mileage thresholds, additional driving-time thresholds, or attendance-frequency limits.
- Target compensation is $100,000–$120,000 USD. Hard floors are $75,000 remote and $80,000 hybrid/on-site. Undisclosed compensation is not an automatic exclusion.
- Treat clearly senior requirements, independent global Phase III ownership, independent study-budget ownership, CRO-contract ownership, or extensive global clinical project leadership as major gaps or possible hard disqualifiers.
- Tailor each resume to the individual JD using only verified `cv.md` and `article-digest.md` content. Never change official titles or imply independent CPM experience, regulatory/submission ownership, budget ownership, contract ownership, or unsupported metrics.

## Discovery Sources and Staged Workflow

- Prefer authoritative employer careers or ATS postings.
- LinkedIn, Indeed, Google Jobs, and other aggregators/search-result snippets may be used only as discovery clues. Do not directly access or scrape Indeed.
- Resolve each clue to the corresponding official employer/ATS posting before queueing it for evaluation. Verify employer, title/requisition when available, location/work arrangement, full JD, active status, and application path.
- If no authoritative posting can be verified, keep/report it as unresolved rather than evaluating the aggregator snippet. Preserve the official URL as the canonical job URL.
- Keep discovery geography broad: U.S.-remote nationwide and Florida. Search geography and location-filter matches do not establish residence eligibility or commute suitability; assess onsite/hybrid arrangements using the saved candidate commuting policy. Review uncertain but plausible commutes rather than automatically rejecting them. Do not impose a mileage radius or enumerate acceptable Florida cities.
- Preserve this sequence: discovery → user reviews candidate → fit evaluation/report → user decides whether to proceed → tailored resume/PDF → user applies → application is recorded as Applied only after actual submission.
- Discovery must not automatically run fit evaluation, tailor a resume, generate a PDF, or mark an application as Applied. Fit evaluation must not automatically trigger tailoring or PDF generation; wait for the user's decision to proceed.

## Application Availability Guardrail

- Before any fit evaluation or application preparation, verify the final official employer or ATS application destination, not only the JD or careers listing. Resolve the official job page, follow or identify its Apply destination, and check that destination when possible. Search results, cached or indexed copies, third-party copies, careers pages that still mention a role, stale ATS metadata, and an accessible JD with a closed Apply flow are insufficient proof of actionability. Check for explicit closure or failure signals such as "no longer accepting applications," "job no longer available," "position has been filled," "page/job does not exist," disabled or unavailable application controls, hard redirects, 404/410, or equivalent ATS states. If the final endpoint is confirmed closed, classify the role **CLOSED / NOT ACTIONABLE** and stop before fit evaluation, tailoring, DOCX/PDF generation, or other application preparation. If the final endpoint cannot be verified, classify **LIVE STATUS UNVERIFIED** and do not describe the role as confirmed live/actionable; report the exact limitation. Reuse `check-liveness.mjs` / `liveness-core.mjs` when possible, but apply the check to the final application destination when one exists.

## Output Preferences

<!-- How you like results formatted. Examples:
     - Reports: lead with the score and the one-line verdict.
     - Show the per-step token breakdown after a batch run.
     - Save PDFs date-first: YYYY-MM-DD-company.pdf -->

- For future tailored resumes, create an editable DOCX version in addition to the normal resume output so Alanis can manually adjust formatting and layout before submission.
- Unless the user explicitly requests otherwise, every final tailored resume produces three consistent deliverables from the same content: Markdown source (`.md`), editable Microsoft Word (`.docx`), and PDF (`.pdf`). Generating these formats does not change application status, scoring, or tracker state.
- For every tailored resume, minimize semantic repetition across the entire document. Give the Summary, Core Competencies, Skills, and Experience distinct purposes; keep the Summary concise (normally 2–3 sentences) and positioning-focused; remove Core Competencies when it duplicates other sections; keep Skills compact and focused on concrete verified tools, platforms, methods, and technical capabilities; place primary evidence in Experience; consolidate repeated accomplishments or concepts; run a semantic redundancy pass; preserve important unique evidence and verified metrics; favor readability and natural ATS keyword placement over keyword density; do not force one page; continue creating an editable DOCX alongside the resume.
- Use positive, evidence-based wording. Do not proactively minimize verified work with qualifiers such as “temporarily supported” when the qualifier is not needed to prevent an inaccurate claim about scope, duration, ownership, or responsibility; retain qualifiers when they are necessary for factual accuracy.
- Label independent simulations and portfolio work as “Independent,” “Simulation,” or “Portfolio project” as applicable, then describe what the project demonstrates. Do not add unnecessary negative disclaimers such as “not professional CTA experience,” “not professional CTMS experience,” or “not equivalent to professional experience.” Portfolio work must never satisfy a professional-experience requirement or be presented as direct CTA/CTM, TMF/eTMF, CTMS, site, startup/closeout, IRB/IEC, regulatory-submission, budget, or vendor ownership.
- Prefer positive statements of what the candidate did and demonstrated. Avoid mechanically copying JD terminology when it would imply unsupported scope or ownership, and avoid using resume space to list what the candidate has not done unless disclosure is genuinely necessary for accuracy.
- For Clinical Operations and clinical-project resumes, use “Clinical research professional” rather than “Biomedical research professional” when factually appropriate. Use support-accurate headings such as “Clinical Research Support” or “Clinical-Trial Support” instead of “Clinical Research Coordination” when the verified experience does not establish formal coordination ownership.

## Off-Limits

<!-- Things the agent must never do for you. Examples:
     - Never auto-fill or submit an application without showing me first.
     - Never edit a system file to customize my setup -- put it here. -->

(none yet -- add yours above)

## Resume Architecture and Tailoring Defaults

- Use the MapLight Senior Clinical Trial Associate resume as a structural and formatting reference only. Do not copy its role-specific wording into unrelated resumes.
- Unless a clear role-specific reason supports another layout, use this order: Header, Professional Summary, Professional Experience, Education, Certifications, Skills, Publications.
- Keep resumes concise, clean, recruiter-readable, and evidence-first. Preserve meaningful professional evidence even when that requires two pages; do not force one page by deleting strong experience.
- Do not add Core Competencies, Technical Skills, Tools, or other keyword-only sections automatically. Use one grouped Skills section by default, with 2–4 role-specific categories. If Core Competencies and Skills substantially overlap, remove the redundant section and preserve useful terminology in Skills.
- Professional Experience is the primary evidence-bearing section. Skills provide compact capability and ATS coverage; overlapping keywords do not justify removing relevant experience bullets.
- Keep the Professional Summary to a concise identity, experience foundation, and approximately 2–4 role-relevant capabilities. Use positive, evidence-based language and avoid unnecessary minimizing or self-disqualifying wording.
- Retain both verified publications by default as concise industry-resume entries, place Publications after Skills as the final section, and reduce repetition, low-value detail, and spacing before removing publications. Omit one only for a documented role-specific or layout reason and report that decision.
- For every tailored resume, explicitly evaluate whether a verified independent project materially strengthens the target application. Include at most the most relevant project when it demonstrates an important JD capability, addresses a meaningful evidence gap, and merits the space; omit it when professional evidence is stronger or the incremental value is low. Report the include/omit decision and reason. When included, place an `Independent Project` section after Professional Experience and keep the project clearly separate from employment.
- Portfolio projects remain independent evidence and can never satisfy professional experience or years-of-experience requirements. Do not add unnecessary negative disclaimers when the heading and project title establish that status.
- Before finalizing, run a semantic section-level redundancy check across Summary, Core Competencies (if present), Skills, Certifications, Independent Project (if present), and other keyword-heavy sections. Preserve unique evidence, remove duplicated keyword blocks, confirm role-specific Skills categories, and confirm the final order and recruiter readability.
- `Codex` is a verified current hands-on tool skill. Use that display name when relevant and tailor its placement among tools; never attribute Codex use to Vaxxinity or Akesoe without separate source-of-truth evidence and never create employer experience bullets for it.
