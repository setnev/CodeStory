📖 CodeStory

Understand Code Like a Story, Not a Puzzle

CodeStory is an AI-powered code analysis tool that explains code the way a senior engineer would: as a clear, structured narrative with visual alignment to the actual source code. Instead of dumping abstract summaries, CodeStory tells you what the code is doing, why it matters, where the risks are, and how it could be improved — step by step.

✨ What Problem Does CodeStory Solve?

Reading unfamiliar code is hard. Legacy code, onboarding into new repos, inherited projects, third-party snippets — all of it slows developers down.

Most AI tools:

Summarize code vaguely

Miss important configuration details

Don’t visually connect explanations to real lines

Treat code as text, not structure

CodeStory fixes that.

It turns code into a story you can follow.

🧠 Core Features
✅ Story-Driven Code Explanation

High-level narrative walkthrough

Clear explanation of what happens and why

Written for humans, not compilers

✅ Visual Step-to-Code Sync (Mode A)

Hover a walkthrough step → highlights the relevant code

Hover code → highlights the matching explanation

Canonical ordering ensures stable, predictable alignment

✅ Structured Analysis

Each analysis can include:

Summary

Step-by-step walkthrough

Risk overview

Performance issues

Security issues

Maintainability concerns

Improvement suggestions

✅ Multi-LLM Ready

OpenAI models (active)

Gemini / Claude (designed, pluggable)

Provider abstraction layer (no DB required yet)

✅ Export & Sharing

Copy full analysis to clipboard

Designed for future exports (Markdown, PDF, GitHub, Jira)

🧩 Sync Modes
Mode A — High-Level Sync (MVP)

LLM-provided annotations

Canonical ordering by file position

Whitespace trimming for clean visuals

“Good enough” accuracy without heavy parsing

🔒 Planned Premium Modes

Mode B — Semantic Sync: LLM-refined block boundaries

Mode C — AST Sync: Exact structural mapping using parsers

🖥️ Architecture Overview
Frontend

JavaScript (vanilla for MVP)

Interactive code viewer

Hover-based highlighting

Responsive layout (in progress)

Monaco editor planned

Backend

Node.js

OpenAI Responses API

Strict JSON schema enforcement

Annotation validation & clamping

Provider abstraction layer

🚀 Getting Started
Prerequisites

Node.js (v18+ recommended)

OpenAI API key
