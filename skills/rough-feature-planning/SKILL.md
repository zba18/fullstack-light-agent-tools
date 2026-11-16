---
name: rough-feature-planning
description: Stops a feature build until the person has approved two things, a concept check (one frame and one line) and a software design plan (where it fits in the program, data model, interfaces, files, done-when checks). Use before building any new feature, page, workflow or agent tool, when the build-gate hook flags a prompt, or when the user asks for a concept check or a design plan. Small fixes skip it.
---

# Rough feature planning

A build that starts without the person's go on the idea risks a whole wasted cycle. Two cheap stops prevent that. Each stop ends your turn: show the thing, ask one question (go, or change?), and write no code until the answer is go.

## Skip test

Skip this skill, silently, when any of these hold:

- It is a small fix: copy, a label, one component, one function. Ship small fixes first, on their own, fast.
- The concept and the plan for this build were already approved in this thread.
- The prompt starts with `quick:`.

## Stop 1: concept check

Ground first, read only: the repo's rules file, the code the feature will touch, and real data from the repo. Then show three things.

1. **One frame.** The cheapest thing the person can look at.
   - For a screen: a rough view of the main screen, as a text sketch or one static HTML file, filled with real data from the repo.
   - For a backend change, a workflow or an agent tool: one worked example. A real input, and exactly what the user gets back.
2. **One line.** Who it is for and what changes for them, in their words.
3. **Assumptions.** Where the ask was open, the choice you made. Three at most.

Then ask: go, or change? End your turn.

This is one frame and one question about direction. It is never a menu of options.

## Stop 2: design plan

Only after a go on the concept. Write one page and save it as `docs/<feature>-plan.md`. This file is also the ask that `review-agent-pr` checks the finished change against.

| Section | What goes in it |
|---|---|
| Goal | One or two sentences in the user's language. |
| Where it fits | The existing modules and layers it touches, how data moves through them, and what it reuses. |
| Data model | New or changed tables, fields and types. |
| Interfaces | Routes, functions and agent tools, each with its inputs and outputs. |
| Files | Files to add and files to change. |
| Done when | Checks that can fail. Each one names the command or the action that shows it. |
| Out of scope | What this build leaves alone. |
| Trade-offs | The main alternative you rejected and why. What is good enough for now. |
| Slices | The order of work. Each slice is small enough to run and check on its own. |

Show the plan in the chat, then ask: go, or change? End your turn.

## Then build

Build one slice at a time and run the type check and the tests after each. When the last slice is done, a fresh thread runs `review-agent-pr` with the plan file as the ask.
