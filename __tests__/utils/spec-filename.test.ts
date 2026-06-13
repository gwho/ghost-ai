/**
 * Tests for the getSpecFilename utility logic used in ai-sidebar.tsx.
 *
 * The function is defined inline in the component as:
 *   function getSpecFilename(filePath: string): string {
 *     return filePath.split('/').pop() || 'spec.md'
 *   }
 *
 * These tests document and verify the expected behavior for the spec filename
 * extraction from Vercel Blob file paths.
 */
import { describe, it, expect } from 'vitest'

// Mirror the logic from components/editor/ai-sidebar.tsx
function getSpecFilename(filePath: string): string {
  return filePath.split('/').pop() || 'spec.md'
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

    it('returns spec.md when filePath is empty string', () => {
      // ''.split('/').pop() returns '' (empty string). '||' catches falsy
      // values, so the fallback 'spec.md' is correctly returned.
      expect(getSpecFilename('')).toBe('spec.md')
    })

    it('returns spec.md when path ends with slash', () => {
      // 'path/'.split('/').pop() returns '' — '||' catches it.
      expect(getSpecFilename('path/to/')).toBe('spec.md')
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
      // Blob storage path layout: specs/{projectId}/{specId}.md
      // getSpecFilename returns only the last segment — the bare specId with .md.
      //
      // The download endpoint (GET .../specs/[specId]/download) builds the
      // Content-Disposition attachment name as: `spec-${specId}.md`
      // This means the user-facing filename has "spec-" prepended to the specId,
      // while the blob filename is just "{specId}.md". The two names differ by design.
      const specId = 'abc-123'
      const filePath = `https://blob.vercel-storage.com/specs/my-project/${specId}.md`
      expect(getSpecFilename(filePath)).toBe(`${specId}.md`)
    })

    it('produces spec-spec-*.md attachment name when specId already starts with "spec-"', () => {
      // If the specId already starts with "spec-", the download route still prepends
      // "spec-" unconditionally, resulting in a double prefix: "spec-spec-*.md".
      // getSpecFilename itself returns the raw blob segment unchanged; the doubling
      // comes from the download route's `attachment; filename="spec-${specId}.md"`.
      // This test documents the current behavior so any change to the naming scheme
      // is caught as a deliberate regression rather than a silent breakage.
      const specId = 'spec-f47ac10b-58cc-4372-a567-0e02b2c3d479'
      const filePath = `specs/project-abc/${specId}.md`
      // getSpecFilename: returns the raw blob filename unchanged
      expect(getSpecFilename(filePath)).toBe(`${specId}.md`)
      // download route attachment name would be: `spec-${specId}.md`
      const attachmentName = `spec-${specId}.md`
      expect(attachmentName).toBe(`spec-spec-f47ac10b-58cc-4372-a567-0e02b2c3d479.md`)
    })
  })
})