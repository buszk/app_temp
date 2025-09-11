# Instructions for Agent

This is a documentation that's jointly maintained by you, the llm agent, and the developer.

## Goal
We are building an application management system to help medical school applicants to manage their personal statements while allowing them to adapt their PS to individual schools using LLM automatically.

## Requirement
- This should be a webapp that saves data locally, no data should be stored on the server.
- The applicants will have <CUSTOMIZE_TO_SCHOOL> tag in their personal templates and a list of perspective schools that they are applying.
- The app will use large language model to perform the customization.
- The app should create folders locally for each school.
- Before committing the changes to each school's variant, the app must prompt the user with a word/char-level diff view, so that users knows what they are actually put into the customized version of PS.
- The user should be able to add or edit from the diff view.
- Users should be able to export their data to a local direcotry or import their folder back.

## Agent Instruction
- You must follow the tasks below.
- Before moving to the next task, make sure the current task is complete.
- When working on a new task, mark it as WIP, and DONE when you confirm that it's finished.

## Tasks
- Task 1 [DONE]
  - Design the system
  - Write down the language and framework.
  - Things to consider
    - How to store the data
    - What library to use to show word/char-level diff view while allowing edit
    - What key libraries do we need?

### Task 1 – System Design (DONE)

- Language & Framework
  - TypeScript-free, dependency-free static web app using vanilla ES modules (no build step). Runs in modern Chromium-based browsers.
  - Rationale: meets “webapp that saves data locally” and avoids server/storage; also works within current environment without package installs.

- Data Storage
  - Primary: `localStorage` for app state (template, school list, chosen export directory ID). Small text data fits well and keeps complexity low.
  - Optional upgrade path: IndexedDB to persist `FileSystemDirectoryHandle` when using the File System Access API (handles are storable in IndexedDB in Chromium).

- Local Files and Folders
  - Use the File System Access API to request a root directory from the user and create a subfolder per school, writing `personal_statement.txt` inside each.
  - Fallback: if the API is unavailable, offer a per-school download of the generated text as files via object URLs; user can place them manually.

- LLM Customization Approach
  - Pluggable adapter interface. Initial default behavior replaces `<CUSTOMIZE_TO_SCHOOL>` with the school name (deterministic local transform).
  - Future adapters: WebLLM (on-device), or remote APIs (user-configured) if allowed. The UI will treat LLM as optional and transparent.

- Diff View with Editing
  - Custom lightweight diff engine implemented in-app:
    - Word-level diff via LCS over tokenized words.
    - Char-level highlights within changed words using a small inner LCS.
  - Editable “modified” side: textarea bound to live-diff view so users can edit in place and see immediate diffs before committing.

- Key Modules
  - `storage.js`: load/save app state (template, schools, chosen directory handle reference if supported).
  - `diff.js`: word/char-level diff + rendering helpers.
  - `fs.js`: File System Access helpers; folder creation and file writes.
  - `llm.js`: adapter interface with a default local template-substitution implementation.
  - `app.js`: UI state, views (Template, Schools, Customize), and commit workflow.
  - `index.html` + `styles.css`: minimal SPA shell, accessible UI, and responsive layout.

- Export/Import
  - Export: write to a user-chosen directory using File System Access API. Store the chosen directory handle (when permitted) for reuse.
  - Import: let user pick a root directory; read subfolders and ingest `personal_statement.txt` files back into the app as customized versions.

- Security/Privacy
  - No server calls by default. All data remains in-browser and on local disk via user-approved handles.
  - Clear indicator and opt-in if a remote LLM provider is configured in the future.

- Validation
  - App loads as static files. No build tools required. Test in a Chromium-based browser to exercise File System Access flows.

- Task 1 Status: Files scaffolded (`web/` with app, storage, fs, diff, llm, styles, index). Marked DONE.

### Task 2 – OpenAI Integration (DONE)

- Added UI for API key and customizable prompt (stored locally) in `web/index.html` and wired via `web/app.js` and `web/storage.js`.
- `web/llm.js` now calls OpenAI Chat Completions when a key is present, with fallback to local substitution.
- Prompt accepts `{{SCHOOL}}` and `{{TEMPLATE}}` placeholders; defaults provided.
- Note: Browser calls may require serving over http(s) due to CORS; no server persistence.

- Task 2
  - Let user specify a OPENAI key on the main page.
  - That key will be used to call openai api to make the customization more natural.
  - The LLM prompt used should allow more customization, including how the school is unique and why the applicants match the medical school.
  - The user should be able to customize their prompt.
### Task 3 – Build App (DONE)

- Implemented import-from-folder to ingest school folders and variants back into the app.
- Stores per-school variants locally and auto-loads when selecting a school.
- Commit saves both to disk and local store.

### Task 4 – Let user specify their research finding for each school [DONE]
- Implemented per-school Research and Tags in Schools tab.
  - `web/storage.js`: added `ps_school_meta_v1` with getters/setters for research and tag management.
  - `web/index.html`/`web/app.js`: UI to select a school, edit/save Research, add/remove Tags.
- Prompt updated to include `{{RESEARCH}}` (authoritative) and `{{TAGS}}` (context), with explicit anti-hallucination guidance.
  - `web/storage.js` DEFAULT_PROMPT extended.
  - `web/llm.js` fills the new placeholders from school metadata.
- Research is prioritized in instructions; if insufficient, the model is told to avoid fabricating specifics.
