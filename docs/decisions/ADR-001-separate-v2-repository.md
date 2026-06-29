# ADR 001: Separate v2 into a new AI-first orchestration repository

- Status: proposed
- Date: 2026-06-28
- Deciders: Product owner, technical owner
- Consulted: Current MVP codebase, workflow notes, harness rules
- Informed: Future contributors and AI coding agents

## Context
The current furniture platform already contains production-oriented MVP capabilities for intake, CRM-related flows, calculators, OCR, AI support and Cloudflare-based delivery patterns.[1]

A new direction has emerged that changes not just one feature, but the top-level product flow: instead of a manual-first or partially assisted workflow, the new system should be AI-first. It should accept heterogeneous inputs such as spoken descriptions, hand-drawn sketches with audio, and designer-prepared apartment plans; interpret them; ask only minimal clarification questions; and then trigger downstream processes such as CRM updates, proposal generation and tracking in the background.[2]

This change affects the system boundary itself. The new capability is not a small module inside the existing MVP; it introduces an orchestration layer that decides which toolchain or route the platform should use based on the form of incoming customer data.[2][3]

## Decision drivers
- The new flow changes the primary intake model from manual-first to AI-first.[3]
- The orchestration layer becomes a new top-level runtime, not just a helper service.[2]
- Existing MVP functionality should remain stable while the new direction is explored.[1][3]
- The project already relies on a Cloudflare-centered stack and repo-oriented development workflow, so the new work should fit that operational model without destabilizing the current production path.[4]
- AI coding work on the new system benefits from clear repo boundaries, explicit harness rules and narrower scope.[5][6][7]

## Considered options

### Option A — Continue evolving the current MVP repository in place
Keep the new orchestration and AI-first flow inside the existing repository and progressively refactor the current codebase around it.

### Option B — Create a separate v2 repository for the AI-first platform
Create a new repository dedicated to the AI-first intake and orchestration runtime, while keeping the current MVP as the stable operational base.

### Option C — Build the orchestration layer as a submodule or sidecar package inside the current repository
Keep one repository, but isolate the new runtime in a separate package or directory that behaves almost like a standalone product.

## Decision
Choose **Option B — create a separate v2 repository** for the AI-first platform.[3]

The new repository will own the AI-first intake flow, orchestration layer, process tracking, clarification policy, extraction logic and related contracts. The current MVP repository remains the stable source for existing workflows until selected capabilities are intentionally bridged or migrated.[2][3]

## Why this option
A separate repository best matches the scale of the product change, because the new work introduces a different control plane for the system rather than a simple extension of the current feature set.[2][3]

It reduces the risk of destabilizing current production-oriented flows while allowing faster iteration on orchestration, routing, extraction schemas and question policy.[1][3]

It also gives AI coding agents a cleaner working boundary: they can operate inside a repo whose architecture, rules and scope are explicitly optimized for the new runtime, supported by `HARNESS.md`, session notes and future ADRs.[5][6][7]

## Consequences

### Good
- v2 can evolve around AI-first assumptions without forcing immediate large-scale refactors in the current MVP.[3]
- The current production-oriented MVP remains available as a stable reference and fallback path.[1][3]
- Architecture, migrations, process tracking and orchestration contracts can be designed coherently from the start.[2][3]
- Repo boundaries become clearer for contributors, CI, testing and AI coding sessions.[5][7]

### Bad
- Some logic may temporarily exist in both repos until clear migration or bridge rules are established.
- Cross-repository coordination will be needed for shared concepts such as CRM sync, calculators or document generation.
- There is a risk of conceptual duplication if interfaces and ownership boundaries are not documented early.

### Neutral / accepted trade-offs
- The new repository should not immediately replace the current MVP; coexistence is an intentional phase.
- Shared modules, if any, should emerge later from proven duplication rather than be extracted too early.

## Scope of the new repository
The v2 repository should include:
- AI-first intake
- orchestration layer
- classification and routing logic
- structured extraction and normalization
- minimal clarification loop
- process tracking and audit trail
- integration contracts for CRM, calculators and proposal generation.[2][3]

The v2 repository should not initially own:
- legacy billing and invoice subsystems
- unrelated production utilities
- broad refactors of the existing MVP
- direct replacement of every old flow on day one.[4][1][3]

## Validation
This decision is validated if the repository is created with:
- a dedicated `HARNESS.md` describing rules and boundaries;
- a `docs/decisions/` log for follow-up ADRs;
- an initial module structure centered on orchestration and intake;
- explicit migration/bridge notes to the current MVP;
- task-by-task development that does not require destabilizing the current production path.[3][5][7]

## Follow-up ADRs expected
Likely next decisions:
- ADR 002 — module boundaries for orchestration, intake and extraction
- ADR 003 — D1 schema and process event model
- ADR 004 — bridge strategy between current MVP and v2
- ADR 005 — clarification policy and customer involvement rules

## Notes
This ADR should remain short and stable. If the decision later changes materially, it should be superseded by a new ADR rather than rewritten in place.[8][9]
