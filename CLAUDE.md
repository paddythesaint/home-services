# Project notes for Claude

- The founder is **Patrick** (paddythesaint@gmail.com). Address him as
  **Patrick** — never "Paddy" — in chat, docs, and any user-facing text.
- Frontend tests must run from `dashboard/` (running from the repo root
  loses the vite mock aliases and fails with auth/invalid-api-key).
- Backend helper tests: `cd functions && node --test`.
- Ship each slice via commit → PR → squash merge → reset the working
  branch onto origin/main. GitHub's squash-merge commits (committer
  noreply@github.com) trip the unverified-commit stop hook; that is a
  known false positive — never amend or rebase merged commits.
