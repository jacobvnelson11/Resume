"""Job Application Assistant -- a local, single-file Streamlit app.

Finds remote marketing/sales jobs, scores how well each fits your resume, and
writes a resume + cover letter for each one -- all free, no API key required.
Add an Anthropic API key (optional, costs a few cents per job) for an
AI-tailored version that reorders bullets and writes a job-specific cover
letter instead of the basic as-is + filled-in-template version. No database,
no server, no hosting -- just run `streamlit run app.py` and use it from your
browser.
"""
import os
import re
from pathlib import Path

import streamlit as st

from lib import docx_render, job_sources, pdf_render, scoring, storage, tailoring

st.set_page_config(page_title="Job Application Assistant", page_icon="🧭", layout="wide")

st.title("🧭 Job Application Assistant")
st.caption(
    "Finds remote marketing/sales jobs and scores how well each one fits your resume. "
    "No account or API key needed just to search."
)


def generate_for_job(job: dict, base: dict, output_dir: str, use_ai: bool) -> dict:
    """Writes a resume + cover letter for one job, saving PDF/DOCX to output_dir
    named "Company - Role", and returns what got produced (or the error).
    With an API key, Claude tailors bullet order + writes a job-specific cover
    letter. Without one, it falls back to your resume as-is plus a simple
    filled-in cover letter -- no cost, no key required."""
    try:
        if use_ai:
            tailored = tailoring.generate_tailored_application(job["title"], job["company"], job["description"], base)
        else:
            tailored = tailoring.generate_template_application(job["title"], job["company"], job["description"], base)
        safe_name = re.sub(r'[\\/:*?"<>|]', "-", f"{job['company']} - {job['title']}").strip()[:120]

        resume_pdf = os.path.join(output_dir, f"{safe_name}.pdf")
        resume_docx = os.path.join(output_dir, f"{safe_name}.docx")
        cover_pdf = os.path.join(output_dir, f"{safe_name} - Cover Letter.pdf")
        cover_docx = os.path.join(output_dir, f"{safe_name} - Cover Letter.docx")

        pdf_render.render_resume_pdf(resume_pdf, tailored, base["skills"], base["certifications"], base["education"])
        docx_render.render_resume_docx(resume_docx, tailored, base["skills"], base["certifications"], base["education"])
        pdf_render.render_cover_letter_pdf(cover_pdf, tailored["coverLetter"], job["title"], job["company"])
        docx_render.render_cover_letter_docx(cover_docx, tailored["coverLetter"], job["title"], job["company"])

        return {
            "status": "ok",
            "mode": "ai" if use_ai else "template",
            "resume_pdf": resume_pdf,
            "resume_docx": resume_docx,
            "cover_pdf": cover_pdf,
            "cover_docx": cover_docx,
            "cover_letter_text": tailored["coverLetter"],
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ---------------------------------------------------------------- Sidebar --

st.sidebar.header("Search settings")

num_jobs = st.sidebar.number_input("How many new jobs to find", min_value=1, max_value=200, value=40, step=5)
salary_floor = st.sidebar.number_input("Minimum salary ($/year)", min_value=0, value=60000, step=5000)
max_years_experience = st.sidebar.number_input(
    "Skip jobs asking for more than this many years of experience",
    min_value=1,
    max_value=20,
    value=5,
    step=1,
    help='Entry-level roles are always included -- this only screens out postings that explicitly say e.g. "7+ years experience."',
)
company_tokens_input = st.sidebar.text_input(
    "Specific companies to include (optional)",
    value="",
    help='Comma-separated company names, e.g. "gitlab, doist". Checked against Greenhouse, Lever, and Ashby -- whichever the company actually uses. A wrong guess just returns nothing, no harm in trying.',
)
max_post_age_hours = st.sidebar.number_input(
    "Only show jobs posted within this many hours",
    min_value=1,
    max_value=1440,
    value=336,
    step=24,
    help='Default is 14 days (336 hours) -- a middle ground between freshness and volume. RemoteOK '
    "especially tends to have listings stay live well past 30 days without being reposted, so a "
    "strict 24-72 hour window can drop to near-zero matches on an ordinary day. Postings with no "
    "usable date from the source are kept regardless, rather than dropped.",
)

st.sidebar.divider()
st.sidebar.subheader("Job history")
seen_jobs = storage.load_seen_jobs()
st.sidebar.write(f"{len(seen_jobs)} jobs already suggested so far -- these won't show up again.")
if st.sidebar.button("Reset job history (show everything again)"):
    storage.reset_seen_jobs()
    storage.clear_current_batch()
    st.session_state.pop("job_results", None)
    st.session_state.pop("generated", None)
    st.sidebar.success("Cleared.")
    st.rerun()
if st.session_state.get("job_results") and st.sidebar.button("Clear current list (keeps job history)"):
    storage.clear_current_batch()
    st.session_state.pop("job_results", None)
    st.session_state.pop("generated", None)
    st.sidebar.success("List cleared. Search again for a fresh batch.")
    st.rerun()

st.sidebar.divider()
st.sidebar.subheader("Resume writing")
default_output = str(Path.cwd() / "output")
output_dir = st.sidebar.text_input("Save resumes to this folder", value=default_output)
api_key_input = st.sidebar.text_input(
    "Anthropic API key (optional)",
    type="password",
    value=os.environ.get("ANTHROPIC_API_KEY", ""),
    help="Get one at console.anthropic.com/settings/keys. Only used on your own computer, never sent anywhere else.",
)
if api_key_input:
    os.environ["ANTHROPIC_API_KEY"] = api_key_input
has_api_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
if has_api_key:
    st.sidebar.caption("✅ AI tailoring on: bullets get reordered per job and the cover letter is written specifically for each posting.")
else:
    st.sidebar.caption("No key needed. Without one, resumes use your info as-is and cover letters are a simple filled-in template. Add a key above any time for AI-customized versions instead -- costs a few cents per job.")

with st.sidebar.expander("Edit my resume"):
    base_for_edit = storage.load_base_resume()
    new_summary = st.text_area("Summary", value=base_for_edit["summary"], height=100)
    new_skills = st.text_area("Skills (comma-separated)", value=", ".join(base_for_edit["skills"]))
    new_certs = st.text_area("Certifications (comma-separated)", value=", ".join(base_for_edit["certifications"]))
    st.caption(
        "This is the only source of truth the AI is allowed to draw from -- it can reorder or lightly "
        "reword bullets per job, but never invents a new employer, title, date, or accomplishment. "
        "To edit your actual experience bullets, open streamlit_app/data/base_resume.json in any text "
        "editor, edit the \"bullets\" lists, save, then reload this page."
    )
    if st.button("Save resume changes"):
        base_for_edit["summary"] = new_summary
        base_for_edit["skills"] = [s.strip() for s in new_skills.split(",") if s.strip()]
        base_for_edit["certifications"] = [s.strip() for s in new_certs.split(",") if s.strip()]
        storage.save_base_resume(base_for_edit)
        st.success("Saved.")

# Recover an in-progress batch from disk -- e.g. after closing/reopening the
# app -- since the jobs in it are already marked "seen" and won't resurface
# on their own otherwise.
if "job_results" not in st.session_state:
    loaded_results, loaded_generated = storage.load_current_batch()
    if loaded_results:
        st.session_state["job_results"] = loaded_results
        st.session_state["generated"] = loaded_generated

# ------------------------------------------------------------- Search step --

if st.button("🔍 Find new jobs", type="primary"):
    seen = storage.load_seen_jobs()
    base = storage.load_base_resume()
    company_tokens = [t.strip() for t in company_tokens_input.split(",") if t.strip()]

    with st.spinner("Searching RemoteOK, Remotive" + (f", and {len(company_tokens)} compan{'y' if len(company_tokens) == 1 else 'ies'}" if company_tokens else "") + "..."):
        all_jobs = job_sources.fetch_all_jobs(company_tokens)

    candidates = []
    added_keys = set()
    for job in all_jobs:
        job_key = (job["source"], job["external_id"])
        # Remotive can return the same listing under more than one category
        # (e.g. both "marketing" and "sales-business"), so de-dupe within this run too.
        if job_key in seen or job_key in added_keys:
            continue
        if not scoring.is_remote(job["remote_text"], job["description"]):
            continue
        if scoring.is_region_restricted(job["title"]):
            continue
        if not scoring.is_recent(job.get("posted_at"), max_post_age_hours):
            continue
        tier = scoring.classify_tier(job["title"])
        if tier == "excluded":
            continue
        if scoring.exceeds_experience_requirement(job["description"], max_years_experience):
            continue
        if not scoring.meets_salary_floor(job["salary_min"], job["title"], tier, salary_floor):
            continue
        job["tier"] = tier
        job["fit_score"] = scoring.compute_fit_score(job["description"], tier, base["skills"], job["salary_min"], salary_floor)
        job["has_benefits"] = scoring.mentions_benefits(job["description"])
        candidates.append(job)
        added_keys.add(job_key)

    candidates.sort(key=lambda j: j["fit_score"], reverse=True)
    selected = candidates[:num_jobs]

    st.write(f"Fetched {len(all_jobs)} raw listings. {len(candidates)} new jobs match your criteria.")

    # Record these as suggested right away so a future search won't repeat them,
    # regardless of whether a resume ever gets generated for them.
    for job in selected:
        seen.add((job["source"], job["external_id"]))
    storage.save_seen_jobs(seen)

    # Add to (not replace) whatever's already showing, so searching again never
    # silently drops jobs you haven't generated a resume for yet.
    existing_results = st.session_state.get("job_results", [])
    existing_keys = {(j["source"], j["external_id"]) for j in existing_results}
    newly_added = [j for j in selected if (j["source"], j["external_id"]) not in existing_keys]
    st.session_state["job_results"] = existing_results + newly_added
    st.session_state.setdefault("generated", {})
    storage.save_current_batch(st.session_state["job_results"], st.session_state["generated"])

# ----------------------------------------------------------------- Results --

if "job_results" in st.session_state:
    results = st.session_state["job_results"]
    generated = st.session_state.setdefault("generated", {})

    if not results:
        st.warning(
            "No new matching jobs found. Try again later, or reset your job history in the sidebar "
            "if you think good matches are being skipped as already-seen."
        )
    else:
        st.subheader(f"{len(results)} jobs found")

        pending = [j for j in results if generated.get((j["source"], j["external_id"]), {}).get("status") != "ok"]
        button_label = (
            f"✍️ Write AI-tailored resumes + cover letters for all {len(pending)} jobs below"
            if has_api_key
            else f"✍️ Write resumes + cover letters for all {len(pending)} jobs below (free, basic version)"
        )
        if pending and st.button(button_label, type="primary"):
            base = storage.load_base_resume()
            os.makedirs(output_dir, exist_ok=True)
            progress = st.progress(0.0, text="Starting...")
            for i, job in enumerate(pending):
                job_key = (job["source"], job["external_id"])
                progress.progress(i / len(pending), text=f"Writing {i + 1} of {len(pending)}: {job['title']} at {job['company']}")
                generated[job_key] = generate_for_job(job, base, output_dir, has_api_key)
                storage.save_current_batch(results, generated)  # save after each so progress survives an interruption
            progress.progress(1.0, text="Done!")
            st.rerun()

        for job in results:
            job_key = (job["source"], job["external_id"])
            badge = " | 💰 benefits mentioned" if job.get("has_benefits") else ""
            with st.expander(f"{job['fit_score']}% match -- {job['title']} at {job['company']} ({job['tier']} fit){badge}"):
                salary_text = f"${job['salary_min']:,}+/year" if job.get("salary_min") else "salary not listed"
                st.write(f"**Source:** {job['source']}  |  **Salary:** {salary_text}")
                st.link_button("🔗 Apply on company site", job["url"])
                st.caption(
                    "Resume PDF/DOCX below are formatted to read cleanly in applicant tracking systems "
                    "(single column, no tables, standard section headings) -- attach them on that page."
                )

                entry = generated.get(job_key)

                if entry and entry["status"] == "ok":
                    mode_note = (
                        "AI-tailored for this specific posting."
                        if entry.get("mode") == "ai"
                        else "Basic version (your resume as-is + a simple filled-in cover letter) -- add an API key in the sidebar for an AI-customized version instead."
                    )
                    st.success(f"Ready to apply. {mode_note}")
                    st.caption("If the application form asks you to upload a file, use the PDF or DOCX. If it wants you to paste text instead, use the buttons below.")
                    c1, c2, c3, c4 = st.columns(4)
                    with open(entry["resume_pdf"], "rb") as f:
                        c1.download_button("Resume (PDF)", f, file_name=os.path.basename(entry["resume_pdf"]), key=f"pdf-{job_key}")
                    with open(entry["resume_docx"], "rb") as f:
                        c2.download_button("Resume (DOCX)", f, file_name=os.path.basename(entry["resume_docx"]), key=f"docx-{job_key}")
                    with open(entry["cover_pdf"], "rb") as f:
                        c3.download_button("Cover letter (PDF)", f, file_name=os.path.basename(entry["cover_pdf"]), key=f"cover-{job_key}")
                    with open(entry["cover_docx"], "rb") as f:
                        c4.download_button("Cover letter (DOCX)", f, file_name=os.path.basename(entry["cover_docx"]), key=f"coverdocx-{job_key}")

                    with st.expander("Copy cover letter text (for forms that want pasted text instead of a file)"):
                        st.text_area("Cover letter text", value=entry["cover_letter_text"], height=200, key=f"text-{job_key}", label_visibility="collapsed")
                elif entry and entry["status"] == "error":
                    st.error(f"Couldn't generate a draft: {entry['error']}")
                    if st.button("Try again", key=f"retry-{job_key}"):
                        generated.pop(job_key, None)
                        storage.save_current_batch(results, generated)
                        st.rerun()
                else:
                    label = "✍️ Write a tailored resume + cover letter for this job" if has_api_key else "✍️ Write a resume + cover letter for this job (free, basic version)"
                    if st.button(label, key=f"gen-{job_key}"):
                        base = storage.load_base_resume()
                        os.makedirs(output_dir, exist_ok=True)
                        with st.spinner("Writing..."):
                            generated[job_key] = generate_for_job(job, base, output_dir, has_api_key)
                        storage.save_current_batch(results, generated)
                        st.rerun()
