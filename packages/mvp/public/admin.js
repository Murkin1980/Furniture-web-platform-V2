const API_BASE = "/api";

const state = {
  token: "",
  packages: [],
  engagements: [],
  payments: [],
  templates: [],
  suppliers: [],
  selectedSupplierId: null,
  clients: [],
  orders: []
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
    clients: ["Клиенты", "Управление клиентами"],
    orders: ["Заказы", "Создание и управление заказами"],
    engagements: ["Engagements", "Жизненный цикл пакетных engagements"],
    payments: ["Платежи", "Платёжные записи пакетов"],
    templates: ["Шаблоны сообщений", "Upsell-шаблоны для переходов между пакетами"],
    analytics: ["Аналитика", "Конверсия воронки вовлечения"],
    visual: ["Визуал (Deliverables)", "Продуктовый стандарт выдачи результата"],
    pdf: ["PDF Intake", "Полуавтоматическое проектирование из клиентских PDF"],
    suppliers: ["Поставщики", "Каталог поставщиков и прайс-листов"],
    launch: ["Запуск", "Production readiness dashboard"]
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
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'paid')">Paid</button>
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'in_progress')">In Progress</button>
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'delivered')">Delivered</button>
        <button class="secondary" onclick="window._transitionEngagement(${e.id},'credited')">Credited</button>
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

async function loadDeliverables() {
  const engagementId = document.getElementById("vis-engagement-id").value;
  if (!engagementId) return showStatus("Введите Engagement ID", "bad");
  const { ok, data } = await api(`/orders/0/engagements/${engagementId}/deliverables`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки deliverables", "bad");
  renderDeliverables(data.items || []);
  showStatus(`Загружено ${data.items?.length || 0} deliverable(s)`, "ok");
}

function renderDeliverables(items) {
  const el = document.getElementById("deliverable-list");
  if (!items.length) { el.innerHTML = "<p class='sub'>Нет deliverables. Нажмите «Создать deliverables».</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>#</th><th>Тип</th><th>Название</th><th>Статус</th><th>Артефакт</th><th>Действия</th></tr></thead>
    <tbody>${items.map((d) => `<tr>
      <td>${d.id}</td>
      <td><code>${esc(d.deliverableType)}</code></td>
      <td>${esc(d.label)}</td>
      <td>${showBadge(d.status)}</td>
      <td>${d.artifactUrl ? `<a href="${esc(d.artifactUrl)}" target="_blank">${esc(d.artifactFormat || "view")}</a>` : "<span class='muted'>—</span>"}</td>
      <td>
        <button class="secondary" onclick="window._deliverableAction(${d.id},'in_progress')">Start</button>
        <button class="secondary" onclick="window._deliverableAction(${d.id},'ready')">Ready</button>
        <button class="secondary" onclick="window._deliverableAction(${d.id},'delivered')">Deliver</button>
        <button class="secondary" onclick="window._showAttachModal(${d.id})">Артефакт</button>
        <button class="secondary" onclick="window._showRevisionModal(${d.id})">Правка</button>
        <button class="secondary" onclick="window._showResolveRevisionModal(${d.id})">Решить правку</button>
      </td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window._deliverableAction = async (did, toStatus) => {
  const { ok, data } = await api(`/deliverables/${did}`, { method: "PATCH", body: { toStatus } });
  if (!ok) return showStatus(data.message || "Ошибка перехода статуса", "bad");
  showStatus(`Deliverable #${did} → ${toStatus}`, "ok");
  loadDeliverables();
};

window._showAttachModal = (did) => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Привязать артефакт к deliverable #${did}</h2>
    <label>URL артефакта<input type="text" id="att-url" placeholder="https://..." /></label>
    <label>Формат
      <select id="att-format">
        <option value="png">png</option>
        <option value="jpeg">jpeg</option>
        <option value="pdf">pdf</option>
        <option value="html">html</option>
        <option value="svg">svg</option>
      </select>
    </label>
    <label>Metadata (JSON, optional)<textarea id="att-meta" placeholder='{"views":3}'></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-attach">Привязать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-attach").onclick = async () => {
    const url = document.getElementById("att-url").value;
    const format = document.getElementById("att-format").value;
    let metadata = null;
    try { metadata = JSON.parse(document.getElementById("att-meta").value || "{}"); } catch { metadata = null; }
    const { ok, data } = await api(`/deliverables/${did}`, { method: "PATCH", body: { action: "attach", artifactUrl: url, artifactFormat: format, metadata } });
    if (!ok) return showStatus(data.message || "Ошибка привязки", "bad");
    showStatus(`Артефакт привязан к deliverable #${did}`, "ok");
    window._closeModal();
    loadDeliverables();
  };
};

window._showRevisionModal = (did) => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Запросить правку для deliverable #${did}</h2>
    <p class="sub">Доступно только для ready/delivered. Списывает один раунд корректировок с engagement.</p>
    <label>Комментарий к правке<textarea id="rev-note" placeholder="Что нужно изменить"></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-revision">Запросить</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-revision").onclick = async () => {
    const note = document.getElementById("rev-note").value;
    const { ok, data } = await api(`/deliverables/${did}`, { method: "PATCH", body: { action: "request_revision", requestNote: note } });
    if (!ok) return showStatus(data.message || "Ошибка запроса правки", "bad");
    showStatus(`Правка #${data.revisionNumber} запрошена для deliverable #${did}`, "ok");
    window._closeModal();
    loadDeliverables();
  };
};

async function seedDeliverables() {
  const engagementId = document.getElementById("vis-engagement-id").value;
  if (!engagementId) return showStatus("Введите Engagement ID", "bad");
  const { ok, data } = await api(`/orders/0/engagements/${engagementId}/deliverables`, { method: "POST" });
  if (!ok) return showStatus(data.message || "Ошибка создания deliverables", "bad");
  showStatus(`Создано ${data.seeded} deliverable(s)`, "ok");
  loadDeliverables();
}

async function loadDeliverableState() {
  const engagementId = document.getElementById("vis-engagement-id").value;
  if (!engagementId) return showStatus("Введите Engagement ID", "bad");
  const { ok, data } = await api(`/orders/0/engagements/${engagementId}/deliverables?state=true`);
  if (!ok) return showStatus(data.message || "Ошибка получения состояния", "bad");
  const box = document.getElementById("deliverable-state-box");
  box.classList.remove("hidden");
  const stateLabels = {
    empty: "Пусто", not_seeded: "Deliverables не созданы", all_pending: "Все pending",
    in_progress: "В работе", has_ready: "Есть готовые", all_delivered: "Все доставлены",
    revision_in_progress: "Идёт правка"
  };
  box.innerHTML = `<h2 style="margin:0 0 8px">Состояние пакета: <strong>${stateLabels[data.packageState] || data.packageState}</strong></h2>
    <div class="sub">Всего: ${data.total} · Доставлено: ${data.counts.delivered || 0} · Готово: ${data.counts.ready || 0} · В работе: ${data.counts.in_progress || 0} · Правок: ${data.counts.revision_requested || 0}</div>`;
}

document.getElementById("btn-load-deliverables").onclick = loadDeliverables;
document.getElementById("btn-seed-deliverables").onclick = seedDeliverables;
document.getElementById("btn-deliverable-state").onclick = loadDeliverableState;

async function loadPdf() {
  const orderId = document.getElementById("pdf-order-id").value;
  if (!orderId) return showStatus("Введите Order ID", "bad");
  const [uploads, drafts] = await Promise.all([
    api(`/orders/${orderId}/pdf/uploads`),
    api(`/orders/${orderId}/pdf/drafts`)
  ]);
  if (uploads.ok) renderPdfUploads(uploads.data.items || []);
  if (drafts.ok) renderPdfDrafts(drafts.data.items || []);
  showStatus(`Uploads: ${uploads.data.items?.length || 0}, Drafts: ${drafts.data.items?.length || 0}`, "ok");
}

function renderPdfUploads(items) {
  const el = document.getElementById("pdf-upload-list");
  if (!items.length) { el.innerHTML = "<p class='sub'>Нет загрузок PDF</p>"; return; }
  el.innerHTML = `<table><thead><tr><th>ID</th><th>Файл</th><th>Страниц</th><th>Статус</th><th>Дата</th></tr></thead>
    <tbody>${items.map((u) => `<tr><td>${u.id}</td><td>${esc(u.fileName)}</td><td>${u.pageCount}</td><td>${showBadge(u.status)}</td><td>${esc(u.createdAt||"")}</td></tr>`).join("")}</tbody></table>`;
}

function renderPdfDrafts(items) {
  const el = document.getElementById("pdf-draft-list");
  if (!items.length) { el.innerHTML = "<p class='sub'>Нет drafts. Создайте draft из manifest.</p>"; return; }
  el.innerHTML = `<table><thead><tr><th>ID</th><th>Статус</th><th>Страниц</th><th>Zones</th><th>AI</th><th>Действия</th></tr></thead>
    <tbody>${items.map((d) => {
      const zoneCount = (d.manifest?.pages || []).reduce((s, p) => s + (p.furnitureZones?.length || 0), 0) + (d.manifest?.rooms || []).reduce((s, r) => s + (r.furnitureZones?.length || 0), 0);
      return `<tr><td>${d.id}</td><td>${showBadge(d.status)}</td><td>${d.manifest?.pageCount || 0}</td><td>${zoneCount}</td><td>${esc(d.aiProvider||"—")}</td>
        <td>
          <button class="secondary" onclick="window._pdfDraftAction(${d.id},'dimensions')">Размеры</button>
          <button class="secondary" onclick="window._pdfDraftAction(${d.id},'proposal')">КП</button>
          <button class="secondary" onclick="window._pdfReviewDraft(${d.id},'approved')">Approve</button>
          <button class="secondary" onclick="window._pdfReviewDraft(${d.id},'rejected')">Reject</button>
        </td></tr>`;
    }).join("")}</tbody></table>`;
}

window._pdfDraftAction = async (draftId, action) => {
  const { ok, data } = await api(`/orders/0/pdf/drafts?draftId=${draftId}&action=${action}`);
  if (!ok) return showStatus(data.message || "Ошибка", "bad");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `<h2>Draft #${draftId} — ${action}</h2>
    <pre style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow:auto;background:#f4f6f9;padding:12px;border-radius:8px">${esc(JSON.stringify(data, null, 2))}</pre>
    <div class="row" style="margin-top:16px"><button class="secondary" onclick="window._closeModal()">Закрыть</button></div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
};

window._pdfReviewDraft = async (draftId, status) => {
  const note = prompt("Комментарий к review:") || "";
  const { ok, data } = await api(`/orders/0/pdf/drafts`, { method: "POST", body: { action: "review", draftId, status, reviewNote: note } });
  if (!ok) return showStatus(data.message || "Ошибка review", "bad");
  showStatus(`Draft #${draftId} → ${status}`, "ok");
  loadPdf();
};

window._uploadPdf = async () => {
  const orderId = document.getElementById("pdf-order-id").value;
  if (!orderId) return showStatus("Введите Order ID", "bad");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `<h2>Загрузить PDF для заказа #${orderId}</h2>
    <label>Имя файла<input type="text" id="up-fname" placeholder="kitchen-plan.pdf" /></label>
    <label>Размер (bytes)<input type="number" id="up-fsize" placeholder="2048576" /></label>
    <label>Кол-во страниц<input type="number" id="up-pages" placeholder="3" /></label>
    <label>Checksum (optional)<input type="text" id="up-checksum" placeholder="abc123" /></label>
    <div class="row" style="margin-top:16px"><button id="btn-do-upload">Загрузить</button><button class="secondary" onclick="window._closeModal()">Отмена</button></div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-upload").onclick = async () => {
    const { ok, data } = await api(`/orders/${orderId}/pdf/uploads`, { method: "POST", body: {
      fileName: document.getElementById("up-fname").value,
      fileSizeBytes: Number(document.getElementById("up-fsize").value),
      mimeType: "application/pdf",
      pageCount: Number(document.getElementById("up-pages").value),
      checksum: document.getElementById("up-checksum").value
    }});
    if (!ok) return showStatus(data.message || "Ошибка загрузки", "bad");
    showStatus(`Upload #${data.item.id} создан`, "ok");
    window._closeModal();
    loadPdf();
  };
};

window._createDraft = async () => {
  const orderId = document.getElementById("pdf-order-id").value;
  if (!orderId) return showStatus("Введите Order ID", "bad");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `<h2>Создать PDF draft для заказа #${orderId}</h2>
    <p class="sub">Вставьте manifest JSON (или используйте упрощённый формат)</p>
    <label>Manifest JSON<textarea id="draft-manifest" placeholder='{"document":{"fileName":"test.pdf"},"pageCount":1,"pages":[{"pageNumber":1,"pageType":"floor_plan","furnitureZones":[{"id":"z1","zoneType":"kitchen","label":"Кухня 3м","dimensions":{"widthMm":3000}}]}]}'></textarea></label>
    <div class="row" style="margin-top:16px"><button id="btn-do-draft">Создать</button><button class="secondary" onclick="window._closeModal()">Отмена</button></div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-draft").onclick = async () => {
    let manifest;
    try { manifest = JSON.parse(document.getElementById("draft-manifest").value); } catch { return showStatus("Невалидный JSON", "bad"); }
    const { ok, data } = await api(`/orders/${orderId}/pdf/drafts`, { method: "POST", body: { manifest } });
    if (!ok) return showStatus(data.message || "Ошибка создания draft", "bad");
    showStatus(`Draft #${data.item.id} создан`, "ok");
    window._closeModal();
    loadPdf();
  };
};

document.getElementById("btn-load-pdf").onclick = loadPdf;
document.getElementById("btn-upload-pdf").onclick = () => window._uploadPdf();
document.getElementById("btn-create-draft").onclick = () => window._createDraft();

/* ── Suppliers ── */

async function loadSuppliers() {
  const { ok, data } = await api("/suppliers");
  if (!ok) return showStatus(data.message || "Ошибка загрузки поставщиков", "bad");
  state.suppliers = data.items || [];
  renderSuppliers();
  showStatus(`Загружено ${state.suppliers.length} поставщик(ов)`, "ok");
}

function renderSuppliers() {
  const el = document.getElementById("supplier-list");
  if (!state.suppliers.length) { el.innerHTML = "<p class='sub'>Нет поставщиков</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Код</th><th>Название</th><th>Контакт</th><th>Телефон</th><th>Статус</th><th>Действия</th></tr></thead>
    <tbody>${state.suppliers.map((s) => `<tr>
      <td>${s.id}</td>
      <td><code>${esc(s.code)}</code></td>
      <td>${esc(s.name)}</td>
      <td>${esc(s.contact || "—")}</td>
      <td>${esc(s.phone || "—")}</td>
      <td>${s.isActive ? showBadge("active") : showBadge("inactive")}</td>
      <td><button class="secondary" onclick="window._selectSupplier(${s.id},'${esc(s.name)}')">Прайс-листы</button></td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window._selectSupplier = async (supplierId, name) => {
  state.selectedSupplierId = supplierId;
  document.getElementById("supplier-detail").classList.remove("hidden");
  document.getElementById("supplier-detail-title").textContent = `Прайс-листы — ${name}`;
  loadPriceLists();
};

async function loadPriceLists() {
  const sid = state.selectedSupplierId;
  if (!sid) return;
  const { ok, data } = await api(`/suppliers/${sid}/price-lists`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки прайс-листов", "bad");
  renderPriceLists(data.items || []);
}

function renderPriceLists(items) {
  const el = document.getElementById("price-list-container");
  if (!items.length) { el.innerHTML = "<p class='sub'>Нет прайс-листов</p>"; return; }
  el.innerHTML = items.map((pl) => `<div class="pkg-card">
    <h3>Версия ${pl.versionNumber} ${showBadge(pl.status)}</h3>
    <div class="sub">ID: ${pl.id} · Создан: ${esc(pl.createdAt || "—")} · Действует с: ${esc(pl.effectiveFrom || "—")}</div>
    <div class="row" style="margin-top:10px">
      ${pl.status === "draft" ? `<button class="secondary" onclick="window._publishPriceList(${pl.id})">Опубликовать</button>` : ""}
      ${pl.status === "published" ? `<button class="secondary" onclick="window._archivePriceList(${pl.id})">Архивировать</button>` : ""}
      <button class="secondary" onclick="window._loadPriceItems(${pl.id})">Позиции</button>
      <button class="secondary" onclick="window._showAddPriceItemModal(${pl.id})">Добавить позицию</button>
      <button class="secondary" onclick="window._generateEstimate(${pl.id})">Сгенерировать estimate</button>
    </div>
    <div id="price-items-${pl.id}" style="margin-top:10px"></div>
  </div>`).join("");
}

window._publishPriceList = async (plId) => {
  const effectiveFrom = prompt("Дата вступления в силу (YYYY-MM-DD):") || "";
  const { ok, data } = await api(`/suppliers/${state.selectedSupplierId}/price-lists/${plId}`, { method: "POST", body: { action: "publish", effectiveFrom } });
  if (!ok) return showStatus(data.message || "Ошибка публикации", "bad");
  showStatus(`Прайс-лист #${plId} опубликован`, "ok");
  loadPriceLists();
};

window._archivePriceList = async (plId) => {
  if (!confirm(`Архивировать прайс-лист #${plId}?`)) return;
  const { ok, data } = await api(`/suppliers/${state.selectedSupplierId}/price-lists/${plId}`, { method: "POST", body: { action: "archive" } });
  if (!ok) return showStatus(data.message || "Ошибка архивации", "bad");
  showStatus(`Прайс-лист #${plId} архивирован`, "ok");
  loadPriceLists();
};

window._loadPriceItems = async (plId) => {
  const { ok, data } = await api(`/suppliers/${state.selectedSupplierId}/price-lists/${plId}`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки позиций", "bad");
  const el = document.getElementById(`price-items-${plId}`);
  const items = data.item?.items || [];
  if (!items.length) { el.innerHTML = "<p class='sub' style='margin:0'>Нет позиций</p>"; return; }
  el.innerHTML = `<table><thead><tr><th>Тип</th><th>Материал</th><th>Базовая</th><th>За единицу</th><th>Ед.</th></tr></thead>
    <tbody>${items.map((i) => `<tr><td><code>${esc(i.furnitureType)}</code></td><td>${esc(i.material)}</td><td>${fmtMoney(i.basePriceKzt)}</td><td>${fmtMoney(i.unitPriceKzt)}</td><td>${esc(i.unit)}</td></tr>`).join("")}</tbody></table>`;
};

window._createPriceList = async () => {
  const sid = state.selectedSupplierId;
  if (!sid) return showStatus("Выберите поставщика", "bad");
  const note = prompt("Примечание к прайс-листу:") || "";
  const { ok, data } = await api(`/suppliers/${sid}/price-lists`, { method: "POST", body: { note } });
  if (!ok) return showStatus(data.message || "Ошибка создания прайс-листа", "bad");
  showStatus(`Прайс-лист #${data.item.id} создан`, "ok");
  loadPriceLists();
};

window._createSupplier = async () => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Добавить поставщика</h2>
    <label>Код<input type="text" id="sup-code" placeholder="SUP001" /></label>
    <label>Название<input type="text" id="sup-name" placeholder="Фурнитура Плюс" /></label>
    <label>Контактное лицо<input type="text" id="sup-contact" placeholder="Иван Иванов" /></label>
    <label>Телефон<input type="text" id="sup-phone" placeholder="+7 700 123 4567" /></label>
    <label>Email<input type="text" id="sup-email" placeholder="info@example.com" /></label>
    <label>Примечание<textarea id="sup-note" placeholder="Оптовый поставщик фурнитуры"></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-create-supplier">Создать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-create-supplier").onclick = async () => {
    const { ok, data } = await api("/suppliers", { method: "POST", body: {
      code: document.getElementById("sup-code").value,
      name: document.getElementById("sup-name").value,
      contact: document.getElementById("sup-contact").value,
      phone: document.getElementById("sup-phone").value,
      email: document.getElementById("sup-email").value,
      note: document.getElementById("sup-note").value
    }});
    if (!ok) return showStatus(data.message || "Ошибка создания поставщика", "bad");
    showStatus(`Поставщик #${data.item.id} создан`, "ok");
    window._closeModal();
    loadSuppliers();
  };
};

document.getElementById("btn-load-suppliers").onclick = loadSuppliers;
document.getElementById("btn-create-supplier").onclick = () => window._createSupplier();
document.getElementById("btn-create-price-list").onclick = () => window._createPriceList();
document.getElementById("btn-load-price-lists").onclick = loadPriceLists;

/* ── Clients ── */

async function loadClients() {
  const { ok, data } = await api("/clients");
  if (!ok) return showStatus(data.message || "Ошибка загрузки клиентов", "bad");
  state.clients = data.items || [];
  renderClients();
  showStatus(`Загружено ${state.clients.length} клиент(ов)`, "ok");
}

function renderClients() {
  const el = document.getElementById("client-list");
  if (!state.clients.length) { el.innerHTML = "<p class='sub'>Нет клиентов</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Имя</th><th>Телефон</th><th>Email</th><th>Примечание</th><th>Дата</th></tr></thead>
    <tbody>${state.clients.map((c) => `<tr>
      <td>${c.id}</td>
      <td>${esc(c.name)}</td>
      <td>${esc(c.phone || "—")}</td>
      <td>${esc(c.email || "—")}</td>
      <td>${esc(c.note || "—")}</td>
      <td>${esc(c.createdAt || "")}</td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window._createClient = async () => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Добавить клиента</h2>
    <label>Имя<input type="text" id="cl-name" placeholder="Иван Иванов" /></label>
    <label>Телефон<input type="text" id="cl-phone" placeholder="+7 700 123 4567" /></label>
    <label>Email<input type="text" id="cl-email" placeholder="ivan@example.com" /></label>
    <label>Примечание<textarea id="cl-note" placeholder="Первый контакт через сайт"></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-create-client">Создать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-create-client").onclick = async () => {
    const { ok, data } = await api("/clients", { method: "POST", body: {
      name: document.getElementById("cl-name").value,
      phone: document.getElementById("cl-phone").value,
      email: document.getElementById("cl-email").value,
      note: document.getElementById("cl-note").value
    }});
    if (!ok) return showStatus(data.message || "Ошибка создания клиента", "bad");
    showStatus(`Клиент #${data.item.id} создан`, "ok");
    window._closeModal();
    loadClients();
  };
};

document.getElementById("btn-load-clients").onclick = loadClients;
document.getElementById("btn-create-client").onclick = () => window._createClient();

/* ── Orders ── */

async function loadOrders() {
  const clientId = document.getElementById("ord-client-id").value;
  const path = clientId ? `/orders?clientId=${clientId}` : "/orders";
  const { ok, data } = await api(path);
  if (!ok) return showStatus(data.message || "Ошибка загрузки заказов", "bad");
  state.orders = data.items || [];
  renderOrders();
  showStatus(`Загружено ${state.orders.length} заказ(ов)`, "ok");
}

function renderOrders() {
  const el = document.getElementById("order-list");
  if (!state.orders.length) { el.innerHTML = "<p class='sub'>Нет заказов</p>"; return; }
  el.innerHTML = `<table>
    <thead><tr><th>ID</th><th>Клиент</th><th>Статус</th><th>Пакет</th><th>Бюджет</th><th>Дата</th><th></th></tr></thead>
    <tbody>${state.orders.map((o) => `<tr>
      <td>${o.id}</td>
      <td>${o.clientId || "—"}</td>
      <td>${showBadge(o.status)}</td>
      <td>${esc(o.servicePackage || "—")}</td>
      <td>${o.budgetKzt ? fmtMoney(o.budgetKzt) : "—"}</td>
      <td>${esc(o.createdAt || "")}</td>
      <td><button class="secondary" onclick="window._viewOrderDetail(${o.id})">Подробнее</button></td>
    </tr>`).join("")}</tbody>
  </table>`;
}

window._viewOrderDetail = async (orderId) => {
  const { ok, data } = await api(`/orders/${orderId}`);
  if (!ok) return showStatus(data.message || "Ошибка загрузки заказа", "bad");
  const order = data.order;
  const engagements = data.engagements || [];
  const el = document.getElementById("order-detail");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="card">
      <h2>Заказ #${order.id} — ${showBadge(order.status)}</h2>
      <div class="sub">Клиент: ${order.clientId} · Пакет: ${esc(order.servicePackage || "—")} · Бюджет: ${order.budgetKzt ? fmtMoney(order.budgetKzt) : "—"}</div>
      ${order.note ? `<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;color:var(--muted);margin:8px 0;background:#f4f6f9;padding:12px;border-radius:8px">${esc(order.note)}</pre>` : ""}
      <h3>Engagements (${engagements.length})</h3>
      ${engagements.length ? `<table><thead><tr><th>ID</th><th>Пакет</th><th>Статус</th><th>Цена</th><th>Зачёт</th><th>Ревизии</th></tr></thead>
        <tbody>${engagements.map((e) => `<tr>
          <td>${e.id}</td>
          <td><code>${esc(e.packageCode)}</code></td>
          <td>${showBadge(e.status)}</td>
          <td>${fmtMoney(e.priceKzt)}</td>
          <td>${e.creditedAmountKzt ? fmtMoney(e.creditedAmountKzt) : "—"}</td>
          <td>${e.revisionRound}/${e.maxRevisions}</td>
        </tr>`).join("")}</tbody></table>` : "<p class='sub'>Нет engagements</p>"}
    </div>`;
};

window._createOrder = async () => {
  const clients = state.clients;
  if (!clients.length) {
    const { ok, data } = await api("/clients");
    if (ok) state.clients = data.items || [];
  }
  const clientOptions = state.clients.map((c) => `<option value="${c.id}">${esc(c.name)} (ID: ${c.id})</option>`).join("");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Создать заказ</h2>
    <label>Клиент
      <select id="ord-client">${clientOptions || "<option value=''>Нет клиентов — создайте клиента</option>"}</select>
    </label>
    <label>Запрос клиента<textarea id="ord-request" placeholder="Опишите запрос клиента — кухня, шкаф, гардеробная..."></textarea></label>
    <label>Бюджет (тг)<input type="number" id="ord-budget" placeholder="500000" min="0" /></label>
    <label>Примечание<textarea id="ord-note" placeholder="Дополнительные примечания"></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-create-order">Создать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-create-order").onclick = async () => {
    const clientId = document.getElementById("ord-client").value;
    if (!clientId) return showStatus("Выберите клиента", "bad");
    const requestText = document.getElementById("ord-request").value;
    const budget = document.getElementById("ord-budget").value;
    const note = document.getElementById("ord-note").value;
    const { ok, data } = await api("/orders", { method: "POST", body: {
      clientId: Number(clientId),
      requestText,
      budgetKzt: budget ? Number(budget) : undefined,
      note
    }});
    if (!ok) return showStatus(data.message || "Ошибка создания заказа", "bad");
    showStatus(`Заказ #${data.item.id} создан`, "ok");
    window._closeModal();
    loadOrders();
  };
};

document.getElementById("btn-load-orders").onclick = loadOrders;
document.getElementById("btn-create-order").onclick = () => window._createOrder();

/* ── Resolve Revision Modal ── */

window._showResolveRevisionModal = async (did) => {
  const { ok, data } = await api(`/deliverables/${did}?revisions=true`);
  const revisions = ok ? (data.items || []) : [];
  const pending = revisions.filter((r) => !r.resolvedAt);
  if (!pending.length) return showStatus("Нет активных правок для этого deliverable", "bad");
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Решить правку для deliverable #${did}</h2>
    <p class="sub">Активные правки: ${pending.length}</p>
    <label>ID правки
      <select id="resolve-rev-id">${pending.map((r) => `<option value="${r.id}">#${r.id} — ${esc(r.requestNote || "без комментария")}</option>`).join("")}</select>
    </label>
    <label>Решение<textarea id="resolve-note" placeholder="Опишите как исправлено"></textarea></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-resolve">Решить</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-resolve").onclick = async () => {
    const revisionId = document.getElementById("resolve-rev-id").value;
    const resolution = document.getElementById("resolve-note").value;
    const { ok: resOk, data: resData } = await api(`/deliverables/${did}`, { method: "PATCH", body: { action: "resolve_revision", revisionId: Number(revisionId), resolution } });
    if (!resOk) return showStatus(resData.message || "Ошибка решения правки", "bad");
    showStatus(`Правка #${revisionId} решена`, "ok");
    window._closeModal();
    loadDeliverables();
  };
};

/* ── Add Price Item (inside supplier detail) ── */

window._showAddPriceItemModal = (plId) => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Добавить позицию в прайс-лист #${plId}</h2>
    <label>Тип мебели
      <select id="pi-type">
        <option value="kitchen">kitchen</option>
        <option value="wardrobe">wardrobe</option>
        <option value="living">living</option>
        <option value="bedroom">bedroom</option>
        <option value="bathroom">bathroom</option>
        <option value="other">other</option>
      </select>
    </label>
    <label>Материал<input type="text" id="pi-material" placeholder="ЛДСП 18мм" /></label>
    <label>Метка<input type="text" id="pi-label" placeholder="Стандарт ЛДСП" /></label>
    <label>Базовая цена (тг)<input type="number" id="pi-base" placeholder="45000" min="0" /></label>
    <label>Цена за единицу (тг)<input type="number" id="pi-unit" placeholder="12000" min="0" /></label>
    <label>Единица
      <select id="pi-unit-type">
        <option value="м.п.">м.п.</option>
        <option value="шт.">шт.</option>
        <option value="м2">м2</option>
      </select>
    </label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-add-item">Добавить</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-add-item").onclick = async () => {
    const { ok, data } = await api(`/suppliers/${state.selectedSupplierId}/price-lists`, { method: "POST", body: {
      action: "add_item",
      priceListId: plId,
      furnitureType: document.getElementById("pi-type").value,
      material: document.getElementById("pi-material").value,
      label: document.getElementById("pi-label").value,
      basePriceKzt: Number(document.getElementById("pi-base").value),
      unitPriceKzt: Number(document.getElementById("pi-unit").value),
      unit: document.getElementById("pi-unit-type").value
    }});
    if (!ok) return showStatus(data.message || "Ошибка добавления позиции", "bad");
    showStatus(`Позиция добавлена`, "ok");
    window._closeModal();
    window._loadPriceItems(plId);
  };
};

/* ── Estimate Generation ── */

window._generateEstimate = async (plId) => {
  const modal = document.getElementById("modal-body");
  modal.innerHTML = `
    <h2>Сгенерировать estimate из прайс-листа #${plId}</h2>
    <label>Draft ID<input type="number" id="est-draft-id" placeholder="ID PDF draft" min="1" /></label>
    <label>Материал<input type="text" id="est-material" placeholder="ЛДСП 18мм" /></label>
    <label>Скидка (%)<input type="number" id="est-discount" placeholder="0" min="0" max="100" value="0" /></label>
    <div class="row" style="margin-top:16px">
      <button id="btn-do-estimate">Сгенерировать</button>
      <button class="secondary" onclick="window._closeModal()">Отмена</button>
    </div>`;
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("btn-do-estimate").onclick = async () => {
    const draftId = document.getElementById("est-draft-id").value;
    const material = document.getElementById("est-material").value;
    const discount = Number(document.getElementById("est-discount").value) || 0;
    const { ok, data } = await api(`/suppliers/${state.selectedSupplierId}/price-lists`, { method: "POST", body: {
      action: "supplier_estimate",
      draftId: Number(draftId),
      supplierId: state.selectedSupplierId,
      material,
      discountPercent: discount
    }});
    if (!ok) return showStatus(data.message || "Ошибка генерации estimate", "bad");
    const modal2 = document.getElementById("modal-body");
    modal2.innerHTML = `<h2>Estimate #${data.estimateId} создан</h2>
      <pre style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow:auto;background:#f4f6f9;padding:12px;border-radius:8px">${esc(JSON.stringify(data.estimate || data, null, 2))}</pre>
      <div class="row" style="margin-top:16px"><button class="secondary" onclick="window._closeModal()">Закрыть</button></div>`;
  };
};

/* ── Launch Panel ── */

async function loadLaunchPanel() {
  const el = document.getElementById("launch-content");
  let html = `<div class="card"><h2>Production Readiness</h2>`;
  html += `<div class="grid">
    <div class="stat"><div class="k">Status</div><div class="v">Phase 4.3</div></div>
    <div class="stat"><div class="k">MVP</div><div class="v">packages/mvp</div></div>
    <div class="stat"><div class="k">Database</div><div class="v">D1 (1 binding)</div></div>
    <div class="stat"><div class="k">Orchestrator</div><div class="v">Absent</div></div>
  </div>`;

  html += `<h3>Active Packages</h3><table><thead><tr><th>Code</th><th>Name</th><th>Price</th><th>Credit</th><th>Status</th></tr></thead><tbody>`;
  const { ok: pkgOk, data: pkgData } = await api("/packages");
  if (pkgOk) {
    for (const p of (pkgData.items || [])) {
      html += `<tr><td><code>${esc(p.code)}</code></td><td>${esc(p.name)}</td><td>${fmtMoney(p.priceKzt)}</td><td>${p.creditedOnOrder ? "Yes" : "No"}</td><td>${showBadge(p.code === "package_c" ? "deferred" : "active")}</td></tr>`;
    }
  }
  html += `</tbody></table>`;

  html += `<h3>WhatsApp Webhook</h3><div class="grid"><div class="stat"><div class="k">Status</div><div class="v">Disabled</div></div></div>`;
  html += `<h3>Migrations</h3><div class="sub">8 migrations applied (0001–0008). 22 tables, 53 indexes.</div>`;
  html += `<h3>Rehearsal</h3><div class="sub">Run <code>npm run smoke:phase43</code> to execute 5 operational rehearsals.</div>`;
  html += `<h3>Deployment</h3><div class="sub">See <code>docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md</code></div>`;
  html += `</div>`;
  el.innerHTML = html;
}

/* ── Wire up view-specific loaders ── */

const originalSwitchView = switchView;
switchView = function(viewName) {
  originalSwitchView(viewName);
  if (viewName === "launch") loadLaunchPanel();
  if (viewName === "clients") loadClients();
  if (viewName === "orders") loadOrders();
};

switchView("packages");
