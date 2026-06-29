/**
 * Extractor — extracts structured data from classified inputs.
 *
 * Based on the intake router's classification, the extractor runs
 * the appropriate pipeline and returns structured output.
 *
 * Extraction pipelines:
 * - text_analysis: intent → entities → package suggestion
 * - image_analysis: ocr → spatial → furniture detection
 * - audio_transcription: transcribe → classify → extract
 * - pdf_intelligence: manifest → classify → rooms → zones
 * - multi_modal: parallel → fusion → scoring
 */

export const EXTRACTION_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
});

export const EXTRACTION_TYPE = Object.freeze({
  TEXT_ANALYSIS: "text_analysis",
  IMAGE_ANALYSIS: "image_analysis",
  AUDIO_TRANSCRIPTION: "audio_transcription",
  PDF_INTELLIGENCE: "pdf_intelligence",
  MULTI_MODAL: "multi_modal"
});

export async function createExtraction({ db, processId, extractionType, input }) {
  const result = await db.prepare(
    `INSERT INTO orchestration_extractions (process_id, extraction_type, input_json, status)
     VALUES (?, ?, ?, ?)`
  ).bind(
    processId,
    extractionType,
    JSON.stringify(input || {}),
    EXTRACTION_STATUS.PENDING
  ).run();

  const id = result.meta?.last_row_id;
  return { id, status: EXTRACTION_STATUS.PENDING };
}

export async function runExtraction({ db, extractionId, handler }) {
  const id = Number(extractionId);
  if (!id || id <= 0) return { error: "invalid_extraction_id" };

  const existing = await db.prepare(
    "SELECT id, status, extraction_type, input_json FROM orchestration_extractions WHERE id = ?"
  ).bind(id).first();

  if (!existing) return { error: "extraction_not_found" };
  if (existing.status !== EXTRACTION_STATUS.PENDING) {
    return { error: "already_running" };
  }

  await db.prepare(
    `UPDATE orchestration_extractions SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(EXTRACTION_STATUS.RUNNING, id).run();

  try {
    const input = JSON.parse(existing.input_json || "{}");
    const result = await handler(input, existing.extraction_type);

    await db.prepare(
      `UPDATE orchestration_extractions SET status = ?, output_json = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(EXTRACTION_STATUS.COMPLETED, JSON.stringify(result), id).run();

    return { id, status: EXTRACTION_STATUS.COMPLETED, output: result };
  } catch (err) {
    await db.prepare(
      `UPDATE orchestration_extractions SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(EXTRACTION_STATUS.FAILED, err.message, id).run();

    return { id, status: EXTRACTION_STATUS.FAILED, error: err.message };
  }
}

export async function getExtraction({ db, extractionId }) {
  const id = Number(extractionId);
  if (!id || id <= 0) return { error: "invalid_extraction_id" };

  const row = await db.prepare(
    `SELECT id, process_id AS processId, extraction_type AS extractionType,
            input_json AS inputJson, output_json AS outputJson,
            status, error_message AS errorMessage,
            started_at AS startedAt, completed_at AS completedAt
     FROM orchestration_extractions WHERE id = ?`
  ).bind(id).first();

  if (!row) return { error: "extraction_not_found" };
  return { item: row };
}

export function buildTextExtractionPipeline() {
  return [
    { step: "intent_classification", description: "Определить намерение клиента" },
    { step: "entity_extraction", description: "Извлечь сущности: комнаты, мебель, размеры, бюджет" },
    { step: "package_suggestion", description: "Предложить подходящий пакет услуг" }
  ];
}

export function buildImageExtractionPipeline() {
  return [
    { step: "ocr", description: "Распознать текст на изображении" },
    { step: "spatial_analysis", description: "Анализ пространственной компоновки" },
    { step: "furniture_detection", description: "Обнаружить мебельные элементы" }
  ];
}

export function buildAudioExtractionPipeline() {
  return [
    { step: "transcription", description: "Транскрибировать аудио в текст" },
    { step: "intent_classification", description: "Определить намерение из текста" },
    { step: "entity_extraction", description: "Извлечь сущности" }
  ];
}

export function buildPdfExtractionPipeline() {
  return [
    { step: "manifest", description: "Построить манифест PDF" },
    { step: "page_classification", description: "Классифицировать страницы" },
    { step: "room_extraction", description: "Извлечь комнаты" },
    { step: "furniture_zone_detection", description: "Обнаружить зоны мебели" }
  ];
}

export function getExtractionPipeline(extractionType) {
  switch (extractionType) {
    case EXTRACTION_TYPE.TEXT_ANALYSIS: return buildTextExtractionPipeline();
    case EXTRACTION_TYPE.IMAGE_ANALYSIS: return buildImageExtractionPipeline();
    case EXTRACTION_TYPE.AUDIO_TRANSCRIPTION: return buildAudioExtractionPipeline();
    case EXTRACTION_TYPE.PDF_INTELLIGENCE: return buildPdfExtractionPipeline();
    case EXTRACTION_TYPE.MULTI_MODAL: return [
      { step: "parallel_extraction", description: "Параллельное извлечение по типам" },
      { step: "fusion", description: "Объединение результатов" },
      { step: "confidence_scoring", description: "Оценка достоверности" }
    ];
    default: return [];
  }
}
