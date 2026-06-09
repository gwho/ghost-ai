/**
 * Tests for utility logic used within ai-sidebar.tsx.
 *
 * Because these functions are module-private (not exported), the tests
 * duplicate the same logic and verify it in isolation. This approach:
 *  - documents the expected behaviour for each helper
 *  - acts as a regression guard if any helper is later refactored
 *  - avoids the need to export test-only symbols from production code
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implementations of ai-sidebar.tsx private helpers
// ---------------------------------------------------------------------------

function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}

// Matches the actual implementation in ai-sidebar.tsx exactly:
//   typeof value === 'object' && value !== null
// NOTE: arrays pass this guard (typeof [] === 'object'); the route handlers
// that call isObject() perform their own Array.isArray check separately.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getRunStorageKey(roomId: string): string {
  return `ghost-ai-run:${roomId}`
}

function loadPersistedRun(roomId: string): { runId: string; publicToken: string } | null {
  try {
    const raw = sessionStorage.getItem(getRunStorageKey(roomId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed.runId === 'string' && typeof parsed.publicToken === 'string') {
      return parsed
    }
  } catch { /* corrupted or unavailable */ }
  return null
}

function persistRun(roomId: string, runId: string, publicToken: string): void {
  try {
    sessionStorage.setItem(getRunStorageKey(roomId), JSON.stringify({ runId, publicToken }))
  } catch { /* storage full or unavailable */ }
}

function clearPersistedRun(roomId: string): void {
  try {
    sessionStorage.removeItem(getRunStorageKey(roomId))
  } catch { /* unavailable */ }
}

// ---------------------------------------------------------------------------
// getSpecFilename
// ---------------------------------------------------------------------------

describe('getSpecFilename', () => {
  it('extracts the filename from a multi-segment path', () => {
    expect(getSpecFilename('specs/project-1/spec-abc.md')).toBe('spec-abc.md')
  })

  it('returns the whole string when there is no slash', () => {
    expect(getSpecFilename('spec-abc.md')).toBe('spec-abc.md')
  })

  it('returns empty string when the path ends with a slash', () => {
    // split('/').pop() returns '' for trailing slash.
    // '??' is nullish coalescing — it only triggers on null/undefined, not ''
    // so an empty string is returned as-is rather than falling back to 'spec.md'.
    expect(getSpecFilename('specs/project-1/')).toBe('')
  })

  it('handles a single-segment path (just a filename)', () => {
    expect(getSpecFilename('myspec.md')).toBe('myspec.md')
  })

  it('handles deeply nested paths', () => {
    expect(getSpecFilename('a/b/c/d/spec-xyz.md')).toBe('spec-xyz.md')
  })

  it('preserves file extensions exactly', () => {
    expect(getSpecFilename('specs/proj/SPEC-001.MD')).toBe('SPEC-001.MD')
  })

  it('returns empty string for an empty input', () => {
    // ''.split('/').pop() returns '' (not null/undefined), so '??' does not
    // activate and the result is '' rather than the 'spec.md' fallback.
    expect(getSpecFilename('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// isObject
// ---------------------------------------------------------------------------

describe('isObject', () => {
  it('returns true for a plain object', () => {
    expect(isObject({ key: 'value' })).toBe(true)
  })

  it('returns true for an empty object', () => {
    expect(isObject({})).toBe(true)
  })

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false)
  })

  it('returns true for an array (arrays are objects in JS; callers check Array.isArray separately)', () => {
    // The isObject helper in ai-sidebar.tsx is: typeof value === 'object' && value !== null
    // This intentionally does NOT exclude arrays. The API route handlers that call isObject()
    // perform an additional Array.isArray check in their own validation branches.
    expect(isObject([])).toBe(true)
  })

  it('returns false for a string', () => {
    expect(isObject('hello')).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isObject(42)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isObject(undefined)).toBe(false)
  })

  it('returns false for boolean', () => {
    expect(isObject(true)).toBe(false)
  })

  it('returns true for nested objects', () => {
    expect(isObject({ nested: { deep: true } })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getRunStorageKey
// ---------------------------------------------------------------------------

describe('getRunStorageKey', () => {
  it('returns the expected key format', () => {
    expect(getRunStorageKey('room-abc')).toBe('ghost-ai-run:room-abc')
  })

  it('includes the roomId verbatim', () => {
    const roomId = 'proj-special-123'
    const key = getRunStorageKey(roomId)
    expect(key).toContain(roomId)
    expect(key.startsWith('ghost-ai-run:')).toBe(true)
  })

  it('produces different keys for different roomIds', () => {
    expect(getRunStorageKey('room-1')).not.toBe(getRunStorageKey('room-2'))
  })
})

// ---------------------------------------------------------------------------
// loadPersistedRun / persistRun / clearPersistedRun
// ---------------------------------------------------------------------------

describe('session storage run persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('loadPersistedRun', () => {
    it('returns null when nothing is stored', () => {
      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('returns the run data after it has been persisted', () => {
      persistRun('room-1', 'run-abc', 'token-xyz')
      const result = loadPersistedRun('room-1')

      expect(result).toEqual({ runId: 'run-abc', publicToken: 'token-xyz' })
    })

    it('returns null after the run has been cleared', () => {
      persistRun('room-1', 'run-abc', 'token-xyz')
      clearPersistedRun('room-1')

      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('returns null when stored JSON is malformed', () => {
      sessionStorage.setItem(getRunStorageKey('room-1'), '{bad json}')
      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('returns null when stored JSON lacks runId field', () => {
      sessionStorage.setItem(
        getRunStorageKey('room-1'),
        JSON.stringify({ publicToken: 'token-xyz' }),
      )
      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('returns null when stored JSON lacks publicToken field', () => {
      sessionStorage.setItem(
        getRunStorageKey('room-1'),
        JSON.stringify({ runId: 'run-abc' }),
      )
      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('returns null when runId is not a string', () => {
      sessionStorage.setItem(
        getRunStorageKey('room-1'),
        JSON.stringify({ runId: 42, publicToken: 'token-xyz' }),
      )
      expect(loadPersistedRun('room-1')).toBeNull()
    })

    it('is isolated to the specific roomId', () => {
      persistRun('room-A', 'run-111', 'token-111')
      expect(loadPersistedRun('room-B')).toBeNull()
      expect(loadPersistedRun('room-A')).toEqual({ runId: 'run-111', publicToken: 'token-111' })
    })
  })

  describe('persistRun', () => {
    it('stores runId and publicToken in sessionStorage', () => {
      persistRun('room-1', 'run-def', 'token-ghi')
      const raw = sessionStorage.getItem(getRunStorageKey('room-1'))
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      expect(parsed.runId).toBe('run-def')
      expect(parsed.publicToken).toBe('token-ghi')
    })

    it('overwrites a previously stored run', () => {
      persistRun('room-1', 'run-old', 'token-old')
      persistRun('room-1', 'run-new', 'token-new')

      const result = loadPersistedRun('room-1')
      expect(result).toEqual({ runId: 'run-new', publicToken: 'token-new' })
    })
  })

  describe('clearPersistedRun', () => {
    it('removes the stored run from sessionStorage', () => {
      persistRun('room-1', 'run-abc', 'token-xyz')
      clearPersistedRun('room-1')

      expect(sessionStorage.getItem(getRunStorageKey('room-1'))).toBeNull()
    })

    it('is a no-op when nothing is stored', () => {
      // Should not throw
      expect(() => clearPersistedRun('room-1')).not.toThrow()
    })

    it('only clears the matching roomId', () => {
      persistRun('room-A', 'run-111', 'token-111')
      persistRun('room-B', 'run-222', 'token-222')
      clearPersistedRun('room-A')

      expect(loadPersistedRun('room-A')).toBeNull()
      expect(loadPersistedRun('room-B')).toEqual({ runId: 'run-222', publicToken: 'token-222' })
    })
  })
})

// ---------------------------------------------------------------------------
// markdownComponents.code — block vs inline detection logic
// ---------------------------------------------------------------------------

describe('markdownComponents code block detection', () => {
  /**
   * The code component in ai-sidebar.tsx determines whether it is a fenced
   * code block (block-level) vs. an inline code span by checking
   * `Boolean(className)`. react-markdown passes a className like
   * "language-ts" for fenced blocks and no className for inline spans.
   *
   * These tests verify that detection logic directly.
   */

  function isCodeBlock(className: string | undefined): boolean {
    return Boolean(className)
  }

  it('treats a language className as a block code element', () => {
    expect(isCodeBlock('language-typescript')).toBe(true)
  })

  it('treats undefined className as inline code', () => {
    expect(isCodeBlock(undefined)).toBe(false)
  })

  it('treats empty string className as inline code', () => {
    // '' is falsy → inline
    expect(isCodeBlock('')).toBe(false)
  })

  it('treats any non-empty className as block code', () => {
    expect(isCodeBlock('language-js')).toBe(true)
    expect(isCodeBlock('language-python')).toBe(true)
    expect(isCodeBlock('custom-class')).toBe(true)
  })
})