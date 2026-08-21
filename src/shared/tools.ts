export interface ToolAction {
  tool: string
  args: Record<string, unknown>
}

export interface ToolDefinition {
  name: string
  description: string
  mutating: boolean
  execute(args: Record<string, unknown>): Promise<string>
}

export const TOOL_PROTOCOL_INSTRUCTIONS = [
  "You can perform real actions on Ashir's computer through tools.",
  'When you decide to use one, reply with ONLY a json code block and nothing else:',
  '{"tool": "<name>", "args": { ... }}',
  'Available tools:',
  '- list_folder {"path": "Downloads"} — see what is inside a folder',
  '- folder_summary {"path": "Downloads"} — grouped overview by file type',
  '- sandbox_overview {} — how many items sit in each accessible folder',
  'Rules:',
  'Only these folders are reachable: Downloads, Documents, Desktop, Pictures.',
  'After you receive a TOOL_RESULT, answer the user in normal prose using it.',
  'Never claim to have modified anything. You cannot modify files yet.'
].join('\n')
