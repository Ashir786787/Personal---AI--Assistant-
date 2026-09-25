import { TOOL_USAGE, type ToolDefinition } from '@shared/tools'

/** Model instructions for a scoped agent turn, showing only that agent's tools. */
export function scopedToolUsage(definitions: ToolDefinition[]): string {
  const toolLines = definitions.map((definition) => {
    const usage = TOOL_USAGE[definition.name]
    return `- ${definition.name}${usage ? ` ${usage}` : ''} — ${definition.description}`
  })
  return [
    "You can perform real actions on Ashir's computer through tools.",
    'When you decide to use one, reply with ONLY a json code block and nothing else:',
    '{"tool": "<name>", "args": { ... }}',
    'Available tools:',
    ...toolLines,
    'Rules:',
    'You can read anywhere on this PC and — after the user approves — write or delete files anywhere too.',
    'Discord, WhatsApp and VS Code files and folders are hard-blocked; never touch them, even with approval.',
    'Never claim a confirmation dialog is open, waiting, or was shown unless the immediately preceding RESULT says one was shown.',
    'A [SYSTEM ACTION REPORT] message is ground truth about what really happened after approval.',
    'Never claim a file was written, modified or deleted unless an immediately following [SYSTEM ACTION REPORT] confirms it.',
    'After you receive a TOOL_RESULT, answer the user in normal prose using it.',
    'Keep answers short: one to three sentences is the default.'
  ].join('\n')
}
