---
"sapper-ai": minor
"@sapper-ai/core": minor
"@sapper-ai/types": minor
---

Add OpenClaw Skill Scanner with two-phase security analysis

- New types: SkillMetadata, Honeytoken, HoneytokenFinding, SkillScanResult
- New SkillParser with YAML size limits and frontmatter validation
- Static scanning via RulesDetector-based prompt injection detection
- Dynamic scanning via Docker sandbox + mitmproxy honeytoken exfiltration detection
- CLI `sapper-ai openclaw` subcommand with interactive wizard
- Security hardening: YAML bomb defense, error path sanitization, false positive separation
