```markdown
# Current Issue: Centralized Hook Logic

**Location:**
Read the `hooks/use-project-actions.ts` file.

**Original Context:**
Please read the **`context/feature-specs/09-share-dialogue.md`** spec file to understand the original architectural requirements for the share dialogue and copying functionalities.

**The Problem:**
Currently, all project-related hook logic is centralized inside a single `use-project-actions.ts` file. This violates the separation of concerns established in the project architecture. The logic needs to be split into distinct, specialized hooks to manage different parts of the application state.

**Technical Hints & Required Structure:**
Please refactor the existing logic into the following specific files:

1. `use-project-dialogues.ts`: This hook should centralize and manage the UI state for the dialogues (create, rename, and delete). It must handle the form state (such as the project name and the live slug preview), track the active dialogue type, and manage the loading state.
2. `use-project-actions.ts`: This hook should be focused entirely on managing project mutations and data logic. It should handle generating a short unique suffix, slugifying the name, calling the backend API routes (POST, PATCH, DELETE) to update the database, navigating to the new workspace upon creation, and aligning the project ID with the Liveblocks room ID.
3. `use-project-share.ts`: (If sharing logic has been implemented) This hook is responsible for the share dialogue actions. It handles copying the project URL to the clipboard (ensuring the `await navigator.clipboard` call is wrapped in a `try...catch` block to properly handle permission failures) and reloading collaborator data.

**Success Criteria:**
Success means the `hooks` folder contains separate, strictly typed files that each handle only their specific domain, ensuring that API calls, UI dialogue state, and sharing functionalities are not tangled together.

**Action:**
Explore this file and deeply analyze the problem. Only when you have the analysis, give it back to me with your reasoning and idea of how you plan to separate the logic into these files. Wait for my green light to execute it.
```
