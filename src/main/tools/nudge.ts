const FILE_INTENT_PATTERN =
  /\b(download|document|desktop|picture|file|folder|organiz|tidy|clean\s?up|list\s?(all|my)|how many)\b/i

export function looksFileRelated(userText: string): boolean {
  return FILE_INTENT_PATTERN.test(userText)
}

export function shouldNudge(input: {
  hadAction: boolean
  alreadyNudged: boolean
  userText: string
  replyText: string
}): boolean {
  if (input.hadAction || input.alreadyNudged) return false
  if (!looksFileRelated(input.userText)) return false
  return !/TOOL_RESULT/i.test(input.replyText)
}

export const NUDGE_MESSAGE =
  'REMINDER: You described files but never called a tool, so anything you said is unverified. ' +
  'Reply ONLY with the json action block now, for example {"tool":"list_folder","args":{"path":"Downloads"}}'
