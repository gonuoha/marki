# Meeting notes — editor architecture

**Date:** 2026-09-17
**Present:** the whole team

## Decisions

1. The document model is ProseMirror; markdown is the serialisation format, not
   the in-memory representation.
2. Round-trip fidelity is a test-enforced invariant, not a best effort.
3. Anything we cannot model gets stored verbatim in a raw node rather than
   silently rewritten.

## Open questions

- [ ] How do we handle a file changed on disk while it is dirty in the editor?
- [x] Where do dropped images go? `<doc dir>/assets/`, relative paths.
- [ ] Do we ship a plugin API in v1? Leaning no.

## Follow-ups

| Owner | Task | Due |
| ----- | ---- | --- |
| Ada | Sentence segmentation edge cases | Friday |
| Grace | Table serialiser padding | Friday |
