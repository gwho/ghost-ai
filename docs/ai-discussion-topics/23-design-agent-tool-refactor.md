# AI Discussion Topics: Design Agent Tool Refactor

These topics explore the core concepts behind switching from structured output generation to tool-calling in an AI agent.

---

## 1. generateObject vs. generateText + tools — when to use each

**Question**: Both `generateObject` and `generateText` + tools can produce structured data. What are the trade-offs? When would you choose one over the other?

**What to understand**: `generateObject` is great for a single, well-defined output shape (e.g. "classify this email"). Tool calling is better when the output is a variable-length sequence of actions, when individual items need independent validation, or when you want the model to compose operations rather than fill in a template. Explore the concept of "structured output" vs. "structured behavior."

---

## 2. Why tool execute functions are stubs here

**Question**: Each tool's `execute` function just returns `{ ok: true }` and does nothing. Isn't that defeating the purpose of tool calling?

**What to understand**: In agentic architectures, there are two patterns — (a) tools that do real work immediately (call an API, write to a DB), and (b) tools used purely as a structured output channel (collect the calls, then apply them as a batch). Pattern (b) gives you control: you can validate the full action sequence, apply them in a single atomic transaction, and handle errors without partial writes. Discuss when you'd use each pattern and what the trade-offs are.

---

## 3. stopWhen: stepCountIs(n) — understanding multi-step generation

**Question**: What is a "step" in `generateText`? Why does `stopWhen: stepCountIs(10)` allow the model to call multiple tools instead of stopping after the first one?

**What to understand**: Each "step" is one round-trip — the model produces output, tools execute, results feed back. Without a multi-step limit, the model stops after 1 step. `stepCountIs(10)` means the loop can run up to 10 rounds. In practice, Gemini may batch all tool calls in a single step (parallel tool calling) or spread them across 2–3 steps. Explore how the step budget affects latency vs. flexibility.

---

## 4. Dangling edge validation — why order matters

**Question**: Why does the validation check `nodeIds.has(edge.source)` instead of `nodeMap.has(edge.source)`? Why does the system process `addNode` calls before applying `addEdge` calls?

**What to understand**: The model is instructed to add all nodes first, then edges — but it might not always follow this order perfectly. The validation tracks `nodeIds` as a running set and checks membership at the time each edge is processed. If the model calls `addEdge` before `addNode`, the edge is skipped. This is a form of ordering invariant enforcement — discuss how agents can violate prompt instructions and why defensive validation matters.

---

## 5. RawCall casting — TypeScript generics and the limits of type inference

**Question**: Why does the code cast `call.input as z.infer<typeof AddNodeSchema>` instead of using TypeScript's discriminant narrowing on `call.toolName`?

**What to understand**: The `TypedToolCall<TOOLS>` type is a complex generic mapped union. TypeScript can narrow it correctly in simple cases, but when the type is extracted from a deeply nested `ReturnType<typeof generateText<...>>`, the discriminant narrowing breaks down. Using explicit `as` casts inside each branch is pragmatic — you've already proven the variant via the `toolName` check, so the cast is safe. Discuss when type assertions are acceptable vs. a sign of a design problem.

---

## 6. The `validateAction` helper — separation of validation from mutation

**Question**: Why is validation extracted into a separate `validateAction` function that returns `{ valid, reason }` instead of inlining the checks into the processing loop?

**What to understand**: Separating validation from mutation makes the code easier to test, read, and extend. The `validateAction` function can be unit tested independently with mock data. The processing loop stays clean — it only runs if validation passes. Discuss the pattern of "parse, validate, then act" and how it applies to both AI agent output and regular API input handling.
