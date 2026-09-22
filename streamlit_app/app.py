"""Job Application Assistant -- a local, single-file Streamlit app.

Finds remote marketing/sales jobs and scores how well each fits your resume --
no API key needed for that part, it's all free public job-board data. Writing
a tailored resume + cover letter for a job is a separate, optional step that
does need an Anthropic API key. No database, no server, no hosting -- just
run `streamlit run app.py` and use it from your browser.
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


def generate_for_job(job: dict, base: dict, output_dir: str) -> dict:
    """Writes a tailored resume + cover letter for one job, saving PDF/DOCX to
    output_dir named "Company - Role", and returns what got produced (or the error)."""
    try:
        tailored = tailoring.generate_tailored_application(job["title"], job["company"], job["description"], base)
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
greenhouse_tokens_input = st.sidebar.text_input(
    "Specific companies to include (optional)",
    value="",
    help='Comma-separated Greenhouse board tokens, e.g. "gitlab, doist". Found in a company\'s careers URL: boards.greenhouse.io/<token>',
)

st.sidebar.divider()
st.sidebar.subheader("Job history")
seen_jobs = storage.load_seen_jobs()
st.sidebar.write(f"{len(seen_jobs)} jobs already suggested so far -- these won't show up again.")
if st.sidebar.button("Reset job history (show everything again)"):
    storage.reset_seen_jobs()
    st.session_state.pop("job_results", None)
    st.session_state.pop("generated", None)
    st.sidebar.success("Cleared.")
    st.rerun()

st.sidebar.divider()
st.sidebar.subheader("Resume writing (optional)")
st.sidebar.caption("Only needed if you want it to write tailored resumes + cover letters. Searching works without it.")
default_output = str(Path.cwd() / "output")
output_dir = st.sidebar.text_input("Save resumes to this folder", value=default_output)
api_key_input = st.sidebar.text_input(
    "Anthropic API key",
    type="password",
    value=os.environ.get("ANTHROPIC_API_KEY", ""),
    help="Get one at console.anthropic.com/settings/keys. Only used on your own computer, never sent anywhere else.",
)
if api_key_input:
    os.environ["ANTHROPIC_API_KEY"] = api_key_input
has_api_key = bool(os.environ.get("ANTHROPIC_API_KEY"))

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

# ------------------------------------------------------------- Search step --

if st.button("🔍 Find new jobs", type="primary"):
    seen = storage.load_seen_jobs()
    base = storage.load_base_resume()
    greenhouse_tokens = [t.strip() for t in greenhouse_tokens_input.split(",") if t.strip()]

    with st.spinner("Searching RemoteOK, We Work Remotely, Remotive" + (", and Greenhouse" if greenhouse_tokens else "") + "..."):
        all_jobs = job_sources.fetch_all_jobs(greenhouse_tokens)

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

    st.session_state["job_results"] = selected
    st.session_state.setdefault("generated", {})

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

        if not has_api_key:
            st.info("Add an Anthropic API key in the sidebar to have it write tailored resumes + cover letters for these.")
        else:
            pending = [j for j in results if generated.get((j["source"], j["external_id"]), {}).get("status") != "ok"]
            if pending and st.button(f"✍️ Write resumes + cover letters for all {len(pending)} jobs below", type="primary"):
                base = storage.load_base_resume()
                os.makedirs(output_dir, exist_ok=True)
                progress = st.progress(0.0, text="Starting...")
                for i, job in enumerate(pending):
                    job_key = (job["source"], job["external_id"])
                    progress.progress(i / len(pending), text=f"Writing {i + 1} of {len(pending)}: {job['title']} at {job['company']}")
                    generated[job_key] = generate_for_job(job, base, output_dir)
                progress.progress(1.0, text="Done!")
                st.rerun()

        for job in results:
            job_key = (job["source"], job["external_id"])
            badge = " | 💰 benefits mentioned" if job.get("has_benefits") else ""
            with st.expander(f"{job['fit_score']}% match -- {job['title']} at {job['company']} ({job['tier']} fit){badge}"):
                salary_text = f"${job['salary_min']:,}+/year" if job.get("salary_min") else "salary not listed"
                st.write(f"**Source:** {job['source']}  |  **Salary:** {salary_text}")
                st.markdown(
                    f"**How to apply:** [Open the job posting]({job['url']}) and submit through the "
                    "company's own site. The resume PDF/DOCX below are formatted to read cleanly in "
                    "applicant tracking systems (single column, no tables, standard section headings)."
                )

                entry = generated.get(job_key)

                if entry and entry["status"] == "ok":
                    st.success("Ready to apply.")
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
                    if st.button("Try again", key=f"retry-{job_key}", disabled=not has_api_key):
                        generated.pop(job_key, None)
                        st.rerun()
                else:
                    if st.button("✍️ Write a tailored resume + cover letter for this job", key=f"gen-{job_key}", disabled=not has_api_key):
                        base = storage.load_base_resume()
                        os.makedirs(output_dir, exist_ok=True)
                        with st.spinner("Writing..."):
                            generated[job_key] = generate_for_job(job, base, output_dir)
                        st.rerun()
