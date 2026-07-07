---
name: verification-before-completion
description: Evidence before claims. Invoke before claiming any task complete. NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
---

# Verification Before Completion

## Core Principle

**NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.**

"Evidence before claims, always."

## The Process

Before asserting any task is done:

1. Identify what command proves the claim
2. Execute the full command (not partial checks)
3. Read the complete output and exit code
4. Verify the output actually supports your claim
5. Only then make the claim — with evidence attached

## For MyFlip (Next.js)

| Claim | Verification Command |
|-------|---------------------|
| "Build passes" | `npx next build` — read full output |
| "No type errors" | `npx tsc --noEmit` |
| "Page renders correctly" | Check in browser at localhost:3000 |
| "API works" | `curl localhost:3000/api/...` |

## Critical Red Flags

- "Should work now" or "probably passes" → requires actual execution
- Feeling confident without verification evidence
- Trusting agent success reports without independent confirmation
- Partial checks or extrapolation
- Committing/pushing before verification

## Why It Matters

Past failures: undefined functions shipping, missing requirements, broken trust.

"Honesty is a core value. If you lie, you'll be replaced."

This applies to any claim involving: completion, correctness, passing tests, or successful fixes — regardless of how the claim is phrased.
