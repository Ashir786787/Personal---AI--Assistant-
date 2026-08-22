import type { ToolAction, ToolDefinition } from '@shared/tools'
import type { ActionProposal } from '@shared/ipc'
import { readOnlyFileTools } from './file-tools'
import { createSystemTools } from './system-tools'
import { createRoutineTools } from './routine-tools'

export class ToolExecutionError extends Error {}

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>()

  register(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  isMutating(name: string): boolean {
    return this.tools.get(name)?.mutating ?? true
  }

  async execute(action: ToolAction): Promise<string> {
    const tool = this.tools.get(action.tool)
    if (!tool) {
      throw new ToolExecutionError(
        `Unknown tool "${action.tool}". Tell the user you do not have that capability`
      )
    }
    if (tool.mutating) {
      throw new ToolExecutionError(
        `Tool "${action.tool}" requires user approval first. Ask the user to confirm`
      )
    }
    return tool.execute(action.args)
  }

  static withDefaults(emitProposal: (proposal: ActionProposal) => void): ToolRegistry {
    const registry = new ToolRegistry()
    for (const tool of [
      ...readOnlyFileTools(emitProposal),
      ...createSystemTools(emitProposal),
      ...createRoutineTools(emitProposal)
    ]) {
      registry.register(tool)
    }
    return registry
  }
}
