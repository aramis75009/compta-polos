---
name: using-superpowers
description: How to discover and invoke Superpowers skills. Invoke this first if unsure which skill applies. Skills override default behavior — use them proactively.
---

# Using Superpowers: Skills Framework

## Core Rule

**Invoke applicable skills before any response**, even with minimal (1%) confidence they apply.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

## Priority Hierarchy

1. **User's explicit instructions** (highest priority)
2. **Superpowers skills** (override default behavior)
3. **Default system prompt** (lowest priority)

User directives always supersede skill requirements.

## Key Implementation Points

- Use the platform's native skill-loading mechanism (Skill tool in Claude Code)
- Announce skill usage: "Using [skill] to [purpose]"
- Create todos for checklist items within skills
- Check skills before clarifying questions or exploration

## Available Skills in this Project

| Skill | When to Use |
|-------|-------------|
| `superpowers/brainstorming` | Before implementing any non-trivial feature |
| `superpowers/writing-plans` | When breaking work into tasks |
| `superpowers/systematic-debugging` | When diagnosing any bug |
| `superpowers/test-driven-development` | When writing any feature or fix |
| `superpowers/verification-before-completion` | Before claiming any task complete |
| `karpathy-guidelines` | As a baseline for all coding tasks |

## Skill Priority When Multiple Apply

Process skills (brainstorming, debugging) precede implementation skills (design, building).

## Red Flag Rationalizations — Stop and Check Skills

- "This is just a simple question"
- "I need more context first"
- "I'll check skills after exploring"
- "This doesn't need a skill"

These thoughts signal: stop and check for applicable skills instead.
