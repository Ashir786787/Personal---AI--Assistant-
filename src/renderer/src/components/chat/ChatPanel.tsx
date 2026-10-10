import { useState } from 'react'
import type { ActionProposal } from '@shared/ipc'
import type { UiMessage } from '../../hooks/useChat'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ApprovalInline } from './ApprovalInline'

interface ChatPanelProps {
  messages: UiMessage[]
  busy: boolean
  powered: boolean
  value: string
  onValueChange: (value: string) => void
  ttsEnabled: boolean
  micListening: boolean
  micLevel: number
  voiceNotice: string | null
  canRegenerate: boolean
  /** Non-destructive approvals render inline; destructive ones use the blocking modal. */
  inlineApproval: { proposal: ActionProposal; queued: number; busy: boolean } | null
  onSend: (text: string) => void
  onStop: () => void
  onRegenerate: () => void
  onApprove: (approved: boolean) => void
  onToggleMic: () => void
  onToggleTts: () => void
  onClear: () => Promise<void>
}

export function ChatPanel({
  messages,
  busy,
  powered,
  value,
  onValueChange,
  ttsEnabled,
  micListening,
  micLevel,
  voiceNotice,
  canRegenerate,
  inlineApproval,
  onSend,
  onStop,
  onRegenerate,
  onApprove,
  onToggleMic,
  onToggleTts,
  onClear
}: ChatPanelProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  const stateText = busy ? 'Thinking' : micListening ? 'Listening' : 'Idle'

  const doClear = async (): Promise<void> => {
    setClearing(true)
    try {
      await onClear()
      setConfirmClear(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <aside className="glass-deep m-3 ml-0 flex w-[380px] shrink-0 flex-col rounded-xl lg:w-[480px] xl:max-w-[520px]">
      <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-ink">
            ASHIR
          </span>
          <span
            className={`font-mono text-[11px] uppercase tracking-widest ${
              busy ? 'text-accent animate-pulse' : 'text-ink-muted'
            }`}
          >
            {stateText}
          </span>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-warning">Erase chat?</span>
            <button
              type="button"
              className="btn-cancel btn-small"
              disabled={clearing}
              onClick={() => void doClear()}
            >
              {clearing ? 'Erasing…' : 'Yes'}
            </button>
            <button
              type="button"
              className="btn-cancel btn-small"
              disabled={clearing}
              onClick={() => setConfirmClear(false)}
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="gear-btn"
            title="Clear chat history"
            aria-label="Clear chat history"
            onClick={() => setConfirmClear(true)}
          >
            🗑
          </button>
        )}
      </div>
      <MessageList messages={messages} onSuggestion={onValueChange} />
      {inlineApproval && (
        <div className="border-t border-edge px-4 py-3">
          <ApprovalInline
            proposal={inlineApproval.proposal}
            busy={inlineApproval.busy}
            queued={inlineApproval.queued}
            onDecide={onApprove}
          />
        </div>
      )}
      <ChatInput
        value={value}
        onValueChange={onValueChange}
        busy={busy}
        powered={powered}
        ttsEnabled={ttsEnabled}
        micListening={micListening}
        micLevel={micLevel}
        voiceNotice={voiceNotice}
        canRegenerate={canRegenerate}
        onSend={onSend}
        onStop={onStop}
        onRegenerate={onRegenerate}
        onToggleMic={onToggleMic}
        onToggleTts={onToggleTts}
      />
    </aside>
  )
}
