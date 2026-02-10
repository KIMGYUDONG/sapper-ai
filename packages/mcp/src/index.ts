// MCP integration for SapperAI
import { coreVersion } from '@sapper-ai/core'

export const mcpVersion = coreVersion

export { StdioSecurityProxy } from './StdioSecurityProxy'
export { parseCliArgs, resolvePolicy, runCli } from './cli'
