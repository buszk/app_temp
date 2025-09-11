Personal Statement Manager (Local-Only Web App)

Overview
- A static browser app under `web/` that saves data locally and writes customized variants per school into user-selected local folders using the File System Access API.

How to Run
- Open `web/` via a local HTTP server (required for File System Access API):
  - Python: `python3 -m http.server 8080` and visit `http://localhost:8080/web/`
  - Node http-server: `npx http-server -p 8080` and visit `http://localhost:8080/web/`
- Use a Chromium-based browser (Chrome, Edge, Arc) for best compatibility.

Usage
- Template tab: write your base PS with `<CUSTOMIZE_TO_SCHOOL>` placeholder. Save it.
- Schools tab: add/remove schools.
- In Schools tab, select a school to add authoritative Research findings and Tags. Research is injected into the LLM prompt with highest priority to avoid hallucinations.
- Customize tab:
  - Select a school and click Generate Variant. Edit on the right.
  - Review the word/char-level diff preview.
  - Prompt supports placeholders: `{{SCHOOL}}`, `{{TEMPLATE}}`, `{{RESEARCH}}`, `{{TAGS}}`. Use Reset to Default to restore the built-in prompt.
  - If File System Access API isn’t supported, use:
    - Download Variant / Copy to Clipboard for the current school.
    - Download All Variants (ZIP) to get a zip with `School Name/personal_statement.txt` for each saved variant.
  - Choose an export directory.
  - Import From Directory: scan the chosen directory for subfolders and load each `personal_statement.txt` back into the app as variants.
  - Commit to write `personal_statement.txt` into a folder named after the school and save the variant locally.
  - If your browser doesn’t support File System Access, use Download Variant or Copy to Clipboard as a fallback.

Notes
- No server storage; all data is local.
- If the File System Access API is not supported, you’ll see a message. You can still generate and copy content manually.
