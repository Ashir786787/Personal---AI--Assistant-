export async function* sseData(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let boundary = buffer.indexOf('\n')
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trimEnd()
      buffer = buffer.slice(boundary + 1)
      if (line.startsWith('data:')) {
        yield line.slice(5).trim()
      }
      boundary = buffer.indexOf('\n')
    }
  }
}
