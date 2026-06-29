import { ENGAGEMENT_STATUS } from "./package-catalog.js";

export const CREDIT_POLICY = Object.freeze({
  FULL_CREDIT: "full_credit",
  NO_CREDIT: "no_credit"
});

export function resolveCreditPolicy(packageDefinition) {
  if (!packageDefinition) return CREDIT_POLICY.NO_CREDIT;
  return packageDefinition.creditedOnOrder ? CREDIT_POLICY.FULL_CREDIT : CREDIT_POLICY.NO_CREDIT;
}

export function computeCreditAmount({ packagePriceKzt, orderTotalKzt, policy = CREDIT_POLICY.FULL_CREDIT }) {
  if (policy === CREDIT_POLICY.NO_CREDIT) return 0;
  const price = nonNegativeInteger(packagePriceKzt);
  const orderTotal = nonNegativeInteger(orderTotalKzt);
  if (price <= 0) return 0;
  if (orderTotal <= 0) return price;
  return Math.min(price, orderTotal);
}

export function applyCreditToOrder({ engagement, orderTotalKzt }) {
  if (!engagement) return { creditedAmountKzt: 0, remainingOrderTotalKzt: orderTotalKzt || 0, eligible: false };
  if (!engagement.creditedOnOrder) {
    return { creditedAmountKzt: 0, remainingOrderTotalKzt: orderTotalKzt || 0, eligible: false };
  }
  if (engagement.status !== ENGAGEMENT_STATUS.DELIVERED && engagement.status !== ENGAGEMENT_STATUS.CREDITED) {
    return { creditedAmountKzt: 0, remainingOrderTotalKzt: orderTotalKzt || 0, eligible: false };
  }
  const policy = resolveCreditPolicy({ creditedOnOrder: engagement.creditedOnOrder });
  const credited = computeCreditAmount({
    packagePriceKzt: engagement.priceKzt,
    orderTotalKzt,
    policy
  });
  return {
    creditedAmountKzt: credited,
    remainingOrderTotalKzt: Math.max(0, (orderTotalKzt || 0) - credited),
    eligible: true
  };
}

export function describeCreditImpact({ engagement, orderTotalKzt }) {
  const result = applyCreditToOrder({ engagement, orderTotalKzt });
  if (!result.eligible) {
    return "Пакет не зачитывается в заказ.";
  }
  if (result.creditedAmountKzt <= 0) {
    return "Пакет зачитывается, но сумма зачёта равна нулю.";
  }
  return `Зачёт ${result.creditedAmountKzt.toLocaleString("ru-RU")} тг. Итоговая сумма заказа: ${result.remainingOrderTotalKzt.toLocaleString("ru-RU")} тг.`;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}
