# README Quick Start Simplification

## Goal

Simplify root README Quick Start to a single install path (`npm install` / `pnpm install sapper-ai` only). Remove Option 2 (MCP), Option 3 (OpenAI), and redundant Installation section entries.

## Decisions

- **Commands**: `pnpm add` → `npm install` / `pnpm install` (parallel display with `# or`)
- **Quick Start**: Collapse 3 options → single `sapper-ai` install only
- **Option 2 (MCP), Option 3 (OpenAI)**: Delete entirely from Quick Start (already in sub-package READMEs + Packages table links)
- **Installation section**: Remove "Individual packages" block (redundant)
- **Scope**: Root `README.md` only (sub-package READMEs unchanged)

## TODO List

### 1. Replace Quick Start section (line 16-73)

**File**: `README.md`

Replace the entire Quick Start section (3 options + code examples) with:

```md
## Quick Start

```bash
npm install sapper-ai
# or
pnpm install sapper-ai
```

```ts
import { createGuard } from 'sapper-ai'

const guard = createGuard()
const decision = await guard.check({ toolName: 'shell', arguments: { cmd: 'ls' } })
```
```

This removes:
- `### Option 1: Single Install (Recommended)` heading
- `### Option 2: MCP Proxy (No Code)` heading + install command + CLI examples (line 32-46)
- `### Option 3: OpenAI Agents Integration` heading + install command + code example (line 48-73)

### 2. Remove "Individual packages" from Installation section (line 172-175)

**File**: `README.md`

**Before**:
```bash
# Full monorepo (for development)
git clone https://github.com/sapper-ai/sapperai.git
cd sapperai
pnpm install
pnpm build

# Individual packages (for usage)
pnpm add @sapper-ai/core
pnpm add @sapper-ai/mcp
pnpm add @sapper-ai/openai
```

**After**:
```bash
# Full monorepo (for development)
git clone https://github.com/sapper-ai/sapperai.git
cd sapperai
pnpm install
pnpm build
```

## Not Changed

- Sub-package READMEs (`packages/*/README.md`) — keep `pnpm add` as-is
- `npx sapper-ai init` — removed (was part of Option 1, not needed in minimal Quick Start)
- Architecture section — unchanged
- Packages table — unchanged (provides links to MCP/OpenAI sub-packages)
- Direct Integration (Advanced) section — unchanged
- Detection Capabilities, Performance, Verified Metrics — unchanged

## Verification

- [ ] Quick Start has no Option headings, just one install block + one code block
- [ ] `pnpm add` does not appear in root README
- [ ] MCP and OpenAI install/code examples are gone from Quick Start
- [ ] Installation section only contains monorepo clone instructions
- [ ] Packages table still links to all sub-packages
- [ ] No other sections modified
