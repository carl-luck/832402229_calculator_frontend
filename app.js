/* CalcLab frontend: every calculation and history mutation goes through the HTTP API. */
(function () {
  "use strict";

  const configuredApi = window.CALCULATOR_API_BASE || "";
  const API_BASE = configuredApi.replace(/\/$/, "");
  const state = { history: [], loading: false, filter: "" };
  const elements = {
    form: document.getElementById("calculate-form"),
    input: document.getElementById("expression-input"),
    output: document.getElementById("result-output"),
    calculate: document.getElementById("calculate-button"),
    keypad: document.getElementById("keypad"),
    history: document.getElementById("history-list"),
    historyCount: document.getElementById("history-count"),
    search: document.getElementById("history-search"),
    clearHistory: document.getElementById("clear-history"),
    connectionPill: document.getElementById("connection-pill"),
    connectionText: document.getElementById("connection-text"),
    toastRegion: document.getElementById("toast-region"),
    themeToggle: document.getElementById("theme-toggle"),
    apiEndpoint: document.getElementById("api-endpoint")
  };

  class ApiError extends Error {
    constructor(message, offline) {
      super(message);
      this.name = "ApiError";
      this.offline = Boolean(offline);
    }
  }

  function apiUrl(path) {
    return `${API_BASE}${path}`;
  }

  async function request(path, options) {
    let response;
    try {
      response = await fetch(apiUrl(path), { headers: { Accept: "application/json", ...(options && options.body ? { "Content-Type": "application/json" } : {}) }, ...options });
    } catch (error) {
      throw new ApiError("无法连接后端服务，请确认服务已启动。", true);
    }
    let payload = {};
    try { payload = await response.json(); } catch (error) { /* A non-JSON response is handled below. */ }
    if (!response.ok || payload.success === false) {
      const message = payload.error && payload.error.message || payload.message || `请求失败（${response.status}）`;
      throw new ApiError(message, false);
    }
    return payload;
  }

  function dataFrom(payload) {
    return payload && payload.data !== undefined ? payload.data : payload;
  }

  function setConnection(online, text) {
    elements.connectionPill.classList.toggle("online", online);
    elements.connectionPill.classList.toggle("offline", online === false);
    elements.connectionText.textContent = text;
  }

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = message;
    elements.toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 4200);
  }

  function formatResult(value) {
    if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
    return String(value);
  }

  function setResult(value, mode) {
    elements.output.className = `result-output${mode ? ` ${mode}` : ""}`;
    elements.output.textContent = value;
  }

  async function calculate(event) {
    event.preventDefault();
    const expression = elements.input.value.trim();
    if (!expression) {
      setResult("请输入表达式", "error");
      elements.input.focus();
      return;
    }
    state.loading = true;
    elements.calculate.disabled = true;
    setResult("后端计算中…", "pending");
    try {
      const payload = await request("/api/calculate", { method: "POST", body: JSON.stringify({ expression }) });
      const record = dataFrom(payload);
      if (!record || record.result === undefined) throw new ApiError("后端返回的数据格式不完整。", false);
      setResult(formatResult(record.result));
      setConnection(true, "后端已连接");
      await loadHistory(true);
    } catch (error) {
      setResult(error.message || "计算失败", "error");
      setConnection(false, error.offline ? "后端离线" : "请求异常");
      showToast(error.message || "计算失败", "error");
    } finally {
      state.loading = false;
      elements.calculate.disabled = false;
    }
  }

  async function loadHistory(silent) {
    if (!silent) renderHistoryState("loading");
    try {
      const payload = await request("/api/history?limit=100");
      const records = dataFrom(payload);
      state.history = Array.isArray(records) ? records : [];
      setConnection(true, "后端已连接");
      renderHistory();
    } catch (error) {
      state.history = [];
      renderHistoryState("error", error.message);
      setConnection(false, error.offline ? "后端离线" : "请求异常");
      if (!silent) showToast(error.message, "error");
    }
  }

  function renderHistoryState(type, message) {
    elements.historyCount.textContent = "—";
    if (type === "loading") {
      elements.history.innerHTML = '<div class="history-state loading-state"><span class="spinner"></span><span>正在从数据库读取…</span></div>';
      return;
    }
    elements.history.innerHTML = `<div class="history-state error-state"><span>${escapeHtml(message || "无法读取历史记录")}</span><button class="state-action" type="button" data-retry>重新连接</button></div>`;
  }

  function renderHistory() {
    const query = state.filter.toLowerCase();
    const records = state.history.filter((record) => String(record.expression || "").toLowerCase().includes(query));
    elements.historyCount.textContent = `${records.length} 条`;
    if (!records.length) {
      elements.history.innerHTML = `<div class="empty-state">${query ? "没有匹配的表达式" : "还没有计算记录"}</div>`;
      return;
    }
    elements.history.innerHTML = records.map((record) => {
      const expression = escapeHtml(record.expression || "");
      const result = escapeHtml(formatResult(record.result));
      const date = escapeHtml(formatDate(record.created_at));
      const id = escapeHtml(String(record.id));
      return `<article class="history-item"><div><div class="history-expression" title="${expression}">${expression}</div><div class="history-meta">${date} · #${id}</div></div><div><div class="history-result">${result}</div><button class="delete-button" type="button" data-delete-id="${id}" aria-label="删除 ${expression}">删除</button></div></article>`;
    }).join("");
  }

  async function deleteRecord(id) {
    try {
      await request(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      showToast("已从后端数据库删除记录");
      await loadHistory(true);
    } catch (error) {
      showToast(error.message || "删除失败", "error");
      setConnection(false, error.offline ? "后端离线" : "请求异常");
    }
  }

  async function clearHistory() {
    if (!state.history.length || !window.confirm("确定要清空全部计算历史吗？此操作会删除后端数据库中的记录。")) return;
    elements.clearHistory.disabled = true;
    try {
      await request("/api/history", { method: "DELETE" });
      showToast("历史记录已清空");
      await loadHistory(true);
    } catch (error) {
      showToast(error.message || "清空失败", "error");
    } finally {
      elements.clearHistory.disabled = false;
    }
  }

  function appendValue(value) {
    const input = elements.input;
    const start = input.selectionStart === null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd === null ? input.value.length : input.selectionEnd;
    input.value = `${input.value.slice(0, start)}${value}${input.value.slice(end)}`;
    input.focus();
    const caret = start + value.length;
    input.setSelectionRange(caret, caret);
  }

  function formatDate(value) {
    if (!value) return "未知时间";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === "dark";
    elements.themeToggle.innerHTML = `<span aria-hidden="true">${dark ? "☀" : "☾"}</span>`;
    elements.themeToggle.setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
    elements.themeToggle.title = dark ? "切换浅色模式" : "切换深色模式";
  }

  elements.form.addEventListener("submit", calculate);
  elements.keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "clear") {
      elements.input.value = "";
      setResult("—");
      elements.input.focus();
      return;
    }
    if (button.dataset.value) appendValue(button.dataset.value);
  });
  document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
    elements.input.value = button.dataset.example;
    elements.input.focus();
  }));
  elements.history.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) deleteRecord(deleteButton.dataset.deleteId);
    if (event.target.closest("[data-retry]")) loadHistory(false);
  });
  elements.search.addEventListener("input", (event) => { state.filter = event.target.value.trim(); renderHistory(); });
  elements.clearHistory.addEventListener("click", clearHistory);
  elements.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    window.localStorage.setItem("calclab-theme", next);
  });
  elements.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); elements.form.requestSubmit(); }
    if (event.key === "Escape") { elements.input.value = ""; setResult("—"); }
  });

  const savedTheme = window.localStorage.getItem("calclab-theme");
  applyTheme(savedTheme === "dark" ? "dark" : "light");
  elements.apiEndpoint.textContent = API_BASE ? `API: ${API_BASE}` : "API: same origin";
  loadHistory(false);
})();
