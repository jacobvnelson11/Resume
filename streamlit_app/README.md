# Job Application Assistant (Streamlit app)

A local app that runs entirely on your own computer: no database, no server,
no hosting. Finds remote marketing/sales jobs, scores how well each one fits
your resume, and writes a tailored resume + cover letter for the ones you pick.

**Searching for jobs needs no API key or account** — it's all free, public
job-board data. Only the "write a tailored resume" step needs an Anthropic
API key, and that's a separate button per job.

## One-time setup (Mac)

1. Open **Terminal** (press `Cmd + Space`, type `Terminal`, hit Enter).
2. Check you have Python 3 (macOS usually already has it):
   ```
   python3 --version
   ```
   If that fails, install it from [python.org/downloads](https://www.python.org/downloads/).
3. Go to this folder and install the app's dependencies (one-time):
   ```
   cd path/to/Resume/streamlit_app
   pip3 install -r requirements.txt
   ```

## Running it

Every time you want to use the app:
```
cd path/to/Resume/streamlit_app
streamlit run app.py
```
Your browser will open automatically to the app (usually `http://localhost:8501`).
Leave the Terminal window open while you use it; closing it stops the app.

## Using it

1. Click **"Find new jobs"** — no setup needed. It searches RemoteOK, We Work
   Remotely, and (optionally) any Greenhouse company boards you list in the
   sidebar, filters to remote + your salary floor + relevant titles, and
   scores each one's fit as a percentage.
2. Jobs you've already been shown won't be suggested again on future
   searches — the app remembers them in `data/seen_jobs.json`. Click
   **"Reset job history"** in the sidebar if you want to see everything again.
3. To get a tailored resume for a specific job, add your Anthropic API key
   in the sidebar (get one at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys))
   and click **"Write a tailored resume + cover letter for this job"** on
   that job's card.
4. Generated files are saved to the folder you set in the sidebar (default:
   `streamlit_app/output/`), named `Company - Role.pdf` / `.docx`, plus a
   matching cover letter PDF. You can also download them straight from the
   app.
5. Nothing gets submitted anywhere automatically — each job card links to
   the real posting so you apply yourself, attaching the generated files.

## Before relying on generated resumes

Edit `data/base_resume.json` with your real, specific experience bullets
(the summary/skills/certifications are editable right in the app's sidebar;
experience bullets need a text editor since they're a nested list). The AI
only reorders and lightly rewords what's already in this file — it never
invents an employer, title, date, or accomplishment that isn't there.
