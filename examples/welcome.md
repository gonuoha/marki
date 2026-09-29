---
title: Welcome to Marki
description: A tour of the markdown studio
date: 2026-09-17
tags:
  - writing
  - markdown
---

# Welcome to Marki

Marki is a **markdown studio**. You are looking at a real `.md` file on disk —
there is no database, no account, and no preview pane. What you see _is_ the
document.

## Why post-syntax editing

Markdown is a text format, and most editors treat it as one: you write syntax on
the left and watch a preview render it on the right. Marki skips the middle step.
Headings look like headings, emphasis looks like emphasis, and the file that gets
written is still plain CommonMark.

> The best interface for a text format is the text itself — until it isn't.

When you do need the raw source, press `Cmd-Alt-2` for the source view or
`Cmd-Alt-3` to put them side by side.

## What it can do

- Headings, emphasis, links and inline `code`
- Lists, including nested ones
  - like this
  - and this
- Task lists you can tick off:
  - [x] Parse markdown into a real document model
  - [x] Serialise it back without corrupting the file
  - [ ] Finish reading this document
- Tables, images, footnotes, math and raw HTML

## Focus and typewriter

Two modes do most of the work of "distraction-free":

| Mode       | Shortcut    | What it does                                             |
| ---        | ---         | ---                                                      |
| Typewriter | `Cmd-Alt-W` | Pins the caret to one line and scrolls the page under it |
| Focus      | `Cmd-Alt-F` | Dims everything except the current sentence or paragraph |

Together they keep your eye on one line of text instead of a wall of it.[^flow]

[^flow]: The effect is smaller than the productivity blogs claim, but it is not
    zero, and it costs nothing to turn off.
