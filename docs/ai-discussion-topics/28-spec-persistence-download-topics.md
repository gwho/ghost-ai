# AI Discussion Topics: Feature 28 — Spec Persistence + Download

Use these questions to test your understanding or deepen it. Try answering before asking an AI.

---

## Architecture

1. This feature stores the Blob URL in `ProjectSpec.filePath` rather than the actual Markdown content. What are the tradeoffs of this design? When would storing the content directly in the database make more sense?

2. The `specId` is a `crypto.randomUUID()` generated inside the Trigger.dev task. An alternative would be to let Prisma auto-generate a CUID. Why was the task-generated approach chosen, and what would break if Prisma generated the ID instead?

3. The blob path is `specs/{projectId}/{specId}.md`. Why include `projectId` in the path if each `specId` is already globally unique?

---

## Security

4. The download route calls `getProjectAccess(projectId)` AND then `prisma.projectSpec.findFirst({ where: { id: specId, projectId } })`. Why are both checks necessary? What attack does the second check prevent?

5. The Blob is uploaded with `access: 'private'`. What would happen if it were `access: 'public'`? Would the access checks in the download route still matter?

---

## Task Design

6. The task now sets `metadata.set('status', 'saving')` between the AI call and the Prisma write. What benefit does this provide for a frontend that subscribes to the task's realtime metadata?

7. The task has `retry: { maxAttempts: 2 }`. If the Prisma write fails on the first attempt and the task retries, what happens? Could a second `ProjectSpec` record be created with a different `specId` for the same generation run?

---

## Download Route

8. The route uses `new Response(blobResult.stream).text()` to read the blob content. Why not just pass the stream directly to `NextResponse`? What would need to be true for streaming to work?

9. The `Content-Disposition: attachment` header tells the browser to download the file rather than display it. What header value would you use instead if you wanted the browser to render the Markdown inline?

---

## Database

10. The `ProjectSpec` model has `@@index([projectId, createdAt])`. What query would this index help with? If you wanted to list all specs for a project ordered by newest first, how would that query look in Prisma?
