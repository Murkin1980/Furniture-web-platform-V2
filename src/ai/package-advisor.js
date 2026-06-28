import { PACKAGE_CODES } from "../packages/package-catalog.js";

const INTENT_RULES = [
  {
    packageCode: PACKAGE_CODES.PACKAGE_B,
    keywords: [
      "визуал", "как будет", "цветн", "цвет", "3d визуал",
      "визуализац", "проект", "компоновк", "рабочий чертёж",
      "размер", "планировк", "эскиз", "в_INTERIOR"
    ],
    weight: 3
  },
  {
    packageCode: PACKAGE_CODES.PACKAGE_A,
    keywords: [
      "смета", "коммерческ", "кп", "к_п", "по позициям",
      "по позиц", "расчёт", "расчет", "стоимость",
      "детализац"
    ],
    weight: 2
  },
  {
    packageCode: PACKAGE_CODES.LEVEL_1,
    keywords: [
      "примерно", "ориентир", "сколько", "грубо",
      "предварительн", "прайс", "тариф", "за метр",
      "за_метр", "погонн", "rough", "price"
    ],
    weight: 1
  }
];

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[^a-zа-я0-9\s_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreIntent(normalizedText, rule) {
  let hits = 0;
  for (const kw of rule.keywords) {
    if (normalizedText.includes(kw)) hits++;
  }
  return hits * rule.weight;
}

export function classifyIntent(userMessage) {
  if (!userMessage || typeof userMessage !== "string") {
    return {
      packageCode: PACKAGE_CODES.LEVEL_1,
      confidence: 0,
      reason: "empty_input",
      matchedKeywords: []
    };
  }

  const normalized = normalizeText(userMessage);
  const scores = [];

  for (const rule of INTENT_RULES) {
    const matched = rule.keywords.filter(kw => normalized.includes(kw));
    const score = matched.length * rule.weight;
    if (score > 0) {
      scores.push({
        packageCode: rule.packageCode,
        score,
        matched
      });
    }
  }

  if (scores.length === 0) {
    return {
      packageCode: PACKAGE_CODES.LEVEL_1,
      confidence: 0,
      reason: "no_signal",
      matchedKeywords: []
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const secondBest = scores[1];
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const confidence = totalScore > 0 ? best.score / totalScore : 0;

  const margin = secondBest ? best.score - secondBest.score : best.score;
  const reason = margin > best.score * 0.5 ? "strong_match" : "weak_match";

  return {
    packageCode: best.packageCode,
    confidence: Math.round(confidence * 100) / 100,
    reason,
    matchedKeywords: best.matched
  };
}

export function suggestClarifyingQuestions(intent, context) {
  const questions = [];

  if (intent.packageCode === PACKAGE_CODES.LEVEL_1 && intent.confidence < 0.5) {
    questions.push({
      field: "scope",
      question: "Подскажите, что вас интересует: примерная ориентировочная цена или более детальный расчёт?",
      required: false
    });
  }

  if (intent.packageCode === PACKAGE_CODES.PACKAGE_A) {
    if (!context?.rooms || context.rooms.length === 0) {
      questions.push({
        field: "rooms",
        question: "Какие помещения нужно спроектировать? Например: кухня, шкаф-купе, гардеробная.",
        required: true
      });
    }
  }

  if (intent.packageCode === PACKAGE_CODES.PACKAGE_B) {
    if (!context?.rooms || context.rooms.length === 0) {
      questions.push({
        field: "rooms",
        question: "Какие помещения и какой стиль интерьера вас интересует?",
        required: true
      });
    }
    if (context?.rooms && context.rooms.length > 0 && !context?.hasPhotos && !context?.hasPdf) {
      questions.push({
        field: "materials",
        question: "Есть ли у вас фото помещения или план? Это поможет точнее подобрать компоновку.",
        required: false
      });
    }
  }

  return questions;
}

export function getAdvisorSummary(intent) {
  const labels = {
    [PACKAGE_CODES.LEVEL_1]: "Level 1 — Быстрый ориентир (0 тг)",
    [PACKAGE_CODES.PACKAGE_A]: "Package A — КП + смета (10 000 тг)",
    [PACKAGE_CODES.PACKAGE_B]: "Package B — Визуал + размеры (20 000 тг)"
  };

  return {
    recommended: labels[intent.packageCode] || intent.packageCode,
    confidence: intent.confidence,
    reason: intent.reason,
    matchedKeywords: intent.matchedKeywords
  };
}
