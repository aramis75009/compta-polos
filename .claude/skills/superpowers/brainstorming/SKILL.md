---
name: brainstorming
description: Design before implementation. Invoke before writing any non-trivial feature. Hard gate — do NOT write code until the user approves the design.
---

# Brainstorming: Design Before Implementation

## Hard Gate

**Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it.**

## Nine-Step Process

1. **Explore project context** — Review existing files, docs, recent commits
2. **Offer visual companion just-in-time** — Only when mockups genuinely help
3. **Ask clarifying questions** — One at a time: purpose, constraints, success criteria
4. **Propose 2-3 approaches** — Compare trade-offs with a clear recommendation
5. **Present design** — Organized by complexity, with approval gates after each section
6. **Write design doc** — Save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
7. **Spec self-review** — Check for placeholders, contradictions, ambiguity
8. **User reviews written spec** — Wait for approval before proceeding
9. **Transition to implementation** — Invoke `writing-plans` skill only

## Key Guidelines

- **No "too simple" exception** — Even single-function utilities need a design spec
- **One question per message** — Don't overwhelm with multiple queries
- **Multiple choice preferred** — Easier than open-ended when possible
- **Work within existing patterns** — Follow established conventions

## Terminal State

Invoke `writing-plans` skill. No other implementation tools are called after brainstorming concludes.
