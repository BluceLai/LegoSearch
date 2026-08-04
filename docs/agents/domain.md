# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before Exploring, Read These

- `CONTEXT.md` at the repo root, or
- `CONTEXT-MAP.md` at the repo root if it exists. It points at one `CONTEXT.md` per context; read each one relevant to the topic.
- `docs/adr/`. Read ADRs that touch the area you are about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File Structure

Single-context repo:

```text
/
|-- CONTEXT.md
|-- docs/adr/
|   |-- 0001-event-sourced-orders.md
|   `-- 0002-postgres-for-write-model.md
`-- src/
```

Multi-context repo:

```text
/
|-- CONTEXT-MAP.md
|-- docs/adr/
`-- src/
    |-- ordering/
    |   |-- CONTEXT.md
    |   `-- docs/adr/
    `-- billing/
        |-- CONTEXT.md
        `-- docs/adr/
```

## Use The Glossary's Vocabulary

When your output names a domain concept in an issue title, a refactor proposal, a hypothesis, or a test name, use the term as defined in `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, either reconsider whether you are inventing language the project does not use, or note the gap for `/domain-modeling`.

## Flag ADR Conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> Contradicts ADR-0007 (event-sourced orders), but worth reopening because...
