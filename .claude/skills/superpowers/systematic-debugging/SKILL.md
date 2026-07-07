---
name: systematic-debugging
description: Methodical root-cause debugging. Invoke when diagnosing any bug or unexpected behavior. NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.
---

# Systematic Debugging

## Core Principle

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

Symptom-focused repairs mask underlying issues and create new problems. Systematic debugging is FASTER than guess-and-check thrashing — even under time pressure.

## Four Phases

### Phase 1: Root Cause Investigation
- Read error messages carefully and completely
- Reproduce the issue consistently
- Review recent changes (git log, git diff)
- Gather diagnostic evidence across component boundaries
- For multi-layer systems: add instrumentation at each interface

### Phase 2: Pattern Analysis
- Locate working examples of similar functionality
- Study reference implementations thoroughly
- Identify specific differences between functional and broken code

### Phase 3: Hypothesis and Testing
- Form explicit theories (write them down)
- Make minimal test changes — one variable at a time
- Adjust based on actual results, not assumptions
- Never add multiple fixes simultaneously

### Phase 4: Implementation
- Create a failing test first that reproduces the bug
- Implement a single fix targeting the root cause
- If three or more attempts fail: question architectural soundness

## Critical Warning Signs

Stop immediately if you are:
- Attempting "quick fixes" without tracing
- Proposing solutions without following data flow
- Trying repeated fixes when earlier attempts failed
- Adding workarounds instead of fixing the root cause

## Key Insight

"Systematic debugging is FASTER than guess-and-check thrashing" — hours of methodical work beats days of desperate patching.
