import { describe, expect, it } from 'vitest'
import { detectDomains, isComplexRequest } from '../../src/main/tools/orchestrator'

describe('orchestrator domain detection', () => {
  it('maps single-domain requests to one agent', () => {
    expect(detectDomains('tidy up my downloads folder')).toEqual(['FILES'])
    expect(detectDomains('turn up the volume')).toEqual(['SYSTEM'])
    expect(detectDomains('schedule a nightly tidy')).toEqual(['ROUTINES'])
    expect(detectDomains('research this for me')).toEqual(['RESEARCH'])
  })

  it('spans domains for multi-part requests', () => {
    expect(detectDomains('organize my downloads and set the volume to 40').sort()).toEqual(
      ['FILES', 'SYSTEM'].sort()
    )
    expect(detectDomains('research which files are photos').sort()).toEqual(
      ['FILES', 'RESEARCH'].sort()
    )
  })

  it('treats plain chatting as no domain', () => {
    expect(detectDomains('hello there how are you today')).toEqual([])
  })
})

describe('orchestrator complexity', () => {
  it('delegates requests touching several domains', () => {
    expect(isComplexRequest('organize my downloads and set the volume to 40')).toBe(true)
  })

  it('delegates research requests', () => {
    expect(isComplexRequest('research how to speed up my pc')).toBe(true)
    expect(isComplexRequest('look up the best folder names for my projects')).toBe(true)
  })

  it('keeps plain chat questions local instead of delegating', () => {
    expect(isComplexRequest('what is two plus two')).toBe(false)
    expect(isComplexRequest('tell me about karachi')).toBe(false)
    expect(isComplexRequest('how do I calm down')).toBe(false)
  })

  it('delegates when the team is requested explicitly', () => {
    expect(isComplexRequest('use your subagents to do this across the board')).toBe(true)
  })

  it('keeps simple single-domain requests local', () => {
    expect(isComplexRequest('set the volume to 40')).toBe(false)
    expect(isComplexRequest('what is two plus two')).toBe(false)
    expect(isComplexRequest('launch spotify')).toBe(false)
  })
})
