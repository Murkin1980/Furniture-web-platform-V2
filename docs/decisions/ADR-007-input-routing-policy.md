# ADR 007: Explicit input routing policy

- Status: accepted
- Date: 2026-06-29
- Deciders: Technical owner
- Consulted: Intake router, extraction handlers, multi-modal handlers

## Context
The intake router classifies input modality and determines the extraction pipeline. Without a formal routing matrix, new modalities or handlers may be added inconsistently. This ADR formalizes the routing.

## Routing matrix

| Input modality | Condition | Route action | Extraction pipeline | Handlers required | Clarification allowed |
|---|---|---|---|---|---|
| text | length >= 3, intent has packageCode | route_downstream | — | packageAdvisor | no |
| text | length >= 3, intent needsClarification | clarify | — | — | yes |
| text | length >= 3, no clear intent | extract | text_analysis | textAnalysis | yes |
| text | length < 3 | clarify | — | — | yes (input_too_short) |
| image | has imageUrl/imageBase64 | extract | image_analysis | imageAnalysis | no |
| audio | has audioUrl | extract | audio_transcription | audioTranscription | no |
| pdf | has pdfUrl | extract | pdf_intelligence | pdfManifest | no |
| mixed | text + image | extract | multi_modal | imageAnalysis + textAnalysis | yes |
| mixed | text + audio | extract | multi_modal | audioTranscription + textAnalysis | yes |
| mixed | text + pdf | extract | multi_modal | pdfManifest + textAnalysis | yes |
| mixed | 3+ types | extract | multi_modal | parallel handlers | yes |
| any | no recognizable data | reject | — | — | no |

## Clarification rules (per ADR 005)
- text: max 2 blocking questions per round
- audio/image: max 1 blocking question
- mixed: max 2 blocking questions
- blocking timeout: 24h
- nice-to-have timeout: 48h

## Pipeline step mapping

| Pipeline | Steps (ordered) |
|---|---|
| text_analysis | intent_classification → entity_extraction → package_suggestion |
| image_analysis | ocr → spatial_analysis → furniture_detection |
| audio_transcription | transcription → intent_classification → entity_extraction |
| pdf_intelligence | manifest → page_classification → room_extraction → furniture_zone_detection |
| multi_modal | parallel_extraction → fusion → confidence_scoring |

## Consequences
- Every new modality must be added to this matrix before implementation
- Tests must cover each matrix row
- Handlers not listed in "Handlers required" column must not be called for that modality
