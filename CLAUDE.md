# CLAUDE.md

Instructions for Claude when working in this repo. Read this before writing any code.

## Core Philosophy

**Write code like you're paying per line.** Every line must earn its place. Ship the dumbest thing that works. Refactor only when pain is real, not hypothetical.

This is a **Next.js 15 App Router** project. Frontend and backend live together. No separate API service, no microservices, no monorepo gymnastics.

## The Prime Directives

1. **One working feature > ten abstract ones.** Build it end-to-end before polishing anything.
2. **Co-locate aggressively.** Route handler next to the page that calls it. Types next to the code that uses them.
3. **Server Components by default.** Only use `"use client"` when you need state, effects, or browser APIs.
4. **No premature infrastructure.** No Docker, no CI, no Storybook, no Redux, no tRPC, no Prisma until the pain is real.
5. **If you find yourself creating a folder for one file, stop.** Put it in the file that uses it.

## Stack (locked, don't add to it)

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode, but don't fight it — use `any` when types get in the way of shipping)
- **Styling:** Tailwind CSS. No CSS modules, no styled-components, no shadcn unless explicitly asked.
- **Data fetching:** `fetch` in Server Components. Route Handlers (`app/api/*/route.ts`) for anything the client needs to call.
- **State (client):** `useState` / `useReducer`. No Zustand, no Jotai, no Redux until three components share state in ways hooks can't handle.
- **Forms:** Native `<form>` + Server Actions. No React Hook Form until validation becomes actual pain.
- **DB (if needed):** SQLite + `better-sqlite3` for local. Postgres + `postgres` (not Prisma) for prod. Raw SQL is fine.
- **LLM:** `@anthropic-ai/sdk` directly. No LangChain, no LlamaIndex, no Vercel AI SDK wrappers unless streaming UI is the whole product.

## File Structure

```
app/
  page.tsx              # Home
  layout.tsx            # Root layout
  agent/
    page.tsx            # Agent UI (Client Component)
    actions.ts          # Server Actions for the agent
  api/
    agent/
      route.ts          # Streaming endpoint if needed
lib/
  agent.ts              # The entire agent logic. One file.
  db.ts                 # DB connection if you have one
.env.local              # Secrets
package.json
```

That's the whole shape. Add files only when the current one crosses ~400 lines and splitting genuinely helps.

### Forbidden on day one

- `components/ui/` with 20 primitives you haven't used yet
- `types/` folder (types live with the code)
- `utils/`, `helpers/`, `common/` (put the function where it's called)
- `hooks/` folder with one hook in it
- `services/` layer wrapping `fetch`
- `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`
- `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`
- Any test file before the feature works end-to-end

## How the Agent Works

This is the part that actually matters. The agent is the product.

### Loop (this is the whole agent)

```ts
// lib/agent.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools = [
  {
    name: "search",
    description: "Search the web",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  // add more tools here, inline
];

async function runTool(name: string, input: any): Promise<string> {
  if (name === "search") return await search(input.query);
  throw new Error(`unknown tool: ${name}`);
}

export async function runAgent(userMessage: string, maxSteps = 10) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let step = 0; step < maxSteps; step++) {
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason === "end_turn") {
      const text = res.content.find((b) => b.type === "text");
      return text?.type === "text" ? text.text : "";
    }

    if (res.stop_reason === "tool_use") {
      const toolResults = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const output = await runTool(block.name, block.input);
        toolResults.push({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: output,
        });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }
  return "agent stopped";
}
```

That's the agent. Tools are objects in an array. The loop runs until `end_turn` or `maxSteps`. No classes, no `AgentExecutor`, no `ChainOfThought`, no registry pattern.

### Rules for the agent

- **All agent logic in `lib/agent.ts`.** Split only when it crosses ~500 lines.
- **Tools are plain async functions.** No `BaseTool` class. No decorators.
- **System prompt is a `const` string at the top of the file.** Not a template file, not a YAML config.
- **Hardcode the model name** until you need to switch. `"claude-sonnet-4-5"`.
- **Hardcode `maxSteps`** with a sensible default (10). Make it an arg when you need to.
- **Errors: let them throw.** Catch at the route handler boundary and return `{ error: message }`. Don't build a custom `AgentError` hierarchy.
- **Logging = `console.log`.** Use it liberally during dev. Remove before shipping if it's noisy. No Winston, no pino.
- **Streaming:** only add it when the UX actually needs it. A blocking POST that returns the final answer is fine for v1.

### Calling the agent from the UI

Use a **Server Action**. Not a route handler, not a client-side `fetch` to `/api/agent`. Server Actions are the default; reach for a route handler only when you need streaming or a public API.

```tsx
// app/agent/actions.ts
"use server";
import { runAgent } from "@/lib/agent";

export async function ask(formData: FormData) {
  const q = formData.get("q") as string;
  return await runAgent(q);
}
```

```tsx
// app/agent/page.tsx
"use client";
import { useState } from "react";
import { ask } from "./actions";

export default function Page() {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(fd: FormData) {
    setLoading(true);
    setAnswer(await ask(fd));
    setLoading(false);
  }

  return (
    <form action={onSubmit} className="p-8 space-y-4">
      <input name="q" className="border p-2 w-full" />
      <button className="bg-black text-white px-4 py-2">Ask</button>
      {loading ? <p>thinking...</p> : <pre>{answer}</pre>}
    </form>
  );
}
```

That's a working agent UI. ~30 lines total. Ship it, then iterate.

### When to upgrade the agent

Add complexity **only when the current thing breaks in a specific, reproducible way**.

| Pain | Response |
|---|---|
| "The answer takes too long and the user sees nothing" | Add streaming (route handler + `ReadableStream`) |
| "I need conversation history" | Add a `messages[]` arg to `runAgent`, persist to DB |
| "The agent loops forever on bad tool output" | Lower `maxSteps`, improve tool error messages |
| "I have 10+ tools and the prompt is huge" | Split tools into groups, pass different sets per call |
| "I need to cancel mid-run" | Pass an `AbortSignal` through |

Don't do any of these preemptively.

## Next.js Specifics

- **Server Components are the default.** Put `"use client"` only on files that need it. Push it as far down the tree as possible.
- **Secrets stay server-side.** `ANTHROPIC_API_KEY` in `.env.local`, never prefixed with `NEXT_PUBLIC_`.
- **Use Server Actions for mutations and agent calls.** Use Route Handlers (`app/api/*/route.ts`) only for streaming, webhooks, or public APIs.
- **`fetch` in Server Components is cached by default.** Pass `{ cache: "no-store" }` for fresh data, or `{ next: { revalidate: 60 } }` for ISR.
- **No `getServerSideProps` / `getStaticProps`.** This is App Router. That's Pages Router. Don't mix them.
- **Loading and error states:** `loading.tsx` and `error.tsx` in the route folder. Use them instead of hand-rolled spinners.

## Dependencies

Default `package.json` for an agent app:

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@anthropic-ai/sdk": "^0.30"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^19",
    "@types/node": "^22",
    "tailwindcss": "^4"
  }
}
```

Every new dep needs a reason. "It might be useful" is not a reason.

## Style Rules

- **Functions over classes.** Classes only when the thing genuinely has state + behavior bundled (rare).
- **`async/await` over `.then()`.** Always.
- **`const` over `let`.** `let` only when you mutate.
- **Inline types** for one-off shapes. `interface` only when exported or reused 3+ times.
- **No barrel files** (`index.ts` re-exports). They break tree-shaking and hide structure.
- **No `enum`.** Use string literal unions: `type Status = "idle" | "loading" | "done"`.
- **Comments explain *why*, not *what*.** If the code needs a comment to explain what it does, rewrite the code.

## Good vs Bad

**Task:** "Add a tool that fetches a URL's content"

**Bad:**

```ts
// lib/tools/fetch-tool/index.ts
import { BaseTool } from "../base";
import { FetchToolConfig } from "./config";
import { FetchResult } from "./types";

export class FetchTool extends BaseTool<FetchToolConfig, FetchResult> {
  constructor(private readonly config: FetchToolConfig) { super(); }
  async execute(input: { url: string }): Promise<FetchResult> { /* ... */ }
}
export const fetchTool = new FetchTool({ timeout: 30000 });
```

**Good:**

```ts
// add to lib/agent.ts, next to the other tools
tools.push({
  name: "fetch_url",
  description: "Fetch the text content of a URL",
  input_schema: {
    type: "object",
    properties: { url: { type: "string" } },
    required: ["url"],
  },
});

// add to runTool
if (name === "fetch_url") {
  const r = await fetch(input.url);
  return (await r.text()).slice(0, 10_000);
}
```

Four lines of actual logic. Done.

## When to Ask Me

Ask clarifying questions when:
- The request could mean two very different things
- You need an external service/API key I haven't mentioned
- The feature conflicts with something already in the codebase

Don't ask when:
- You can see a reasonable default (pick it, note the choice in your response)
- It's a style/naming call (just decide)
- The doc above already answers it

## The One Rule That Beats All Others

> If you're about to write scaffolding instead of the feature, stop and write the feature.

Impressive architecture isn't the goal. A working thing is.