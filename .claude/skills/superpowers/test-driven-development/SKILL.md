---
name: test-driven-development
description: Red-Green-Refactor cycle. Invoke when implementing any feature or bugfix. NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.
---

# Test-Driven Development (TDD)

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Write code before the test? Delete it. Start over. No exceptions.

## Red-Green-Refactor Cycle

### RED — Write Failing Test
- One behavior per test
- Clear name describing behavior
- Real code (no mocks unless unavoidable)

### Verify RED — Watch It Fail (MANDATORY, NEVER SKIP)
```bash
npm test path/to/test.test.ts
```
Confirm: test fails for the expected reason (feature missing, not typos).

### GREEN — Minimal Code
Write the simplest code to pass the test. No extra features, no refactoring other code.

### Verify GREEN — Watch It Pass (MANDATORY)
```bash
npm test path/to/test.test.ts
```
Confirm: test passes, other tests still pass, no errors or warnings.

### REFACTOR — Clean Up
After green only: remove duplication, improve names, extract helpers. Keep tests green. Don't add behavior.

## Red Flags — STOP and Start Over

- Code written before test
- Test passes immediately (proves nothing)
- Can't explain why test failed
- "I'll add tests after"
- "Already manually tested it"
- "TDD is dogmatic, I'm being pragmatic"
- "This is too simple to test"

**All of these mean: Delete code. Start over with TDD.**

## Verification Checklist

Before marking work complete:
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Edge cases and errors covered
