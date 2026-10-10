import { useCallback, useMemo, useState } from 'react'
import type { Block, InlineToken } from '../../lib/markdown'
import { isExternalHref, parseBlocks } from '../../lib/markdown'

function openSafe(href: string): void {
  if (!isExternalHref(href)) return
  void window.ashirs?.openExternalIfHttps(href)
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'text':
            return <span key={index}>{token.text}</span>
          case 'bold':
            return (
              <strong key={index}>
                <Inline tokens={token.children} />
              </strong>
            )
          case 'italic':
            return (
              <em key={index}>
                <Inline tokens={token.children} />
              </em>
            )
          case 'code':
            return (
              <code
                key={index}
                className="rounded bg-base/70 px-1 py-0.5 font-mono text-[0.9em] text-accent"
              >
                {token.text}
              </code>
            )
          case 'link':
            return isExternalHref(token.href) ? (
              <button
                key={index}
                type="button"
                onClick={() => openSafe(token.href)}
                className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
                title="Opens in your browser (https only)"
              >
                <Inline tokens={token.children} />
              </button>
            ) : (
              <span key={index} className="text-ink-muted">
                <Inline tokens={token.children} />
              </span>
            )
        }
      })}
    </>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback((): void => {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        setCopied(false)
      })
  }, [code])

  return (
    <div className="group relative rounded-lg border border-edge bg-base/80">
      {code.split('\n').length > 1 && (
        <div className="flex items-center justify-end border-b border-edge px-2 py-1">
          <button
            type="button"
            onClick={copy}
            className="rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-ink-muted hover:bg-panel-raised hover:text-ink"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed text-ink">
        {code}
      </pre>
    </div>
  )
}

function renderBlock(block: Block, index: number): JSX.Element {
  switch (block.type) {
    case 'code':
      return <CodeBlock key={index} code={block.code} />
    case 'heading':
      if (block.level === 1)
        return (
          <p key={index} className="text-base font-semibold text-ink">
            <Inline tokens={block.tokens} />
          </p>
        )
      return (
        <p key={index} className="text-sm font-semibold text-ink">
          <Inline tokens={block.tokens} />
        </p>
      )
    case 'list':
      if (block.ordered) {
        return (
          <ol key={index} className="list-inside list-decimal space-y-1">
            {block.items.map((item, i) => (
              <li key={i}>
                <Inline tokens={item} />
              </li>
            ))}
          </ol>
        )
      }
      return (
        <ul key={index} className="list-inside list-disc space-y-1">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline tokens={item} />
            </li>
          ))}
        </ul>
      )
    case 'para':
      return (
        <p key={index} className="whitespace-pre-wrap">
          <Inline tokens={block.tokens} />
        </p>
      )
  }
}

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return <div className="space-y-2">{blocks.map(renderBlock)}</div>
}
