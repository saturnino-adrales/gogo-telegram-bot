# Claude Agent SDK Patterns

## Package

```bash
npm install @anthropic-ai/claude-agent-sdk
```

## Basic Query

```js
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Your task here",
  options: {
    allowedTools: ["Read", "Glob", "Grep"],
    cwd: "/path/to/project",
  },
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

## Resume a Session

```js
for await (const message of query({
  prompt: "Follow-up question",
  options: {
    resume: previousSessionId,
    allowedTools: ["Read"],
  },
})) {
  // continues from previous session context
}
```

## Key Options

| Option | Type | Description |
|--------|------|-------------|
| `cwd` | string | Working directory for file operations |
| `allowedTools` | string[] | Pre-approved tool names |
| `resume` | string | Session ID to continue |
| `permissionMode` | string | "default", "acceptEdits", "blockAll" |

## Message Types

| Type | When |
|------|------|
| `system` | Session init, metadata |
| `assistant` | Claude's responses |
| `result` | Final result with session_id and cost |
| `error` | Failures |

## Available Exports

The `@anthropic-ai/claude-agent-sdk` package exports:

- `query` — main function, returns async generator
- `forkSession` — branch from an existing session
- `getSessionMessages` — retrieve session history
- `listSessions` — list all sessions
- `getSessionInfo` — get session metadata
- `deleteSession` — remove a session
- `renameSession` / `tagSession` — organize sessions

## Available Tools

**Read-only:** Read, Glob, Grep, WebSearch, WebFetch
**Write:** Edit, Write
**Execute:** Bash, Monitor
**Advanced:** Agent, NotebookEdit
