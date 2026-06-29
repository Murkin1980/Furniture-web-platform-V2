/**
 * MVP Bridge — connects orchestrator to MVP modules via dependency injection.
 *
 * This module does NOT import from packages/mvp/ directly.
 * It defines handler factories that receive MVP functions as arguments.
 */

export function createTextAnalysisHandler(packageAdvisor) {
  return async function textAnalysisHandler(input) {
    const text = input.text || "";

    const intent = packageAdvisor.classifyIntent(text);
    const questions = packageAdvisor.suggestClarifyingQuestions(intent);
    const summary = packageAdvisor.getAdvisorSummary(intent);

    return {
      intent,
      clarifyingQuestions: questions,
      summary,
      entities: extractEntitiesFromText(text),
      confidence: calculateConfidence(intent, text)
    };
  };
}

export function createPdfIntelligenceHandler(pdfManifest) {
  return async function pdfIntelligenceHandler(input) {
    const pdfUrl = input.pdfUrl || input.pdfManifest?.url;

    if (!pdfUrl) {
      return { error: "no_pdf_url", rooms: [], zones: [] };
    }

    const manifest = await pdfManifest.buildManifest({ url: pdfUrl });

    return {
      manifest,
      rooms: manifest.rooms || [],
      zones: manifest.furnitureZones || [],
      pageCount: manifest.pages?.length || 0,
      confidence: 0.8
    };
  };
}

export function createSupplierPricingHandler(supplierCatalog) {
  return async function supplierPricingHandler(input) {
    const zones = input.zones || [];
    const results = [];

    for (const zone of zones) {
      const pricing = await supplierCatalog.resolveSupplierPricing({
        materialType: zone.materialType || "standard",
        furnitureType: zone.furnitureType
      });

      results.push({
        zone: zone.id || zone.name,
        pricing,
        estimatedCost: pricing?.estimatedCost || null
      });
    }

    return {
      zonePricings: results,
      totalEstimated: results.reduce((sum, r) => sum + (r.estimatedCost || 0), 0)
    };
  };
}

export function createPackageAdvisorHandler(packageAdvisor) {
  return async function packageAdvisorHandler(input) {
    const text = input.text || input.summary || "";
    const intent = packageAdvisor.classifyIntent(text);
    const questions = packageAdvisor.suggestClarifyingQuestions(intent);

    return {
      packageCode: intent.packageCode,
      confidence: intent.confidence,
      clarifyingQuestions: questions,
      reasoning: intent.reasoning
    };
  };
}

function extractEntitiesFromText(text) {
  const entities = {
    rooms: [],
    furniture: [],
    dimensions: null,
    budget: null,
    style: null
  };

  const roomKeywords = {
    "кухня": "kitchen",
    "гостиная": "living_room",
    "спальня": "bedroom",
    "прихожая": "hallway",
    "ванная": "bathroom",
    "детская": "kids_room",
    "кабинет": "office",
    "гардеробная": "walk_in_closet"
  };

  const lowerText = text.toLowerCase();
  for (const [ru, en] of Object.entries(roomKeywords)) {
    if (lowerText.includes(ru)) {
      entities.rooms.push(en);
    }
  }

  const dimensionMatch = text.match(/(\d+(?:\.\d+)?)\s*[x×х]\s*(\d+(?:\.\d+)?)/i);
  if (dimensionMatch) {
    entities.dimensions = {
      length: parseFloat(dimensionMatch[1]),
      width: parseFloat(dimensionMatch[2])
    };
  }

  const budgetMatch = text.match(/(\d[\d\s]*)\s*(?:₸|тенге|тг)/i);
  if (budgetMatch) {
    entities.budget = parseInt(budgetMatch[1].replace(/\s/g, ""), 10);
  }

  const styleKeywords = ["современный", "классический", "минимализм", "скандинавский", "лофт", " któr", "неоклассический"];
  for (const style of styleKeywords) {
    if (lowerText.includes(style)) {
      entities.style = style;
    }
  }

  return entities;
}

function calculateConfidence(intent, text) {
  let confidence = 0.3;

  if (intent.packageCode) confidence += 0.3;
  if (text.length > 20) confidence += 0.1;
  if (text.length > 50) confidence += 0.1;

  const entities = extractEntitiesFromText(text);
  if (entities.rooms.length > 0) confidence += 0.1;
  if (entities.dimensions) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
