const API_BASE = "/api";

const state = {
  token: "",
  packages: [],
  engagements: [],
  payments: [],
  templates: []
};

function getToken() {
  if (state.token) return state.token;
  const stored = sessionStorage.getItem("admin_token");
  if (stored) { state.token = stored; return stored; }
  const prompted = prompt("Введите админ-токен:");
  if (prompted) { state.token = prompted; sessionStorage.setItem("admin_token", prompted); return prompted; }
  return "";
}

function headers(json = true) {
  const h = { "X-Admin-Token": getToken() };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function api(path, options = {}) {
  const opts = { ...options, headers: { ...headers(options.body !== undefined), ...(options.headers || {}) } };
  if (options.body && typeof options.body === "object") {
    opts.body = JSON.stringify(options.body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({ success: false, error: "invalid_response" }));
  return { ok: res.ok, status: res.status, data };
}

function showStatus(message, type = "") {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = `status-line ${type}`;
}

function showBadge(text) {
  const cls = text.replace(/ /g, "_").toLowerCase();
  return `<span class="badge ${cls}">${text}</span>`;
}

function fmtMoney(kzt) {
  return Number(kzt || 0).toLocaleString("ru-RU") + " тг";
}

function esc(text) {
  return String(text || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const view = document.getElementById(`view-${viewName}`);
  if (view) view.classList.remove("hidden");
  document.querySelectorAll("#nav a").forEach((a) => a.classList.remove("active"));
  const navItem = document.querySelector(`#nav a[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add("active");
  const titles = {
    packages: ["Пакеты", "Каталог продуктовых пакетов V2"],
    engagements: ["Engagements", "Жизненный цикл пакетных engagements"],
    payments: ["Платежи", "Платёжные записи пакетов"],
    templates: ["Шаблоны сообщений", "Upsell-шаблоны для переходов между пакетами"],
    analytics: ["Аналитика", "Конверсия воронки вовлечения"]
  };
  const [title, sub] = titles[viewName] || ["", ""];
  document.getElementById("view-title").textContent = title;
  document.getElementById("view-sub").textContent = sub;
  if (viewName === "packages") loadPackages();
}

async function loadPackages() {
  const { ok, data } = await api("/packages");
  if (!ok) return showStatus(data.message || "Ошибка загрузки пакетов", "bad");
  state.packages = data.items || [];
  renderPackages();
}

function renderPackages() {
  const el = document.getElementById("package-list");
  if (!state.packages.length) { el.innerHTML = "<p class='sub'>Нет пакетов</p>"; return; }
  el.innerHTML = state.packages.map((pkg) => {
    const priceHtml = pkg.priceKzt === 0
      ? `<span class="free">бесплатно</span>`
      : `<span class="price">${fmtMoney(pkg.priceKzt)}</span>`;
    const deliverables = pkg.deliverables.map((d) => `<li>${esc(d)}</li>`).join("");
    const credit = pkg.creditedOnOrder ? "<div class='credit'>Стоимость зачитывается в заказ</div>" : "";
    return `<div class="pkg-card">
      <h3>${esc(pkg.name)} ${priceHtml}</h3>
      <div class="sub">Код: <code>${esc(pkg.code)}</code></div>
      <ul>${deliverables}</ul>
      ${credit}
    </div>`;
  }).join("");
}

async function loadEngagements() {
  const orderId = document.getElementById("eng-order-id").value;
  if (!orderId) return showStatus("Введите Order ID", "bad");
  const { ok, data } = await api(`/orders/${orderId}/engagements`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки engagements", "bad");
  state.engagements = data.items || [];
  renderEngagements();
  showStatus(`Загружено ${state.engagements.length} engagement(s)`, "ok");
}

function renderEngagements() {
  const el = document.getElementById("engagement-list");
  if (!state.engagements.length) { el.innerHTML = "<p class='sub'>Нет engagements для этого заказа</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Пакет</th><th>Уровень</th><th>Статус</th><th>Цена</th><th>Визуал</th><th>Ревизии</th><th>Действия</th></tr></thead>
    <tbody>${state.engagements.map((e) => `<tr>
      <td>${e.id}</td>
      <td><code>${esc(e.packageCode)}</code></td>
      <td>${esc(e.engagementLevel)}</td>
      <td>${showBadge(e.status)}</td>
      <td>${fmtMoney(e.priceKzt)}</td>
      <td>${esc(e.visualState)}</td>
      <td>${e.revisionRound}/${e.maxRevisions}</td>
      <td>
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'accepted')">Accept</button>
        <button class="secondary" onclick="window._showPaymentModal(${e.id},${e.priceKzt})">Оплатить</button>
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'declined')">Decline</button>
      </td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window._transitionEngagement = async (engagementId, toStatus) => {
  const { ok, data } = await api(`/orders/0/engagements/${engagementId}`, { method: "PATCH", body: { toStatus } });
  if (!ok) return showStatus(data.message || "Ошибка перехода статуса", "bad");
  showStatus(`Engagement #${engagementId} → ${toStatus}`, "ok");
  loadEngagements();
};

window._showPaymentModal = (engagementId, amountKzt) => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Запись платежа</h2>
    <p class="sub">Engagement #${engagementId} · Сумма: ${fmtMoney(amountKzt)}</p>
    <label>Сумма (тг)<input type="number" id="pay-amount" value="${amountKzt}" min="1" /></label>
    <label>Способ оплаты
      <select id="pay-method">
        <option value="manual">manual</option>
        <option value="card">card</option>
        <option value="cash">cash</option>
        <option value="transfer">transfer</option>
        <option value="kaspi">kaspi</option>
      </select>
    </label>
    <label>Reference (optional)<input type="text" id="pay-reference" placeholder="№ чека / комментарий" /></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-confirm-payment">Создать и подтвердить</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-confirm-payment").onclick = async () => {
    const amount = document.getElementById("pay-amount").value;
    const method = document.getElementById("pay-method").value;
    const reference = document.getElementById("pay-reference").value;
    const { ok, data } = await api("/payments", { method: "POST", body: { engagementId, amountKzt: Number(amount), method, reference } });
    if (!ok) return showStatus(data.message || "Ошибка создания платежа", "bad");
    const paymentId = data.item.id;
    const confirm = await api(`/payments/${paymentId}`, { method: "PATCH", body: { action: "confirm" } });
    if (!confirm.ok) return showStatus(confirm.data.message || "Платёж создан, но подтверждение не удалось", "bad");
    showStatus(`Платёж #${paymentId} подтверждён, engagement → paid`, "ok");
    window._closeModal();
    loadEngagements();
  };
};

window._closeModal = () => {
  document.getElementById("modal-overlay").classList.add("hidden");
};

window._createEngagement = async (orderId, packageCode) => {
  const { ok, data } = await api(`/orders/${orderId}/engagements`, { method: "POST", body: { packageCode } });
  if (!ok) return showStatus(data.message || "Ошибка создания engagement", "bad");
  showStatus(`Engagement #${data.item.id} создан для заказа #${orderId}`, "ok");
  loadEngagements();
};

async function loadPayments() {
  const engagementId = document.getElementById("pay-engagement-id").value;
  if (!engagementId) return showStatus("Введите Engagement ID", "bad");
  const { ok, data } = await api(`/payments?engagementId=${engagementId}`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки платежей", "bad");
  state.payments = data.items || [];
  renderPayments();
  showStatus(`Загружено ${state.payments.length} платеж(ей)`, "ok");
}

function renderPayments() {
  const el = document.getElementById("payment-list");
  if (!state.payments.length) { el.innerHTML = "<p class='sub'>Нет платежей для этого engagement</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Engagement</th><th>Order</th><th>Сумма</th><th>Метод</th><th>Статус</th><th>Reference</th><th>Дата</th></tr></thead>
    <tbody>${state.payments.map((p) => `<tr>
      <td>${p.id}</td>
      <td>${p.engagementId}</td>
      <td>${p.orderId}</td>
      <td>${fmtMoney(p.amountKzt)}</td>
      <td>${esc(p.method)}</td>
      <td>${showBadge(p.status)}</td>
      <td>${esc(p.reference || "")}</td>
      <td>${esc(p.createdAt || "")}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

async function loadTemplates() {
  const fromLevel = document.getElementById("tpl-from-level").value;
  const { ok, data } = await api(`/message-templates?fromLevel=${fromLevel}`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки шаблонов", "bad");
  state.templates = data.items || [];
  renderTemplates();
}

function renderTemplates() {
  const el = document.getElementById("template-list");
  if (!state.templates.length) { el.innerHTML = "<p class='sub'>Нет шаблонов для этого уровня</p>"; return; }
  el.innerHTML = state.templates.map((t) => `<div class="pkg-card">
    <h3>${esc(t.title)}</h3>
    <div class="sub">Код: <code>${esc(t.code)}</code> · Subject: ${esc(t.subject)}</div>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:var(--muted);margin:8px 0">${esc(t.body)}</pre>
  </div>`).join("");
}

async function loadAnalytics() {
  const { ok: funnelOk, data: funnel } = await api("/analytics?report=funnel");
  const { ok: metricsOk, data: metrics } = await api("/analytics?report=metrics");
  if (!funnelOk) return showStatus(funnel.message || "Ошибка загрузки аналитики", "bad");
  renderAnalytics(funnel, metricsOk ? metrics : null);
  showStatus("Аналитика загружена", "ok");
}

function renderAnalytics(funnel, metrics) {
  const el = document.getElementById("analytics-content");
  let html = "";
  if (metrics) {
    const t = metrics.totals || {};
    html += `<div class="grid">
      <div class="stat"><div class="k">Всего engagements</div><div class="v">${t.totalEngagements || 0}</div></div>
      <div class="stat"><div class="k">Оплачено</div><div class="v">${t.paid || 0}</div></div>
      <div class="stat"><div class="k">Доставлено</div><div class="v">${t.delivered || 0}</div></div>
      <div class="stat"><div class="k">Зачтено в заказ</div><div class="v">${t.credited || 0}</div></div>
      <div class="stat"><div class="k">Зачтено (тг)</div><div class="v"><small>${fmtMoney(t.totalCreditedKzt)}</small></div></div>
      <div class="stat"><div class="k">Выручка (тг)</div><div class="v"><small>${fmtMoney(t.totalRevenueKzt)}</small></div></div>
      <div class="stat"><div class="k">Ср. время доставки</div><div class="v"><small>${t.avgDeliveryHours ? Math.round(t.avgDeliveryHours) + " ч" : "—"}</small></div></div>
      <div class="stat"><div class="k">Ср. правок</div><div class="v">${t.avgRevisions ? Math.round(t.avgRevisions * 10) / 10 : "—"}</div></div>
    </div>`;
  }
  if (funnel.funnel) {
    html += "<h2>Воронка вовлечения</h2><table><thead><tr><th>Этап</th><th>Количество</th></tr></thead><tbody>";
    html += funnel.funnel.map((f) => `<tr><td>${esc(f.label)}</td><td>${f.count}</td></tr>`).join("");
    html += "</tbody></table>";
  }
  if (funnel.transitions && funnel.transitions.length) {
    html += "<h2>Конверсия переходов</h2><table><thead><tr><th>Из</th><th>В</th><th>Из</th><th>В</th><th>Конверсия</th></tr></thead><tbody>";
    html += funnel.transitions.map((t) => `<tr><td>${esc(t.from)}</td><td>${esc(t.to)}</td><td>${t.fromCount}</td><td>${t.toCount}</td><td><strong>${t.ratePercent}%</strong></td></tr>`).join("");
    html += "</tbody></table>";
  }
  el.innerHTML = html || "<p class='sub'>Нет данных</p>";
}

document.querySelectorAll("#nav a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    switchView(a.dataset.view);
  });
});

document.getElementById("btn-load-engagements").onclick = loadEngagements;
document.getElementById("btn-create-engagement").onclick = () => {
  const orderId = document.getElementById("eng-order-id").value;
  if (!orderId) return showStatus("Введите Order ID", "bad");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Создать engagement для заказа #${orderId}</h2>
    <label>Пакет
      <select id="create-pkg-code">
        <option value="level_1">Level 1 — бесплатно</option>
        <option value="package_a">Package A — 10 000 тг</option>
        <option value="package_b">Package B — 20 000 тг</option>
      </select>
    </label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-create">Создать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-create").onclick = () => {
    const packageCode = document.getElementById("create-pkg-code").value;
    window._createEngagement(orderId, packageCode);
    window._closeModal();
  };
};
document.getElementById("btn-load-payments").onclick = loadPayments;
document.getElementById("btn-load-templates").onclick = loadTemplates;
document.getElementById("btn-load-analytics").onclick = loadAnalytics;

switchView("packages");
