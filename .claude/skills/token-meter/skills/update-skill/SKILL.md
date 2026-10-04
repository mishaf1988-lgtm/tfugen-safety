---
name: update-skill
description: Upload a new or updated skill file (.skill / .zip) to the user's claude.ai account so it reaches every Claude interface. Use when the user drags a skill file into the chat and says "עדכן סקיל", "תעלה סקיל", "update skill", or runs /update-skill.
---

# Update a skill in the claude.ai account

The user (Michael) uses Claude on every interface, so skills must live in the claude.ai account, not only locally. Talk to him in Hebrew.

## Standing approval
Michael, 04/10/2026: "כן תמיד העלה ועדכן". He does not need to be asked before each upload. Check the file, show what changed, and upload in the same turn.
Stop and ask only if:
- something in the file looks odd (see step 2),
- the page asks to delete something, or
- the page asks to accept terms or consents.
The page's own "Upload and replace" dialog is the update itself, so it is covered by this approval. It keeps the earlier versions in history.

## Steps

1. **Find the file.** Take the path the user dragged in or named. Don't search the disk for one on your own.
   - If no file arrived, drag-and-drop may not be working. In one message, ask him to either write the full path or allow a look in Downloads.

2. **Check it.** Extract it to the scratchpad (never in place). Confirm there is a `SKILL.md` with frontmatter `name` and `description`. Read the whole SKILL.md and list the other files.
   - If a skill with the same name is already loaded in this session (for example `anthropic-skills:<name>`), compare and summarize in 3–6 Hebrew bullets what changed.
   - Report anything odd: no SKILL.md, a different name than expected, scripts that reach the network or delete files. If something is odd, don't upload. Ask first.

3. **Get folder access before uploading.** Chrome's `file_upload` only accepts files from folders granted to this session. Copying the file into the scratch workspace does not help (tried 04/10/2026, rejected). So, before the upload, call `request_directory` with the folder that holds the file, for example `C:\Users\michaelf\OneDrive - tapugan.co.il\שולחן העבודה`.

4. **Upload through Claude in Chrome** (the user's Chrome, where he's logged in):
   - Load the tools in one ToolSearch call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__file_upload`
   - Go straight to `https://claude.ai/customize/skills/new/upload` (as of 04/10/2026: Customize > Skills > Add > Upload skill; `settings/capabilities` just redirects to a new chat). If the page moved, look for it with `find`/`read_page`.
   - Use `find` to get the "Skill file" input, then upload the original file Michael gave (not the extracted folder) with `file_upload`. Click Upload.
   - If a skill with that name exists, the page shows "Replace ... skill?". Click "Upload and replace". Don't use Remove.
   - Close the tab when done.

5. **Confirm.** Check with `get_page_text` that the skill page shows "updated just now" with the new version line. Report in Hebrew in one or two lines. Mention that a new chat is needed for the change to load.

## If something goes wrong
- Claude in Chrome isn't connected: say so and give him the manual path (claude.ai > Customize > Skills > Add > Upload skill).
- The page asks him to sign in, or shows a CAPTCHA: stop and let him do it himself.
