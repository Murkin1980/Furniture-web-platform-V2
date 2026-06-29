/**
 * Multi-modal handlers — adapters for image, audio, and PDF extraction.
 *
 * These handlers are injected into the orchestrator's extraction pipeline.
 * They do NOT import from MVP directly — they receive dependencies via DI.
 */

export function createImageAnalysisHandler(visionService) {
  return async function imageAnalysisHandler(input) {
    const imageUrl = input.imageUrl || input.imageBase64;

    if (!imageUrl) {
      return { error: "no_image", objects: [], text: null };
    }

    const ocrResult = await visionService.extractText(imageUrl);
    const objects = await visionService.detectObjects(imageUrl);
    const layout = await visionService.analyzeLayout(imageUrl);

    return {
      ocr: {
        text: ocrResult?.text || "",
        confidence: ocrResult?.confidence || 0
      },
      objects: objects.map(obj => ({
        label: obj.label,
        confidence: obj.confidence,
        bbox: obj.bbox
      })),
      layout: {
        rooms: layout?.rooms || [],
        furnitureZones: layout?.furnitureZones || [],
        dimensions: layout?.dimensions || null
      },
      overallConfidence: calculateImageConfidence(ocrResult, objects, layout)
    };
  };
}

export function createAudioTranscriptionHandler(transcriptionService) {
  return async function audioTranscriptionHandler(input) {
    const audioUrl = input.audioUrl;

    if (!audioUrl) {
      return { error: "no_audio", transcript: null };
    }

    const transcript = await transcriptionService.transcribe(audioUrl);

    return {
      transcript: transcript?.text || "",
      language: transcript?.language || "ru",
      duration: transcript?.duration || 0,
      confidence: transcript?.confidence || 0,
      segments: transcript?.segments || []
    };
  };
}

export function createPdfExtractionHandler(pdfService) {
  return async function pdfExtractionHandler(input) {
    const pdfUrl = input.pdfUrl;

    if (!pdfUrl) {
      return { error: "no_pdf", manifest: null };
    }

    const manifest = await pdfService.buildManifest({ url: pdfUrl });
    const pages = await pdfService.classifyPages(manifest);
    const rooms = await pdfService.extractRooms(pages);
    const zones = await pdfService.detectFurnitureZones(rooms);

    return {
      manifest: {
        url: pdfUrl,
        pageCount: pages.length,
        classifiedPages: pages.map(p => ({
          number: p.number,
          type: p.type,
          confidence: p.confidence
        }))
      },
      rooms: rooms.map(r => ({
        name: r.name,
        type: r.type,
        dimensions: r.dimensions,
        furniture: r.furniture || []
      })),
      zones: zones.map(z => ({
        room: z.roomName,
        type: z.furnitureType,
        dimensions: z.dimensions,
        material: z.suggestedMaterial
      })),
      overallConfidence: calculatePdfConfidence(pages, rooms, zones)
    };
  };
}

export function createMultiModalFusionHandler() {
  return async function multiModalFusionHandler(results) {
    const fused = {
      rooms: [],
      furniture: [],
      dimensions: null,
      budget: null,
      style: null,
      confidence: 0,
      sources: []
    };

    for (const result of results) {
      if (result.rooms) {
        fused.rooms.push(...result.rooms);
      }
      if (result.objects) {
        fused.furniture.push(...result.objects);
      }
      if (result.layout?.dimensions && !fused.dimensions) {
        fused.dimensions = result.layout.dimensions;
      }
      if (result.transcript) {
        fused.sources.push({ type: "audio", text: result.transcript });
      }
      if (result.ocr?.text) {
        fused.sources.push({ type: "image_ocr", text: result.ocr.text });
      }
    }

    fused.rooms = deduplicateRooms(fused.rooms);
    fused.furniture = deduplicateFurniture(fused.furniture);
    fused.confidence = calculateFusedConfidence(results);

    return fused;
  };
}

function deduplicateRooms(rooms) {
  const seen = new Set();
  return rooms.filter(room => {
    const key = `${room.type}-${room.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateFurniture(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = `${item.label}-${JSON.stringify(item.bbox)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function calculateImageConfidence(ocr, objects, layout) {
  let conf = 0;
  if (ocr?.text) conf += 0.2;
  if (objects?.length > 0) conf += 0.3;
  if (layout?.rooms?.length > 0) conf += 0.3;
  if (layout?.dimensions) conf += 0.2;
  return Math.min(conf, 1.0);
}

function calculatePdfConfidence(pages, rooms, zones) {
  let conf = 0;
  if (pages.length > 0) conf += 0.2;
  if (rooms.length > 0) conf += 0.3;
  if (zones.length > 0) conf += 0.3;
  const classifiedCount = pages.filter(p => p.type !== "unknown").length;
  if (classifiedCount > 0) conf += 0.2 * (classifiedCount / pages.length);
  return Math.min(conf, 1.0);
}

function calculateFusedConfidence(results) {
  if (results.length === 0) return 0;
  const confidences = results.map(r => r.confidence || 0).filter(c => c > 0);
  if (confidences.length === 0) return 0.3;
  return Math.min(confidences.reduce((a, b) => a + b, 0) / confidences.length, 1.0);
}
