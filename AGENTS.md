# Project working agreements

- Build a minimal, Chinese-language personal finance app for iOS and Android using Expo / React Native / TypeScript.
- Design: clean iOS-inspired surfaces, restrained frosted glass, fluid and interruptible animation, accessible contrast and reduced-motion support. Keep the main navigation small.
- Use the existing checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user explicitly asks.
- The primary Git author is the user's confirmed GitHub account `kitty191`, using `265797658+kitty191@users.noreply.github.com` (GitHub user ID verified from the official profile). The cloud committer is `Codex <codex@openai.com>`. Explicitly set Author and Committer separately. Machine-level or global Git user settings do not establish the user's identity. Do not substitute a Co-authored-by trailer for the author requirement. Never copy credentials into files.
- Also credit Codex as a contributing co-author with the commit-message trailer `Co-authored-by: Codex <codex@openai.com>`. Keep `kitty191` as the primary Author. GitHub account attribution and Contributors display depend on GitHub's email association and indexing; do not claim account linkage without verification.
- Store money as integer minor units. Transfers must not count as income or expenses. Validate backups before replacing local data, and keep persistence failures visible.
- Keep first launch empty; sample records require an explicit user action.
- Check `npm run typecheck`, `npm test`, and `npm run export:web` for relevant changes. Run `npm run test:e2e` for changes to the entry/persistence workflow. Native device validation remains necessary before release.
