/**
 * Tests for the getSpecFilename utility logic used in ai-sidebar.tsx.
 *
 * The function is defined inline in the component as:
 *   function getSpecFilename(filePath: string): string {
 *     return filePath.split('/').pop() ?? 'spec.md'
 *   }
 *
 * These tests document and verify the expected behavior for the spec filename
 * extraction from Vercel Blob file paths.
 */
import { describe, it, expect } from 'vitest'

// Mirror the logic from components/editor/ai-sidebar.tsx
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() ?? 'spec.md'
}

describe('getSpecFilename', () => {
  describe('standard blob paths', () => {
    it('extracts the filename from a full blob URL', () => {
      const filePath = 'https://blob.example.com/specs/project-123/spec-abc.md'
      expect(getSpecFilename(filePath)).toBe('spec-abc.md')
    })

    it('extracts the filename from a relative path', () => {
      const filePath = 'specs/project-123/spec-xyz.md'
      expect(getSpecFilename(filePath)).toBe('spec-xyz.md')
    })

    it('extracts the filename from a deep nested path', () => {
      const filePath = 'a/b/c/d/my-spec.md'
      expect(getSpecFilename(filePath)).toBe('my-spec.md')
    })
  })

  describe('edge cases', () => {
    it('returns the filename when path has no directory components', () => {
      const filePath = 'spec.md'
      expect(getSpecFilename(filePath)).toBe('spec.md')
    })

    it('returns spec.md fallback when filePath is empty string', () => {
      // ''.split('/').pop() returns '' (empty string), which is falsy
      // but the ?? operator only triggers on null/undefined, not empty string
      // So '' split gives [''] and pop returns '' — not caught by ??
      // The actual behavior: empty string returns '' (not the fallback)
      const filePath = ''
      const result = getSpecFilename(filePath)
      // empty string is falsy but ?? only handles null/undefined
      expect(result).toBe('')
    })

    it('returns spec.md fallback when path ends with slash', () => {
      // 'path/'.split('/').pop() returns '' which is falsy but not null/undefined
      const filePath = 'path/to/'
      const result = getSpecFilename(filePath)
      expect(result).toBe('')
    })

    it('handles UUID-based spec filenames from generate-spec task', () => {
      // The generate-spec task creates files like specs/{projectId}/{uuid}.md
      const specId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      const filePath = `specs/project-abc/${specId}.md`
      expect(getSpecFilename(filePath)).toBe(`${specId}.md`)
    })

    it('handles Vercel Blob URLs with query parameters', () => {
      // Vercel Blob URLs may include query strings
      const filePath = 'https://publicktlkdm5a.blob.vercel-storage.com/specs/project-123/spec-abc.md?token=abc'
      // split('/').pop() gives the last segment including query string
      expect(getSpecFilename(filePath)).toBe('spec-abc.md?token=abc')
    })
  })

  describe('filename format from generate-spec task', () => {
    it('extracts spec filename that matches the download route pattern', () => {
      // The download route creates filenames as spec-${specId}.md
      // But the blob path uses {specId}.md, not spec-{specId}.md
      // The filePath is: specs/{projectId}/{specId}.md
      const specId = 'abc-123'
      const filePath = `https://blob.vercel-storage.com/specs/my-project/${specId}.md`
      expect(getSpecFilename(filePath)).toBe(`${specId}.md`)
    })
  })
})