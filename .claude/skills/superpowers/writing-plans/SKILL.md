---
name: writing-plans
description: Create detailed implementation plans before coding. Invoke after brainstorming is approved, before starting any multi-step implementation.
---

# Writing Plans

## Core Purpose

Generate detailed, task-by-task plans for engineers with minimal codebase context. Plans must cover file structure, interfaces, and exact implementation steps.

## Plan Structure

**Header:**
- Feature name and one-sentence goal
- Architecture overview (2-3 sentences)
- Tech stack
- Global constraints with exact values

**Task format (5 minutes each):**
- Specific file paths (create / modify / test)
- Interface contracts (consumed inputs, produced outputs)
- Steps: write test → verify failure → implement → verify pass → commit
- Actual code blocks (NO placeholders like "TBD" or "add validation here")
- Exact command examples with expected output

## Critical Rules

- **No abstractions** — Every step shows complete, working code
- **DRY + YAGNI + TDD** — Minimal, testable, non-repetitive
- **Type consistency** — Function signatures across tasks must match exactly
- **Self-review checklist** — Verify spec coverage, scan for placeholders, validate cross-task types

## Execution Paths (offer both after plan is written)

1. **Subagent-Driven** (recommended for large tasks): Fresh subagent per task with review gates
2. **Inline Execution**: Batch execution using `executing-plans` skill with checkpoints

## Save Location

`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` unless user specifies otherwise.
