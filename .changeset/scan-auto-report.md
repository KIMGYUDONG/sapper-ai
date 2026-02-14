---
"sapper-ai": minor
---

Auto-generate HTML report on every scan

- Remove --report flag; HTML report is now always generated alongside JSON
- Save both to ~/.sapperai/scans/{timestamp}.*
- Auto-open report in browser (suppress with --no-open)
- --no-save skips both JSON and HTML
