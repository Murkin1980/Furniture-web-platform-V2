import {
  PACKAGE_CODES,
  ENGAGEMENT_LEVELS,
  UPGRADE_OFFER_STATE
} from "./package-catalog.js";

export const MESSAGE_TEMPLATE_CODES = Object.freeze({
  ROUGH_QUOTE_OFFER_PACKAGE_A: "rough_quote_offer_package_a",
  PACKAGE_A_OFFER_PACKAGE_B: "package_a_offer_package_b",
  PACKAGE_B_OFFER_ORDER: "package_b_offer_order",
  PACKAGE_A_OFFER_ORDER: "package_a_offer_order",
  ROUGH_QUOTE_OFFER_PACKAGE_B: "rough_quote_offer_package_b"
});

const TEMPLATES = Object.freeze([
  {
    code: MESSAGE_TEMPLATE_CODES.ROUGH_QUOTE_OFFER_PACKAGE_A,
    fromLevel: ENGAGEMENT_LEVELS.ROUGH_QUOTE,
    toPackage: PACKAGE_CODES.PACKAGE_A,
    upgradeOfferState: UPGRADE_OFFER_STATE.OFFERED,
    title: "Из ориентира по цене → Package A (10 000 тг)",
    subject: "Подробное коммерческое предложение и смета по вашей мебели",
    body: [
      "Здравствуйте!",
      "",
      "По вашему запросу мы подготовили предварительный ориентир по цене.",
      "Чтобы вы могли принять решение с полной картиной, предлагаем Package A за 10 000 тг:",
      "",
      "В пакет входит:",
      "• коммерческое предложение с обоснованием;",
      "• смета по каждой позиции;",
      "• предварительный черно-белый визуал.",
      "",
      "Стоимость пакета (10 000 тг) полностью зачитывается в стоимость заказа,",
      "если вы решите заказать мебель у нас.",
      "",
      "Оформить Package A можно ответив на это сообщение."
    ].join("\n")
  },
  {
    code: MESSAGE_TEMPLATE_CODES.ROUGH_QUOTE_OFFER_PACKAGE_B,
    fromLevel: ENGAGEMENT_LEVELS.ROUGH_QUOTE,
    toPackage: PACKAGE_CODES.PACKAGE_B,
    upgradeOfferState: UPGRADE_OFFER_STATE.OFFERED,
    title: "Из ориентира по цене → Package B (20 000 тг)",
    subject: "Цветной визуал, варианты компоновки и подробная смета",
    body: [
      "Здравствуйте!",
      "",
      "Мы подготовили предварительный ориентир по цене. Для полноценного",
      "выбора предлагаем Package B за 20 000 тг — расширенную проектную проработку:",
      "",
      "В пакет входит:",
      "• цветной визуал в нескольких проекциях;",
      "• 2–3 варианта компоновки;",
      "• коммерческое предложение с подробными размерами;",
      "• один раунд корректировок;",
      "• лист «что входит / что не входит»;",
      "• блок рекомендуемых материалов.",
      "",
      "Стоимость пакета (20 000 тг) полностью зачитывается в стоимость заказа.",
      "",
      "Оформить Package B можно ответив на это сообщение."
    ].join("\n")
  },
  {
    code: MESSAGE_TEMPLATE_CODES.PACKAGE_A_OFFER_PACKAGE_B,
    fromLevel: ENGAGEMENT_LEVELS.PACKAGE_A,
    toPackage: PACKAGE_CODES.PACKAGE_B,
    upgradeOfferState: UPGRADE_OFFER_STATE.OFFERED,
    title: "Из Package A → Package B (20 000 тг)",
    subject: "Расширенная проектная проработка: цветной визуал и варианты компоновки",
    body: [
      "Здравствуйте!",
      "",
      "Вы получили Package A с коммерческим предложением и сметой.",
      "Предлагаем расширить проработку до Package B за 20 000 тг:",
      "",
      "Дополнительно к Package A вы получите:",
      "• цветной визуал в нескольких проекциях;",
      "• 2–3 варианта компоновки;",
      "• подробные размеры мебели;",
      "• один раунд корректировок;",
      "• лист «что входит / что не входит»;",
      "• блок рекомендуемых материалов.",
      "",
      "Стоимость Package B зачитывается в стоимость заказа.",
      "Если вы уже оплатили Package A, доплата составит 10 000 тг.",
      "",
      "Оформить Package B можно ответив на это сообщение."
    ].join("\n")
  },
  {
    code: MESSAGE_TEMPLATE_CODES.PACKAGE_A_OFFER_ORDER,
    fromLevel: ENGAGEMENT_LEVELS.PACKAGE_A,
    toPackage: null,
    upgradeOfferState: UPGRADE_OFFER_STATE.OFFERED,
    title: "Из Package A → заказ мебели",
    subject: "Готовы оформить заказ на вашу мебель",
    body: [
      "Здравствуйте!",
      "",
      "Коммерческое предложение и смета из Package A готовы к согласованию.",
      "Стоимость пакета (10 000 тг) будет зачтена в стоимость заказа.",
      "",
      "Для оформления заказа сообщите, пожалуйста:",
      "• удобный способ связи;",
      "• сроки, в которые нужна мебель;",
      "• пожелания по материалам и фурнитуре.",
      "",
      "После согласования мы подготовим производственный проект и договор."
    ].join("\n")
  },
  {
    code: MESSAGE_TEMPLATE_CODES.PACKAGE_B_OFFER_ORDER,
    fromLevel: ENGAGEMENT_LEVELS.PACKAGE_B,
    toPackage: null,
    upgradeOfferState: UPGRADE_OFFER_STATE.OFFERED,
    title: "Из Package B → заказ мебели",
    subject: "Проектная проработка завершена — оформляем заказ",
    body: [
      "Здравствуйте!",
      "",
      "Цветной визуал, варианты компоновки и подробная смета из Package B готовы.",
      "Стоимость пакета (20 000 тг) будет зачтена в стоимость заказа.",
      "",
      "Для оформления заказа:",
      "• выберите подходящий вариант компоновки;",
      "• подтвердите материалы и фурнитуру;",
      "• укажите сроки и адрес доставки/монтажа.",
      "",
      "После согласования мы подготовим производственный проект и договор."
    ].join("\n")
  }
]);

export function listMessageTemplates() {
  return TEMPLATES.map(cloneTemplate);
}

export function getTemplatesForUpgrade(fromLevel) {
  return TEMPLATES.filter((t) => t.fromLevel === fromLevel).map(cloneTemplate);
}

export function getMessageTemplate(code) {
  const template = TEMPLATES.find((t) => t.code === code);
  return template ? cloneTemplate(template) : null;
}

export function resolveUpgradeTemplates(currentEngagementLevel, currentPackageCode) {
  if (currentPackageCode === PACKAGE_CODES.PACKAGE_B || currentEngagementLevel === ENGAGEMENT_LEVELS.PRODUCTION_ORDER) {
    return TEMPLATES.filter((t) => t.toPackage === null && t.fromLevel === currentEngagementLevel).map(cloneTemplate);
  }
  if (currentPackageCode === PACKAGE_CODES.PACKAGE_A) {
    return TEMPLATES.filter((t) => t.fromLevel === ENGAGEMENT_LEVELS.PACKAGE_A).map(cloneTemplate);
  }
  return TEMPLATES.filter((t) => t.fromLevel === ENGAGEMENT_LEVELS.ROUGH_QUOTE).map(cloneTemplate);
}

export function renderTemplate(template, context = {}) {
  if (!template) return null;
  const clientName = clean(context.clientName) || "";
  const orderId = clean(context.orderId) || "";
  const managerName = clean(context.managerName) || "";
  let body = template.body;
  if (clientName) {
    body = body.replace("Здравствуйте!", `Здравствуйте, ${clientName}!`);
  }
  const footer = [];
  if (orderId) footer.push(`(Заказ #${orderId})`);
  if (managerName) footer.push(`С уважением, ${managerName}`);
  const rendered = footer.length ? `${body}\n\n${footer.join("\n")}` : body;
  return {
    code: template.code,
    title: template.title,
    subject: template.subject,
    body: rendered,
    fromLevel: template.fromLevel,
    toPackage: template.toPackage,
    upgradeOfferState: template.upgradeOfferState
  };
}

function cloneTemplate(template) {
  return { ...template };
}

function clean(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}
