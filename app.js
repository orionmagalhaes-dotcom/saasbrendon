
"use strict";

(() => {
  const STORAGE_KEY = "restobar_control_v1";
  const SESSION_KEY = "restobar_local_session_user";
  const SESSION_TAB_KEY = "restobar_local_session_user_tab";
  const CLIENT_SESSION_KEY = "restobar_local_client_session_id";
  const PRINTER_PREFS_KEY = "restobar_local_printer_prefs_v1";
  const HISTORY_RETENTION_DAYS = 90;
  const PAYABLES_RETENTION_DAYS = 350;
  const CASH_HTML_REPORTS_LIMIT = 120;
  const FINAL_CLIENT_PREP_FLAG = "final_client_ready_v1";
  const FINAL_CLIENT_PREP_MARKER = "final_client_prepared_at";
  const FINAL_CLIENT_PREP_SIGNATURE_KEY = "final_client_prep_signature";
  const FINAL_CLIENT_PREP_SIGNATURE = "2026-02-25-final-client";
  const CATALOG_BACKUPS_META_KEY = "catalogBackups";
  const CATALOG_BACKUPS_LIMIT = 30;
  const EDUARDO_RECOVERY_MARKER_KEY = "eduardo_restore_applied_v1";
  const ACCESS_CODE_WAITER_PREFIX = "Garcom Codigo";
  const SYSTEM_TEST_MARKERS = Object.freeze(["teste", "test", "mock", "pixteste", "cupom de teste"]);
  const ESTABLISHMENT_NAME = "Brancao";
  const CATEGORIES = ["Bar", "Dose/Copo", "Cozinha", "Espetinhos", "Avulso", "Ofertas"];
  const BAR_SUBCATEGORIES = ["Geral"];
  const KITCHEN_STATUSES = [
    { value: "fila", label: "Fila de espera" },
    { value: "cozinhando", label: "Cozinhando" },
    { value: "em_falta", label: "Em falta" },
    { value: "entregue", label: "Entregue" }
  ];
  const KITCHEN_PRIORITIES = [
    { value: "normal", label: "Normal" },
    { value: "comum", label: "Comum" },
    { value: "alta", label: "Prioridade alta" },
    { value: "maxima", label: "Prioridade maxima" }
  ];
  const PAYMENT_METHODS = [
    { value: "dinheiro", label: "Dinheiro" },
    { value: "maquineta_debito", label: "Maquineta/Debito" },
    { value: "maquineta_credito", label: "Maquineta/Credito" },
    { value: "pix", label: "Pix" },
    { value: "fiado", label: "Fiado" }
  ];
  const CANCEL_REASONS = [
    "Troca de pedido",
    "Desistencia de pedido",
    "Alteracao de pedido",
    "Reclamacao de pedido",
    "Cortesia",
    "Sem ocorrencia"
  ];
  const SUPABASE_URL = "https://fquiicsdvjqzrbeiuaxo.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hrVkbcMHzu04NcpSvttgrw_VIiVctr-";
  const SUPABASE_PROJECT_ID = "fquiicsdvjqzrbeiuaxo";
  const DEV_ACCESS_LOGIN = "dev1";
  const DEV_ACCESS_PASSWORD = "dev1";
  const DEV_SESSION_ID = "__dev__";
  const DEVICE_PRESENCE_TTL_MS = 45 * 1000;
  const DEVICE_PRESENCE_PING_MS = 10 * 1000;
  const ROLE_ACCESS_CODE_BY_ROLE = Object.freeze({
    admin: "1111",
    waiter: "2222",
    cook: "3333"
  });
  const PRINT_PIPELINE_ENABLED = false;
  const AUTO_OPEN_KITCHEN_PREVIEW_ON_ADD = false;

  const app = document.getElementById("app");
  const uiState = {
    adminTab: "dashboard",
    devTab: "monitor",
    waiterTab: "abrir",
    cookTab: "ativos",
    finalizeOpenByComanda: {},
    waiterCollapsedByComanda: {},
    adminKitchenCollapsedByRow: {},
    waiterActiveComandaId: null,
    deferredPrompt: null,
    monitorWaiterId: "all",
    comandaDetailsId: null,
    comandaDetailsSource: "closed",
    waiterComandaSearch: "",
    waiterCatalogSearch: "",
    waiterCatalogCategory: "all",
    adminComandaSearch: "",
    adminHistoryComandaSearch: "",
    adminKitchenSearch: "",
    adminInlineEditComandaId: null,
    cookSearch: "",
    supabaseStatus: "desconectado",
    supabaseLastError: "",
    devicePresenceBySession: {},
    remoteMonitorEvents: [],
    waiterReadyModalItems: [],
    waiterReadySeenMap: {},
    waiterKitchenReceiptNotices: [],
    waiterKitchenReceiptSeenMap: {},
    waiterDraftByComanda: {},
    persistedDetailsOpen: {},
    itemSelector: {
      open: false,
      comandaId: "",
      mode: "increment"
    },
    quickSalePaidConfirm: true,
    printerPrefs: loadPrinterPrefs(),
    qzSecurityConfigured: false
  };

  const DEV_SHADOW_USER = Object.freeze({
    id: DEV_SESSION_ID,
    role: "dev",
    name: "Dev",
    functionName: "Dev",
    login: DEV_ACCESS_LOGIN,
    active: true
  });

  function isAdminOrDev(userOrRole) {
    const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
    return role === "admin" || role === "dev";
  }

  function buildClientSessionId() {
    const existing = String(sessionStorage.getItem(CLIENT_SESSION_KEY) || "").trim();
    if (existing) return existing;
    const created = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(CLIENT_SESSION_KEY, created);
    return created;
  }

  const clientSessionId = buildClientSessionId();

  function isoNow() {
    return new Date().toISOString();
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function parseUpdatedAtTimestamp(value) {
    const ts = new Date(value || 0).getTime();
    if (!Number.isFinite(ts)) return 0;
    const oneYearAhead = Date.now() + 365 * 24 * 60 * 60 * 1000;
    if (ts > oneYearAhead) return 0;
    return ts;
  }

  function browserNameFromUa(uaRaw) {
    const ua = String(uaRaw || "").toLowerCase();
    if (ua.includes("edg/")) return "Edge";
    if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
    if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
    if (ua.includes("firefox/")) return "Firefox";
    if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
    return "Navegador";
  }

  function deviceTypeFromUa(uaRaw) {
    const ua = String(uaRaw || "").toLowerCase();
    if (ua.includes("ipad") || ua.includes("tablet")) return "Tablet";
    if (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone")) return "Celular";
    return "Desktop";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("pt-BR");
  }

  function formatDateOnlySafe(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    const directIsoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (directIsoDate) {
      return `${directIsoDate[3]}/${directIsoDate[2]}/${directIsoDate[1]}`;
    }
    return formatDate(raw);
  }

  function formatDateTimeWithDay(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseNumber(value || 0));
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function detailKeyPart(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function detailKey(...parts) {
    const key = parts.map((part) => detailKeyPart(part)).filter(Boolean).join(":");
    return key || "";
  }

  function isDetailOpen(key, defaultOpen = false) {
    if (!key) return defaultOpen;
    if (Object.prototype.hasOwnProperty.call(uiState.persistedDetailsOpen, key)) {
      return Boolean(uiState.persistedDetailsOpen[key]);
    }
    return defaultOpen;
  }

  function detailOpenAttr(key, defaultOpen = false) {
    return isDetailOpen(key, defaultOpen) ? " open" : "";
  }

  function formCheckboxChecked(form, name, fallback = false) {
    if (!form || !name) return Boolean(fallback);
    const input = form.querySelector(`input[name="${name}"]`);
    if (!input) return Boolean(fallback);
    return Boolean(input.checked);
  }

  function kitchenRowCollapseKey(comandaId, itemId) {
    return detailKey("admin-kitchen-row", comandaId, itemId);
  }

  function isAdminKitchenRowCollapsed(comandaId, itemId) {
    const key = kitchenRowCollapseKey(comandaId, itemId);
    if (!key) return false;
    return Boolean(uiState.adminKitchenCollapsedByRow[key]);
  }

  function setAdminKitchenRowCollapsed(comandaId, itemId, collapsed) {
    const key = kitchenRowCollapseKey(comandaId, itemId);
    if (!key) return;
    if (collapsed) {
      uiState.adminKitchenCollapsedByRow[key] = true;
    } else {
      delete uiState.adminKitchenCollapsedByRow[key];
    }
  }

  function parseNumber(input) {
    if (typeof input === "number") return input;
    const raw = String(input || "").trim().replace(/[^0-9,.-]/g, "");
    const hasComma = raw.includes(",");
    const normalized = hasComma ? raw.replaceAll(".", "").replaceAll(",", ".") : raw;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeDeletedIdList(source) {
    if (!Array.isArray(source)) return [];
    return [...new Set(source.map((id) => String(id || "").trim()).filter(Boolean))];
  }

  function sortByRowIdAsc(rows = []) {
    return [...rows].sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { numeric: true }));
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function buildCatalogSnapshot(source) {
    const users = sortByRowIdAsc(
      (Array.isArray(source?.users) ? source.users : [])
        .filter((u) => u && (u.role === "admin" || u.role === "waiter" || u.role === "cook"))
        .map((u) => ({
          id: Number.isFinite(Number(u.id)) ? Number(u.id) : String(u.id || ""),
          role: String(u.role || ""),
          name: String(u.name || ""),
          functionName: String(u.functionName || ""),
          login: String(u.login || ""),
          password: String(u.password || ""),
          active: u.active !== false
        }))
    );
    const products = sortByRowIdAsc(
      (Array.isArray(source?.products) ? source.products : []).map((p) => ({
        id: Number.isFinite(Number(p?.id)) ? Number(p.id) : String(p?.id || ""),
        name: String(p?.name || ""),
        category: String(p?.category || ""),
        subcategory: String(p?.subcategory || ""),
        price: Number(p?.price || 0),
        stock: Number(p?.stock || 0),
        prepTime: Number(p?.prepTime || 0),
        cost: Number(p?.cost || 0),
        available: p?.available !== false,
        requiresKitchen: Boolean(p?.requiresKitchen)
      }))
    );
    const signature = hashText(JSON.stringify({ users, products }));
    return { users, products, signature };
  }

  function buildCatalogBackupId(createdAt, signature) {
    const seed = `${String(createdAt || "").trim()}-${String(signature || "").trim()}`.replace(/[^a-zA-Z0-9_-]/g, "");
    return seed ? `bkp-${seed}` : `bkp-${Date.now().toString(36)}`;
  }

  function normalizeCatalogBackups(source) {
    if (!Array.isArray(source)) return [];
    const normalized = [];
    const seen = new Set();
    for (const entry of source) {
      if (!entry || typeof entry !== "object") continue;
      const snapshot = buildCatalogSnapshot(entry);
      if (!snapshot.users.length && !snapshot.products.length) continue;
      const createdAt = typeof entry.createdAt === "string" && entry.createdAt ? entry.createdAt : isoNow();
      const signature = String(entry.signature || snapshot.signature || "").trim() || snapshot.signature;
      const dedupeKey = `${createdAt}|${signature}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      normalized.push({
        id: String(entry.id || buildCatalogBackupId(createdAt, signature)),
        createdAt,
        reason: typeof entry.reason === "string" && entry.reason ? entry.reason : "auto",
        signature,
        users: snapshot.users,
        products: snapshot.products
      });
    }
    normalized.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return normalized.slice(-CATALOG_BACKUPS_LIMIT);
  }

  function mergeCatalogBackups(...sources) {
    const merged = [];
    for (const source of sources) {
      if (!Array.isArray(source)) continue;
      merged.push(...source);
    }
    return normalizeCatalogBackups(merged);
  }

  function ensureCatalogBackup(targetState, reason = "auto") {
    if (!targetState || typeof targetState !== "object") return false;
    targetState.meta = targetState.meta || {};
    const backups = normalizeCatalogBackups(targetState.meta[CATALOG_BACKUPS_META_KEY]);
    const snapshot = buildCatalogSnapshot(targetState);
    if (!snapshot.users.length && !snapshot.products.length) {
      targetState.meta[CATALOG_BACKUPS_META_KEY] = backups;
      return false;
    }
    const latest = backups[backups.length - 1];
    if (latest && latest.signature === snapshot.signature) {
      targetState.meta[CATALOG_BACKUPS_META_KEY] = backups;
      return false;
    }
    const createdAt = isoNow();
    const next = {
      id: buildCatalogBackupId(createdAt, snapshot.signature),
      createdAt,
      reason: String(reason || "auto").slice(0, 48),
      signature: snapshot.signature,
      users: snapshot.users,
      products: snapshot.products
    };
    targetState.meta[CATALOG_BACKUPS_META_KEY] = [...backups, next].slice(-CATALOG_BACKUPS_LIMIT);
    targetState.meta.catalogBackupUpdatedAt = createdAt;
    targetState.meta.catalogBackupSignature = snapshot.signature;
    return true;
  }

  function applyCatalogBackupRecovery(targetState, ...backupSources) {
    if (!targetState || typeof targetState !== "object") return targetState;
    const meta = targetState.meta || {};
    const backups = mergeCatalogBackups(
      meta[CATALOG_BACKUPS_META_KEY],
      ...backupSources.map((source) => source?.meta?.[CATALOG_BACKUPS_META_KEY])
    );
    const recoveryEnabled = meta.enableCatalogRecovery === true;
    if (!backups.length || !recoveryEnabled) {
      return {
        ...targetState,
        meta: {
          ...meta,
          [CATALOG_BACKUPS_META_KEY]: backups
        }
      };
    }
    const latest = backups[backups.length - 1];
    const deletedProductIds = normalizeDeletedIdList(meta.deletedProductIds);
    const deletedUserIds = normalizeDeletedIdList(meta.deletedUserIds);
    return {
      ...targetState,
      users: mergedRowsById(targetState.users, latest.users, deletedUserIds),
      products: mergedRowsById(targetState.products, latest.products, deletedProductIds),
      meta: {
        ...meta,
        [CATALOG_BACKUPS_META_KEY]: backups
      }
    };
  }

  function mergedRowsById(localRows, remoteRows, deletedIds = [], options = {}) {
    const preferLocal = options.preferLocal !== false;
    const allowRemoteOnly = options.allowRemoteOnly !== false;
    const deletedSet = new Set(normalizeDeletedIdList(deletedIds));
    const localMap = new Map();
    for (const row of Array.isArray(localRows) ? localRows : []) {
      const id = String(row?.id ?? "").trim();
      if (!id || deletedSet.has(id)) continue;
      localMap.set(id, { ...row });
    }
    if (!allowRemoteOnly) {
      return [...localMap.values()].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
    }

    const map = new Map();
    const firstRows = preferLocal ? (Array.isArray(remoteRows) ? remoteRows : []) : Array.isArray(localRows) ? localRows : [];
    const secondRows = preferLocal ? Array.from(localMap.values()) : Array.isArray(remoteRows) ? remoteRows : [];
    for (const row of firstRows) {
      const id = String(row?.id ?? "").trim();
      if (!id || deletedSet.has(id)) continue;
      map.set(id, { ...row });
    }
    for (const row of secondRows) {
      const id = String(row?.id ?? "").trim();
      if (!id || deletedSet.has(id)) continue;
      map.set(id, { ...row });
    }
    return [...map.values()].sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
  }

  function pickRowByTimestamp(localRow, remoteRow, options = {}) {
    if (!localRow) return remoteRow || null;
    if (!remoteRow) return localRow || null;
    const localTs = new Date(options.getTimestamp ? options.getTimestamp(localRow) : localRow?.updatedAt || 0).getTime();
    const remoteTs = new Date(options.getTimestamp ? options.getTimestamp(remoteRow) : remoteRow?.updatedAt || 0).getTime();
    const preferLocal = options.preferLocal !== false;
    if (Number.isFinite(localTs) && Number.isFinite(remoteTs) && localTs !== remoteTs) {
      return localTs > remoteTs ? localRow : remoteRow;
    }
    return preferLocal ? localRow : remoteRow;
  }

  function mergeComandasById(localRows, remoteRows, options = {}) {
    const map = new Map();
    const allowRemoteOnly = options.allowRemoteOnly !== false;
    for (const comanda of Array.isArray(localRows) ? localRows : []) {
      const id = String(comanda?.id || "").trim();
      if (!id) continue;
      map.set(id, comanda);
    }
    for (const comanda of Array.isArray(remoteRows) ? remoteRows : []) {
      const id = String(comanda?.id || "").trim();
      if (!id) continue;
      if (!allowRemoteOnly && !map.has(id)) continue;
      const previous = map.get(id);
      map.set(
        id,
        pickRowByTimestamp(previous, comanda, {
          getTimestamp: (row) => {
            const lastEventAt = Array.isArray(row?.events) && row.events.length ? row.events[row.events.length - 1]?.ts : null;
            return row?.closedAt || lastEventAt || row?.createdAt || "";
          },
          preferLocal: options.preferLocal !== false
        })
      );
    }
    return [...map.values()];
  }

  function mergeRowsByIdWithTimestamp(localRows, remoteRows, options = {}) {
    const map = new Map();
    const allowRemoteOnly = options.allowRemoteOnly !== false;
    for (const row of Array.isArray(localRows) ? localRows : []) {
      const id = String(row?.id || "").trim();
      if (!id) continue;
      map.set(id, row);
    }
    for (const row of Array.isArray(remoteRows) ? remoteRows : []) {
      const id = String(row?.id || "").trim();
      if (!id) continue;
      if (!allowRemoteOnly && !map.has(id)) continue;
      const previous = map.get(id);
      map.set(id, pickRowByTimestamp(previous, row, options));
    }
    return [...map.values()];
  }

  function mergeAuditRows(localRows, remoteRows) {
    const seen = new Set();
    const merged = [];
    for (const row of [...(Array.isArray(localRows) ? localRows : []), ...(Array.isArray(remoteRows) ? remoteRows : [])]) {
      if (!row || typeof row !== "object") continue;
      const key = String(row.id || `${row.ts || ""}|${row.actorId || ""}|${row.type || ""}|${row.comandaId || ""}|${row.detail || ""}`);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    merged.sort((a, b) => new Date(b?.ts || 0) - new Date(a?.ts || 0));
    return merged.slice(0, 5000);
  }

  function sanitizeDeletedUserIds(deletedIds, ...states) {
    const ids = normalizeDeletedIdList(deletedIds);
    if (!ids.length) return [];
    const usersById = new Map();
    for (const state of states) {
      for (const user of Array.isArray(state?.users) ? state.users : []) {
        const id = String(user?.id ?? "").trim();
        if (!id) continue;
        if (!usersById.has(id)) {
          usersById.set(id, user);
        }
      }
    }
    return ids.filter((id) => {
      const user = usersById.get(String(id));
      if (!user) return true;
      return isKnownSystemTestUser(user);
    });
  }

  function sanitizeDeletedProductIds(deletedIds, ...states) {
    const ids = normalizeDeletedIdList(deletedIds);
    if (!ids.length) return [];
    const productsById = new Map();
    for (const state of states) {
      for (const product of Array.isArray(state?.products) ? state.products : []) {
        const id = String(product?.id ?? "").trim();
        if (!id) continue;
        if (!productsById.has(id)) {
          productsById.set(id, product);
        }
      }
    }
    return ids.filter((id) => {
      const product = productsById.get(String(id));
      if (!product) return true;
      return hasSystemTestMarker(product?.name);
    });
  }

  function normalizeOperationalResetAt(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const ts = parseUpdatedAtTimestamp(trimmed);
    return ts ? new Date(ts).toISOString() : "";
  }

  function selectLatestOperationalResetAt(...values) {
    let best = "";
    let bestTs = 0;
    for (const value of values) {
      const normalized = normalizeOperationalResetAt(value);
      if (!normalized) continue;
      const ts = parseUpdatedAtTimestamp(normalized);
      if (!ts || ts <= bestTs) continue;
      bestTs = ts;
      best = normalized;
    }
    return best;
  }

  function applyOperationalResetCutoff(targetState, cutoffIso) {
    if (!targetState || typeof targetState !== "object") return;
    const normalizedCutoff = normalizeOperationalResetAt(cutoffIso);
    if (!normalizedCutoff) return;
    const cutoffMs = parseUpdatedAtTimestamp(normalizedCutoff);
    if (!cutoffMs) return;

    const tsAtOrAfterCutoff = (value) => {
      const ts = parseUpdatedAtTimestamp(value);
      return ts && ts >= cutoffMs;
    };

    const filterComandaRows = (rows) =>
      (Array.isArray(rows) ? rows : [])
        .map((comanda) => {
          const copy = { ...comanda };
          const events = (Array.isArray(copy.events) ? copy.events : []).filter((event) => tsAtOrAfterCutoff(event?.ts));
          copy.events = events;
          const latestEventTs = Math.max(0, ...events.map((event) => parseUpdatedAtTimestamp(event?.ts)));
          const createdTs = parseUpdatedAtTimestamp(copy.createdAt);
          const closedTs = parseUpdatedAtTimestamp(copy.closedAt);
          const keep = createdTs >= cutoffMs || closedTs >= cutoffMs || latestEventTs >= cutoffMs;
          return keep ? copy : null;
        })
        .filter(Boolean);

    targetState.openComandas = filterComandaRows(targetState.openComandas);
    targetState.closedComandas = filterComandaRows(targetState.closedComandas);

    targetState.history90 = (Array.isArray(targetState.history90) ? targetState.history90 : [])
      .map((entry) => {
        const copy = { ...entry };
        copy.commandas = filterComandaRows(copy.commandas);
        copy.auditLog = (Array.isArray(copy.auditLog) ? copy.auditLog : []).filter((event) => tsAtOrAfterCutoff(event?.ts));
        const closureTs = parseUpdatedAtTimestamp(copy.closedAt || copy.createdAt || copy.updatedAt);
        const keep = closureTs >= cutoffMs || copy.commandas.length > 0 || copy.auditLog.length > 0;
        return keep ? copy : null;
      })
      .filter(Boolean);

    targetState.auditLog = (Array.isArray(targetState.auditLog) ? targetState.auditLog : []).filter((event) => tsAtOrAfterCutoff(event?.ts));
    targetState.payables = (Array.isArray(targetState.payables) ? targetState.payables : []).filter((row) => tsAtOrAfterCutoff(row?.paidAt || row?.createdAt));
    targetState.cookHistory = (Array.isArray(targetState.cookHistory) ? targetState.cookHistory : []).filter((row) =>
      tsAtOrAfterCutoff(row?.updatedAt || row?.deliveredAt)
    );
    targetState.cashHtmlReports = (Array.isArray(targetState.cashHtmlReports) ? targetState.cashHtmlReports : []).filter((row) =>
      tsAtOrAfterCutoff(row?.closedAt || row?.createdAt)
    );

    targetState.meta = targetState.meta || {};
    targetState.meta.operationalResetAt = normalizedCutoff;
  }

  function stateFootprint(source) {
    const users = Array.isArray(source?.users) ? source.users.length : 0;
    const products = Array.isArray(source?.products) ? source.products.length : 0;
    const openComandas = Array.isArray(source?.openComandas) ? source.openComandas.length : 0;
    const closedComandas = Array.isArray(source?.closedComandas) ? source.closedComandas.length : 0;
    const history90 = Array.isArray(source?.history90) ? source.history90.length : 0;
    const auditLog = Array.isArray(source?.auditLog) ? source.auditLog.length : 0;
    const payables = Array.isArray(source?.payables) ? source.payables.length : 0;
    const cashHtmlReports = Array.isArray(source?.cashHtmlReports) ? source.cashHtmlReports.length : 0;
    const cookHistory = Array.isArray(source?.cookHistory) ? source.cookHistory.length : 0;
    return {
      users,
      products,
      openComandas,
      closedComandas,
      history90,
      auditLog,
      payables,
      cashHtmlReports,
      cookHistory,
      catalogRows: users + products,
      operationalRows: openComandas + closedComandas + history90 + auditLog + payables + cashHtmlReports + cookHistory
    };
  }

  function isLikelyResetState(source) {
    const fp = stateFootprint(source);
    return fp.users <= 1 && fp.products === 0 && fp.openComandas === 0 && fp.closedComandas === 0 && fp.history90 === 0 && fp.payables === 0 && fp.cashHtmlReports === 0;
  }

  function shouldForceRemotePreference(localCandidate, remoteCandidate) {
    if (!isLikelyResetState(localCandidate)) return false;
    const remote = stateFootprint(remoteCandidate);
    return remote.catalogRows >= 3 || remote.operationalRows >= 5;
  }

  function mergeStateForCloud(localState, remoteState) {
    const localMeta = localState?.meta || {};
    const remoteMeta = remoteState?.meta || {};
    const localUpdated = parseUpdatedAtTimestamp(localMeta.updatedAt);
    const remoteUpdated = parseUpdatedAtTimestamp(remoteMeta.updatedAt);
    let preferLocal = localUpdated >= remoteUpdated;
    if (preferLocal && shouldForceRemotePreference(localState, remoteState)) {
      preferLocal = false;
    }
    const operationalResetAt = selectLatestOperationalResetAt(localMeta.operationalResetAt, remoteMeta.operationalResetAt);
    const catalogBackups = mergeCatalogBackups(localMeta[CATALOG_BACKUPS_META_KEY], remoteMeta[CATALOG_BACKUPS_META_KEY]);
    const deletedProductIdsRaw = normalizeDeletedIdList([
      ...(Array.isArray(localMeta.deletedProductIds) ? localMeta.deletedProductIds : []),
      ...(Array.isArray(remoteMeta.deletedProductIds) ? remoteMeta.deletedProductIds : [])
    ]);
    const deletedUserIdsRaw = normalizeDeletedIdList([
      ...(Array.isArray(localMeta.deletedUserIds) ? localMeta.deletedUserIds : []),
      ...(Array.isArray(remoteMeta.deletedUserIds) ? remoteMeta.deletedUserIds : [])
    ]);
    const deletedProductIds = sanitizeDeletedProductIds(deletedProductIdsRaw, localState, remoteState);
    const deletedUserIds = sanitizeDeletedUserIds(deletedUserIdsRaw, localState, remoteState);
    const allowRemoteOperationalInsert = !preferLocal;
    const mergedOpenComandasRaw = mergeComandasById(localState?.openComandas, remoteState?.openComandas, {
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    });
    const mergedClosedComandas = mergeComandasById(localState?.closedComandas, remoteState?.closedComandas, {
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    });
    const closedIds = new Set(mergedClosedComandas.map((comanda) => String(comanda?.id || "").trim()).filter(Boolean));
    const mergedOpenComandas = mergedOpenComandasRaw.filter((comanda) => !closedIds.has(String(comanda?.id || "").trim()));
    const mergedHistory90 = mergeRowsByIdWithTimestamp(localState?.history90, remoteState?.history90, {
      getTimestamp: (row) => row?.closedAt || row?.createdAt || row?.updatedAt || "",
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    }).sort((a, b) => new Date(b?.closedAt || b?.createdAt || 0) - new Date(a?.closedAt || a?.createdAt || 0));
    const mergedCookHistory = mergeRowsByIdWithTimestamp(localState?.cookHistory, remoteState?.cookHistory, {
      getTimestamp: (row) => row?.updatedAt || row?.deliveredAt || "",
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    });
    const mergedPayables = mergeRowsByIdWithTimestamp(localState?.payables, remoteState?.payables, {
      getTimestamp: (row) => row?.paidAt || row?.createdAt || "",
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    });
    const mergedCashHtmlReports = mergeRowsByIdWithTimestamp(localState?.cashHtmlReports, remoteState?.cashHtmlReports, {
      getTimestamp: (row) => row?.createdAt || row?.closedAt || "",
      preferLocal,
      allowRemoteOnly: allowRemoteOperationalInsert
    });
    const mergedAudit = mergeAuditRows(localState?.auditLog, remoteState?.auditLog);

    const merged = {
      ...(preferLocal ? remoteState : localState),
      ...(preferLocal ? localState : remoteState),
      users: mergedRowsById(localState?.users, remoteState?.users, deletedUserIds, {
        preferLocal,
        allowRemoteOnly: !preferLocal
      }),
      products: mergedRowsById(localState?.products, remoteState?.products, deletedProductIds, {
        preferLocal,
        allowRemoteOnly: !preferLocal
      }),
      openComandas: mergedOpenComandas,
      closedComandas: mergedClosedComandas,
      history90: mergedHistory90,
      cookHistory: mergedCookHistory,
      payables: mergedPayables,
      cashHtmlReports: mergedCashHtmlReports,
      auditLog: mergedAudit,
      meta: {
        ...(preferLocal ? remoteState?.meta || {} : localState?.meta || {}),
        ...(preferLocal ? localState?.meta || {} : remoteState?.meta || {}),
        [CATALOG_BACKUPS_META_KEY]: catalogBackups,
        deletedProductIds,
        deletedUserIds,
        operationalResetAt
      },
      cash: { ...(preferLocal ? remoteState?.cash || {} : localState?.cash || {}), ...(preferLocal ? localState?.cash || {} : remoteState?.cash || {}) }
    };
    applyOperationalResetCutoff(merged, operationalResetAt);
    merged.seq = merged.seq || {};
    const maxUserId = Math.max(0, ...(Array.isArray(merged.users) ? merged.users : []).map((u) => Number(u?.id || 0)));
    const maxProductId = Math.max(0, ...(Array.isArray(merged.products) ? merged.products : []).map((p) => Number(p?.id || 0)));
    merged.seq.user = Math.max(Number(merged.seq.user || 0), maxUserId + 1);
    merged.seq.product = Math.max(Number(merged.seq.product || 0), maxProductId + 1);
    return merged;
  }

  function trackDeletedEntity(metaKey, entityId) {
    const id = String(entityId ?? "").trim();
    if (!id) return;
    state.meta = state.meta || {};
    const current = normalizeDeletedIdList(state.meta[metaKey]);
    if (current.includes(id)) {
      state.meta[metaKey] = current;
      return;
    }
    current.push(id);
    state.meta[metaKey] = current.slice(-800);
  }

  function initialState() {
    return {
      users: [
        { id: 1, role: "admin", name: "Administrador", functionName: "Administrador", login: "admin", password: "admin", active: true }
      ],
      products: [],
      openComandas: [],
      closedComandas: [],
      cashHtmlReports: [],
      cookHistory: [],
      payables: [],
      auditLog: [],
      history90: [],
      cash: {
        id: "CX-1",
        openedAt: isoNow(),
        date: todayISO()
      },
      seq: {
        user: 2,
        product: 1,
        comanda: 1,
        item: 1,
        sale: 1,
        payable: 1,
        cash: 2,
        event: 1
      },
      meta: {
        updatedAt: isoNow(),
        lastCloudSyncAt: null,
        deletedProductIds: [],
        deletedUserIds: [],
        operationalResetAt: "",
        [FINAL_CLIENT_PREP_FLAG]: true,
        [FINAL_CLIENT_PREP_MARKER]: isoNow(),
        [FINAL_CLIENT_PREP_SIGNATURE_KEY]: FINAL_CLIENT_PREP_SIGNATURE
      },
      session: {
        userId: null
      }
    };
  }

  function pruneHistory(state) {
    const threshold = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    state.history90 = (state.history90 || []).filter((entry) => {
      const at = new Date(entry.closedAt || entry.createdAt || 0).getTime();
      return Number.isFinite(at) && at >= threshold;
    });
  }

  function prunePayables(state) {
    const threshold = Date.now() - PAYABLES_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    state.payables = (state.payables || []).filter((entry) => {
      const referenceAt = new Date(entry.paidAt || entry.createdAt || 0).getTime();
      if (!Number.isFinite(referenceAt)) return true;
      return referenceAt >= threshold;
    });
  }

  function normalizeCashHtmlReportRecord(entry, fallbackId = 0) {
    const parsed = entry && typeof entry === "object" ? entry : {};
    const createdAt = typeof parsed.createdAt === "string" && parsed.createdAt ? parsed.createdAt : isoNow();
    const closedAt = typeof parsed.closedAt === "string" && parsed.closedAt ? parsed.closedAt : createdAt;
    const openedAt = typeof parsed.openedAt === "string" ? parsed.openedAt : "";
    const referenceDayRaw =
      typeof parsed.referenceDay === "string" && parsed.referenceDay
        ? parsed.referenceDay
        : String(openedAt || closedAt || createdAt).slice(0, 10);
    return {
      id: String(parsed.id || `CHR-${fallbackId + 1}`),
      cashClosureId: String(parsed.cashClosureId || ""),
      cashId: String(parsed.cashId || ""),
      openedAt,
      closedAt,
      referenceDay: String(referenceDayRaw || "").slice(0, 10),
      createdAt,
      createdById: parsed.createdById ?? null,
      createdByName: String(parsed.createdByName || ""),
      createdByRole: String(parsed.createdByRole || ""),
      title: String(parsed.title || ""),
      subtitle: String(parsed.subtitle || ""),
      html: String(parsed.html || "")
    };
  }

  function pruneCashHtmlReports(state) {
    const threshold = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const normalized = (state.cashHtmlReports || [])
      .map((entry, idx) => normalizeCashHtmlReportRecord(entry, idx))
      .filter((entry) => {
        if (!String(entry.html || "").trim()) return false;
        const referenceAt = new Date(entry.closedAt || entry.createdAt || 0).getTime();
        if (!Number.isFinite(referenceAt)) return true;
        return referenceAt >= threshold;
      })
      .sort((a, b) => new Date(b.closedAt || b.createdAt || 0) - new Date(a.closedAt || a.createdAt || 0));
    state.cashHtmlReports = normalized.slice(0, CASH_HTML_REPORTS_LIMIT);
  }

  function hasSystemTestMarker(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return false;
    return SYSTEM_TEST_MARKERS.some((marker) => text.includes(marker));
  }

  function isSystemGeneratedCodeWaiter(user) {
    if (!user || user.role !== "waiter") return false;
    const name = String(user.name || "").trim();
    const login = String(user.login || "").trim().toLowerCase();
    return name.startsWith(`${ACCESS_CODE_WAITER_PREFIX} `) && login.startsWith("garcom_");
  }

  function isKnownSystemTestUser(user) {
    if (!user) return false;
    const role = String(user.role || "").trim().toLowerCase();
    const name = String(user.name || "").trim().toLowerCase();
    const login = String(user.login || "").trim().toLowerCase();
    if (isSystemGeneratedCodeWaiter(user)) return true;
    if (role === "waiter" && name === "garcom teste" && login === "user") return true;
    if (role === "cook" && name === "cozinheiro teste" && login === "cook") return true;
    if (role === "admin" && name === "owner admin" && login === "owner") return true;
    return false;
  }

  function isSystemTestAuditEntry(entry) {
    if (!entry) return false;
    const detail = String(entry.detail || "");
    const actorName = String(entry.actorName || "");
    const type = String(entry.type || "");
    if (hasSystemTestMarker(detail) || hasSystemTestMarker(actorName)) return true;
    if (type === "funcionario_add" && detail.includes("criado automaticamente via codigo 2222")) return true;
    return false;
  }

  function purgeSystemTestArtifacts(targetState) {
    if (!targetState || typeof targetState !== "object") return false;
    let changed = false;
    targetState.users = Array.isArray(targetState.users) ? targetState.users : [];
    targetState.openComandas = Array.isArray(targetState.openComandas) ? targetState.openComandas : [];
    targetState.closedComandas = Array.isArray(targetState.closedComandas) ? targetState.closedComandas : [];
    targetState.history90 = Array.isArray(targetState.history90) ? targetState.history90 : [];
    targetState.auditLog = Array.isArray(targetState.auditLog) ? targetState.auditLog : [];
    targetState.payables = Array.isArray(targetState.payables) ? targetState.payables : [];
    targetState.cookHistory = Array.isArray(targetState.cookHistory) ? targetState.cookHistory : [];
    targetState.cashHtmlReports = Array.isArray(targetState.cashHtmlReports) ? targetState.cashHtmlReports : [];
    targetState.meta = targetState.meta || {};

    const removedUserIds = new Set();
    const keptUsers = [];
    for (const user of targetState.users) {
      if (isKnownSystemTestUser(user)) {
        removedUserIds.add(String(user.id || ""));
        changed = true;
        continue;
      }
      keptUsers.push(user);
    }
    targetState.users = keptUsers;

    const shouldDropComanda = (comanda) => {
      if (!comanda || typeof comanda !== "object") return true;
      if (removedUserIds.has(String(comanda.createdBy || ""))) return true;
      if (hasSystemTestMarker(comanda.table) || hasSystemTestMarker(comanda.customer)) return true;
      const hasTestEvents = (comanda.events || []).some(
        (event) => removedUserIds.has(String(event?.actorId || "")) || isSystemTestAuditEntry(event)
      );
      if (hasTestEvents) return true;
      const hasTestItems = (comanda.items || []).some(
        (item) => hasSystemTestMarker(item?.name) || hasSystemTestMarker(item?.waiterNote)
      );
      return hasTestItems;
    };

    const sanitizeComandaEvents = (comanda) => {
      const original = Array.isArray(comanda.events) ? comanda.events : [];
      const filtered = original.filter(
        (event) => !removedUserIds.has(String(event?.actorId || "")) && !isSystemTestAuditEntry(event)
      );
      if (filtered.length !== original.length) {
        comanda.events = filtered;
        changed = true;
      }
    };

    const keepOpen = [];
    for (const comanda of targetState.openComandas) {
      if (shouldDropComanda(comanda)) {
        changed = true;
        continue;
      }
      sanitizeComandaEvents(comanda);
      keepOpen.push(comanda);
    }
    targetState.openComandas = keepOpen;

    const keepClosed = [];
    for (const comanda of targetState.closedComandas) {
      if (shouldDropComanda(comanda)) {
        changed = true;
        continue;
      }
      sanitizeComandaEvents(comanda);
      keepClosed.push(comanda);
    }
    targetState.closedComandas = keepClosed;

    const keepHistory = [];
    for (const closure of targetState.history90) {
      const copy = { ...closure };
      const closureComandas = Array.isArray(copy.commandas) ? copy.commandas : [];
      const keptClosureComandas = [];
      for (const comanda of closureComandas) {
        if (shouldDropComanda(comanda)) {
          changed = true;
          continue;
        }
        sanitizeComandaEvents(comanda);
        keptClosureComandas.push(comanda);
      }
      copy.commandas = keptClosureComandas;
      const closureAudit = Array.isArray(copy.auditLog) ? copy.auditLog : [];
      const filteredClosureAudit = closureAudit.filter(
        (event) =>
          !removedUserIds.has(String(event?.actorId || "")) &&
          !isSystemTestAuditEntry(event) &&
          (!event?.comandaId || keptClosureComandas.some((comanda) => String(comanda.id || "") === String(event.comandaId || "")))
      );
      if (filteredClosureAudit.length !== closureAudit.length) {
        copy.auditLog = filteredClosureAudit;
        changed = true;
      }
      if (copy.commandas.length || (copy.auditLog || []).length) {
        keepHistory.push(copy);
      } else {
        changed = true;
      }
    }
    targetState.history90 = keepHistory;

    const allComandaIds = new Set(
      [
        ...targetState.openComandas.map((comanda) => String(comanda.id || "")),
        ...targetState.closedComandas.map((comanda) => String(comanda.id || "")),
        ...targetState.history90.flatMap((closure) => (closure.commandas || []).map((comanda) => String(comanda.id || "")))
      ].filter(Boolean)
    );

    const originalAudit = targetState.auditLog;
    targetState.auditLog = originalAudit.filter(
      (entry) =>
        !removedUserIds.has(String(entry?.actorId || "")) &&
        !isSystemTestAuditEntry(entry) &&
        (!entry?.comandaId || allComandaIds.has(String(entry.comandaId || "")))
    );
    if (targetState.auditLog.length !== originalAudit.length) changed = true;

    const originalPayables = targetState.payables;
    targetState.payables = originalPayables.filter(
      (entry) => allComandaIds.has(String(entry?.comandaId || "")) && !hasSystemTestMarker(entry?.customerName)
    );
    if (targetState.payables.length !== originalPayables.length) changed = true;

    const originalCookHistory = targetState.cookHistory;
    targetState.cookHistory = originalCookHistory.filter(
      (entry) => allComandaIds.has(String(entry?.comandaId || "")) && !removedUserIds.has(String(entry?.cookId || ""))
    );
    if (targetState.cookHistory.length !== originalCookHistory.length) changed = true;

    const originalCashHtml = targetState.cashHtmlReports;
    targetState.cashHtmlReports = originalCashHtml.filter(
      (entry) => !hasSystemTestMarker(entry?.title) && !hasSystemTestMarker(entry?.subtitle)
    );
    if (targetState.cashHtmlReports.length !== originalCashHtml.length) changed = true;

    if (removedUserIds.size) {
      const deletedIds = normalizeDeletedIdList([...(targetState.meta.deletedUserIds || []), ...removedUserIds]);
      targetState.meta.deletedUserIds = deletedIds;
    }

    return changed;
  }

  function ensureSystemUsers(targetState) {
    targetState.users = Array.isArray(targetState.users) ? targetState.users : [];
    const hasActiveAdmin = targetState.users.some((u) => u?.role === "admin" && u?.active !== false);
    if (hasActiveAdmin) return;

    const existingLogins = new Set(
      targetState.users
        .map((u) => String(u?.login || "").trim())
        .filter(Boolean)
    );
    let nextLogin = "admin";
    let suffix = 2;
    while (existingLogins.has(nextLogin)) {
      nextLogin = `admin${suffix++}`;
    }

    targetState.seq = targetState.seq || {};
    const fallbackId = Math.max(0, ...targetState.users.map((u) => Number(u?.id || 0))) + 1;
    const nextUserId = Number.isInteger(Number(targetState.seq.user)) && Number(targetState.seq.user) > 0 ? Number(targetState.seq.user) : fallbackId;
    targetState.users.push({
      id: nextUserId,
      role: "admin",
      name: "Administrador",
      functionName: "Administrador",
      login: nextLogin,
      password: "admin",
      active: true
    });
    targetState.seq.user = Math.max(Number(targetState.seq.user || 0), nextUserId + 1);
  }

  function applyFinalClientPreparation(targetState) {
    targetState.meta = targetState.meta || {};
    ensureSystemUsers(targetState);
    targetState.meta[FINAL_CLIENT_PREP_FLAG] = true;
    if (!targetState.meta[FINAL_CLIENT_PREP_MARKER]) {
      targetState.meta[FINAL_CLIENT_PREP_MARKER] = isoNow();
    }
    targetState.meta[FINAL_CLIENT_PREP_SIGNATURE_KEY] = FINAL_CLIENT_PREP_SIGNATURE;
  }

  function findLatestBackupWaiterByName(targetState, waiterName) {
    const backups = normalizeCatalogBackups(targetState?.meta?.[CATALOG_BACKUPS_META_KEY]);
    if (!backups.length) return null;
    const target = String(waiterName || "").trim().toLowerCase();
    if (!target) return null;
    const ordered = [...backups].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    for (const backup of ordered) {
      const waiter = (backup.users || []).find(
        (user) => user?.role === "waiter" && String(user?.name || "").trim().toLowerCase() === target
      );
      if (waiter) return waiter;
    }
    return null;
  }

  function applyEduardoCredentialRecovery(targetState) {
    if (!targetState || typeof targetState !== "object") return false;
    targetState.meta = targetState.meta || {};
    if (targetState.meta[EDUARDO_RECOVERY_MARKER_KEY]) return false;
    targetState.users = Array.isArray(targetState.users) ? targetState.users : [];

    const backupWaiter = findLatestBackupWaiterByName(targetState, "Eduardo");
    if (!backupWaiter) return false;

    const backupId = String(backupWaiter.id || "").trim();
    let targetUser =
      targetState.users.find((user) => String(user?.id || "").trim() === backupId) ||
      targetState.users.find((user) => user?.role === "waiter" && String(user?.name || "").trim().toLowerCase() === "orion");

    if (!targetUser) {
      const maxId = Math.max(0, ...targetState.users.map((user) => Number(user?.id || 0)));
      const nextId = Math.max(maxId + 1, Number(targetState.seq?.user || 0) || 0);
      targetUser = {
        id: nextId,
        role: "waiter",
        name: String(backupWaiter.name || "Eduardo"),
        functionName: String(backupWaiter.functionName || "Garcom"),
        login: String(backupWaiter.login || "eduardo"),
        password: String(backupWaiter.password || ""),
        active: backupWaiter.active !== false
      };
      targetState.users.push(targetUser);
      targetState.seq = targetState.seq || {};
      targetState.seq.user = Math.max(Number(targetState.seq.user || 0), nextId + 1);
      targetState.meta[EDUARDO_RECOVERY_MARKER_KEY] = isoNow();
      return true;
    }

    const loginFromBackup = String(backupWaiter.login || "").trim();
    const loginInUseByOther = targetState.users.some(
      (user) => user !== targetUser && String(user?.login || "").trim() === loginFromBackup
    );

    targetUser.role = "waiter";
    targetUser.name = String(backupWaiter.name || targetUser.name || "Eduardo");
    targetUser.functionName = String(backupWaiter.functionName || targetUser.functionName || "Garcom");
    if (loginFromBackup && !loginInUseByOther) {
      targetUser.login = loginFromBackup;
    }
    if (backupWaiter.password !== undefined && backupWaiter.password !== null && String(backupWaiter.password) !== "") {
      targetUser.password = String(backupWaiter.password);
    }
    targetUser.active = backupWaiter.active !== false;
    targetState.meta[EDUARDO_RECOVERY_MARKER_KEY] = isoNow();
    return true;
  }

  function isDoseCopoSubcategory(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    const flat = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return flat === "doses" || flat === "dose" || flat === "doses/copo" || flat === "dose/copo" || flat === "copo";
  }

  function normalizeCategoryName(category) {
    const raw = String(category || "").trim();
    if (!raw) return "Avulso";
    const flat = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (flat === "doses" || flat === "dose" || flat === "doses/copo" || flat === "dose/copo" || flat === "copo") return "Dose/Copo";
    if (flat === "bar" || flat === "bebida" || flat === "bebidas") return "Bar";
    if (flat === "cozinha") return "Cozinha";
    if (flat === "espetinho" || flat === "espetinhos" || flat === "espertinho" || flat === "espertinhos") return "Espetinhos";
    if (flat === "avulso" || flat === "avulsos" || flat === "variedades" || flat === "variados") return "Avulso";
    if (flat === "oferta" || flat === "ofertas") return "Ofertas";
    return "Avulso";
  }

  function normalizeProductCategory(category) {
    return normalizeCategoryName(category);
  }

  function normalizeProductSubcategory(product) {
    if (product.category !== "Bar") return "";
    const raw = String(product.subcategory || "").trim();
    return BAR_SUBCATEGORIES.includes(raw) ? raw : "Geral";
  }

  function normalizeComandaItem(item, fallbackId = 0) {
    const category = normalizeCategoryName(item.category);
    const requiresKitchen = category === "Cozinha" ? true : category === "Ofertas" ? Boolean(item.requiresKitchen) : false;
    const needsKitchen = item.needsKitchen !== undefined ? Boolean(item.needsKitchen) : requiresKitchen;
    const kitchenPriority = needsKitchen ? String(item.kitchenPriority || "normal") : "";
    const rawVisualState =
      item.waiterVisualState === "new" || item.waiterVisualState === "ready" || item.waiterVisualState === "seen"
        ? item.waiterVisualState
        : item.kitchenStatus === "entregue" && item.kitchenAlertUnread
          ? "ready"
          : "";
    const visualState = rawVisualState === "ready" && !item.kitchenAlertUnread ? "seen" : rawVisualState;
    return {
      ...item,
      id: item.id || `IT-NORM-${fallbackId}`,
      category,
      requiresKitchen,
      needsKitchen,
      kitchenPriority: needsKitchen && ["normal", "comum", "alta", "maxima"].includes(kitchenPriority) ? kitchenPriority : needsKitchen ? "normal" : "",
      kitchenPriorityById: item.kitchenPriorityById || null,
      kitchenPriorityByName: item.kitchenPriorityByName || "",
      kitchenPriorityAt: item.kitchenPriorityAt || null,
      kitchenReceivedAt: item.kitchenReceivedAt || null,
      kitchenReceivedById: item.kitchenReceivedById || null,
      kitchenReceivedByName: item.kitchenReceivedByName || "",
      kitchenAlertUnread: Boolean(item.kitchenAlertUnread),
      waiterVisualState: visualState,
      waiterVisualUpdatedAt: item.waiterVisualUpdatedAt || null
    };
  }

  function normalizeComandaRecord(comanda, fallbackId = 0) {
    const items = Array.isArray(comanda.items) ? comanda.items.map((item, idx) => normalizeComandaItem(item || {}, idx + 1)) : [];
    const hasKitchenUnread = items.some((item) => itemNeedsKitchen(item) && item.kitchenAlertUnread && !item.canceled);
    return {
      ...comanda,
      id: comanda.id || `CMD-NORM-${fallbackId + 1}`,
      table: comanda.table || "-",
      items,
      kitchenAlertUnread: hasKitchenUnread
    };
  }

  function normalizeProductRecord(product, fallbackId = 0) {
    const normalizedCategory = normalizeProductCategory(product.category);
    const effectiveCategory = normalizedCategory === "Bar" && isDoseCopoSubcategory(product.subcategory) ? "Dose/Copo" : normalizedCategory;
    const normalized = {
      ...product,
      id: Number(product.id || fallbackId),
      category: effectiveCategory
    };
    normalized.subcategory = normalizeProductSubcategory(normalized);
    normalized.available = product.available !== false;
    normalized.requiresKitchen =
      effectiveCategory === "Cozinha" ? true : effectiveCategory === "Ofertas" ? Boolean(product.requiresKitchen) : false;
    return normalized;
  }

  function normalizeStateShape(source) {
    const parsed = source && typeof source === "object" ? source : {};
    const fallback = initialState();
    const deletedProductIdsRaw = normalizeDeletedIdList(parsed.meta?.deletedProductIds);
    const deletedUserIdsRaw = normalizeDeletedIdList(parsed.meta?.deletedUserIds);
    const normalized = {
      ...fallback,
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : fallback.users,
      products: Array.isArray(parsed.products)
        ? parsed.products.map((p, idx) => normalizeProductRecord(p || {}, idx + 1))
        : fallback.products.map((p) => normalizeProductRecord(p || {}, p.id)),
      openComandas: Array.isArray(parsed.openComandas) ? parsed.openComandas.map((c, idx) => normalizeComandaRecord(c || {}, idx)) : [],
      closedComandas: Array.isArray(parsed.closedComandas) ? parsed.closedComandas.map((c, idx) => normalizeComandaRecord(c || {}, idx)) : [],
      cashHtmlReports: Array.isArray(parsed.cashHtmlReports)
        ? parsed.cashHtmlReports.map((entry, idx) => normalizeCashHtmlReportRecord(entry, idx))
        : [],
      cookHistory: Array.isArray(parsed.cookHistory) ? parsed.cookHistory : [],
      payables: Array.isArray(parsed.payables) ? parsed.payables : [],
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
      history90: Array.isArray(parsed.history90)
        ? parsed.history90.map((entry) => ({
          ...entry,
          commandas: Array.isArray(entry.commandas) ? entry.commandas.map((c, idx) => normalizeComandaRecord(c || {}, idx)) : []
        }))
        : [],
      seq: { ...fallback.seq, ...(parsed.seq || {}) },
      meta: {
        ...fallback.meta,
        ...(parsed.meta || {}),
        [CATALOG_BACKUPS_META_KEY]: normalizeCatalogBackups(parsed.meta?.[CATALOG_BACKUPS_META_KEY]),
        deletedProductIds: deletedProductIdsRaw,
        deletedUserIds: deletedUserIdsRaw,
        operationalResetAt: normalizeOperationalResetAt(parsed.meta?.operationalResetAt),
        [FINAL_CLIENT_PREP_FLAG]: parsed.meta?.[FINAL_CLIENT_PREP_FLAG] === true,
        [FINAL_CLIENT_PREP_MARKER]:
          typeof parsed.meta?.[FINAL_CLIENT_PREP_MARKER] === "string" && parsed.meta?.[FINAL_CLIENT_PREP_MARKER]
            ? parsed.meta[FINAL_CLIENT_PREP_MARKER]
            : "",
        [FINAL_CLIENT_PREP_SIGNATURE_KEY]:
          typeof parsed.meta?.[FINAL_CLIENT_PREP_SIGNATURE_KEY] === "string" && parsed.meta?.[FINAL_CLIENT_PREP_SIGNATURE_KEY]
            ? parsed.meta[FINAL_CLIENT_PREP_SIGNATURE_KEY]
            : ""
      },
      cash: { ...fallback.cash, ...(parsed.cash || {}) },
      session: { userId: parsed.session?.userId || null }
    };
    normalized.meta.deletedUserIds = sanitizeDeletedUserIds(normalized.meta.deletedUserIds, normalized);
    normalized.meta.deletedProductIds = sanitizeDeletedProductIds(normalized.meta.deletedProductIds, normalized);

    ensureSystemUsers(normalized);
    const recovered = applyCatalogBackupRecovery(normalized);
    recovered.seq = recovered.seq || normalized.seq || {};
    recovered.meta = recovered.meta || {};
    recovered.meta.deletedUserIds = sanitizeDeletedUserIds(recovered.meta.deletedUserIds, normalized, recovered);
    recovered.meta.deletedProductIds = sanitizeDeletedProductIds(recovered.meta.deletedProductIds, normalized, recovered);
    applyEduardoCredentialRecovery(recovered);
    purgeSystemTestArtifacts(recovered);
    applyFinalClientPreparation(recovered);
    applyOperationalResetCutoff(recovered, recovered.meta?.operationalResetAt);
    ensureCatalogBackup(recovered, "normalize");
    pruneHistory(recovered);
    prunePayables(recovered);
    pruneCashHtmlReports(recovered);
    return recovered;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const first = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
      return first;
    }

    try {
      const merged = normalizeStateShape(JSON.parse(raw));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch (_err) {
      const clean = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      return clean;
    }
  }

  function parseSessionIdentity(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    if (value === DEV_SESSION_ID) return DEV_SESSION_ID;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function loadSessionUserId(fallbackUserId = null) {
    const tabSession = parseSessionIdentity(sessionStorage.getItem(SESSION_TAB_KEY));
    if (tabSession) {
      return tabSession;
    }

    const persistentSession = parseSessionIdentity(localStorage.getItem(SESSION_KEY));
    if (persistentSession) {
      sessionStorage.setItem(SESSION_TAB_KEY, String(persistentSession));
      return persistentSession;
    }

    const fallbackSession = parseSessionIdentity(fallbackUserId);
    if (fallbackSession) {
      sessionStorage.setItem(SESSION_TAB_KEY, String(fallbackSession));
      return fallbackSession;
    }
    return null;
  }

  function persistSessionUserId(userId, rememberLogin = false) {
    const parsed = parseSessionIdentity(userId);
    if (parsed) {
      sessionStorage.setItem(SESSION_TAB_KEY, String(parsed));
      if (rememberLogin) {
        localStorage.setItem(SESSION_KEY, String(parsed));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
      return;
    }
    sessionStorage.removeItem(SESSION_TAB_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  function normalizePrinterPrefs(source) {
    const parsed = source && typeof source === "object" ? source : {};
    return {
      kitchenDirectEnabled: parsed.kitchenDirectEnabled === true,
      kitchenPrinterName: String(parsed.kitchenPrinterName || "").trim()
    };
  }

  function loadPrinterPrefs() {
    const raw = localStorage.getItem(PRINTER_PREFS_KEY);
    if (!raw) return normalizePrinterPrefs(null);
    try {
      return normalizePrinterPrefs(JSON.parse(raw));
    } catch (_err) {
      return normalizePrinterPrefs(null);
    }
  }

  function persistPrinterPrefs() {
    localStorage.setItem(PRINTER_PREFS_KEY, JSON.stringify(normalizePrinterPrefs(uiState.printerPrefs)));
  }

  function sanitizeStateForCloud(source) {
    try {
      const cloned = JSON.parse(JSON.stringify(source));
      cloned.session = { userId: null };
      return cloned;
    } catch (_err) {
      const fallback = { ...source, session: { userId: null } };
      return fallback;
    }
  }

  let state = loadState();
  let sessionUserId = loadSessionUserId(null);
  state.session = { userId: null };
  const sessionUserExists =
    sessionUserId === DEV_SESSION_ID ||
    state.users.some((u) => u.id === sessionUserId && u.active !== false);
  if (sessionUserId && !sessionUserExists) {
    sessionUserId = null;
    persistSessionUserId(null);
  }
  const supabaseCtx = {
    client: null,
    channel: null,
    connected: false,
    syncTimer: null,
    syncInFlight: false,
    syncQueued: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
    syncRetryCount: 0,
    pullDebounceTimer: null,
    lastSyncErrorAt: null,
    lastSyncError: ""
  };

  function adoptIncomingState(source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return;
    }
    try {
      const currentSession = sessionUserId;
      state = normalizeStateShape(source);
      state.session = { userId: null };
      sessionUserId = currentSession;
    } catch (err) {
      console.error("[adoptIncomingState] Falha ao normalizar estado recebido:", err);
    }
  }

  function saveState(options = {}) {
    const touchMeta = options.touchMeta !== false;
    state.meta = state.meta || {};
    ensureCatalogBackup(state, "save");
    if (touchMeta) {
      state.meta.updatedAt = isoNow();
    }
    state.session = { userId: null };
    pruneHistory(state);
    prunePayables(state);
    pruneCashHtmlReports(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (storageErr) {
      console.warn("[saveState] localStorage cheio, tentando pruning agressivo...", storageErr);
      try {
        state.auditLog = (state.auditLog || []).slice(0, 500);
        state.history90 = (state.history90 || []).slice(0, 30);
        state.cookHistory = (state.cookHistory || []).slice(0, 200);
        state.cashHtmlReports = (state.cashHtmlReports || []).slice(0, 30);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (retryErr) {
        console.error("[saveState] Falha ao salvar mesmo apos pruning:", retryErr);
      }
    }
    if (!options.skipCloud) {
      scheduleSupabaseSync();
    }
  }

  // Limpa qualquer sessao antiga dentro do estado compartilhado.
  saveState({ skipCloud: true, touchMeta: false });

  function setSupabaseStatus(status, errorMessage = "") {
    uiState.supabaseStatus = status;
    uiState.supabaseLastError = errorMessage;
  }

  function getSupabaseClient() {
    if (supabaseCtx.client) {
      return supabaseCtx.client;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setSupabaseStatus("indisponivel", "Biblioteca Supabase nao carregada.");
      return null;
    }
    supabaseCtx.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          "x-project-id": SUPABASE_PROJECT_ID,
          "x-publishable-key": SUPABASE_PUBLISHABLE_KEY
        }
      }
    });
    return supabaseCtx.client;
  }

  function scheduleSupabaseSync() {
    supabaseCtx.syncQueued = true;
    if (supabaseCtx.syncTimer) {
      clearTimeout(supabaseCtx.syncTimer);
    }
    supabaseCtx.syncTimer = setTimeout(() => {
      supabaseCtx.syncTimer = null;
      void syncStateToSupabase();
    }, 400);
  }

  function clearSupabaseReconnectTimer() {
    if (!supabaseCtx.reconnectTimer) return;
    clearTimeout(supabaseCtx.reconnectTimer);
    supabaseCtx.reconnectTimer = null;
  }

  function scheduleSupabaseReconnect(delayMs = 2000) {
    if (supabaseCtx.reconnectTimer) return;
    supabaseCtx.reconnectTimer = setTimeout(() => {
      supabaseCtx.reconnectTimer = null;
      void connectSupabase();
    }, Math.max(1000, Number(delayMs || 2000)));
  }

  async function syncStateToSupabase() {
    const client = getSupabaseClient();
    if (!client) return;
    if (supabaseCtx.syncInFlight) {
      supabaseCtx.syncQueued = true;
      return;
    }
    if (!supabaseCtx.syncQueued) return;

    supabaseCtx.syncInFlight = true;
    supabaseCtx.syncQueued = false;
    ensureCatalogBackup(state, "sync");
    const sanitized = sanitizeStateForCloud(state);
    try {
      let mergedForCloud = sanitized;
      const { data: remoteData, error: remoteErr } = await client
        .from("restobar_state")
        .select("payload,updated_at")
        .eq("id", "main")
        .maybeSingle();
      if (!remoteErr && remoteData?.payload && typeof remoteData.payload === "object") {
        mergedForCloud = mergeStateForCloud(sanitized, remoteData.payload);
      }
      mergedForCloud = applyCatalogBackupRecovery(mergedForCloud, sanitized, remoteData?.payload || null);
      ensureCatalogBackup(mergedForCloud, "sync");

      const payload = {
        id: "main",
        updated_at: isoNow(),
        payload: mergedForCloud
      };
      const { error } = await client.from("restobar_state").upsert(payload);
      if (error) {
        throw error;
      }
      adoptIncomingState(mergedForCloud);
      state.meta.lastCloudSyncAt = isoNow();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (_lsErr) { }
      supabaseCtx.syncRetryCount = 0;
      supabaseCtx.lastSyncError = "";
      supabaseCtx.lastSyncErrorAt = null;
      setSupabaseStatus("conectado");
    } catch (err) {
      supabaseCtx.syncQueued = true;
      supabaseCtx.syncRetryCount = Math.min(supabaseCtx.syncRetryCount + 1, 8);
      supabaseCtx.lastSyncError = String(err?.message || err || "Falha ao sincronizar.");
      supabaseCtx.lastSyncErrorAt = isoNow();
      setSupabaseStatus("aviso", supabaseCtx.lastSyncError);
    } finally {
      supabaseCtx.syncInFlight = false;
      if (supabaseCtx.syncQueued) {
        if (supabaseCtx.syncTimer) {
          clearTimeout(supabaseCtx.syncTimer);
        }
        const retryDelay = Math.min(120 * Math.pow(2, supabaseCtx.syncRetryCount), 8000);
        supabaseCtx.syncTimer = setTimeout(() => {
          supabaseCtx.syncTimer = null;
          void syncStateToSupabase();
        }, retryDelay);
      }
    }
  }

  async function pullStateFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data, error } = await client.from("restobar_state").select("payload,updated_at").eq("id", "main").maybeSingle();
      if (error || !data?.payload) return;
      if (typeof data.payload !== "object" || Array.isArray(data.payload)) {
        console.warn("[pullStateFromSupabase] Payload remoto invalido, ignorando.");
        return;
      }

      const localUpdated = parseUpdatedAtTimestamp(state.meta?.updatedAt);
      const remoteMetaUpdated = parseUpdatedAtTimestamp(data.payload?.meta?.updatedAt);
      const remoteUpdated = remoteMetaUpdated || (!localUpdated ? parseUpdatedAtTimestamp(data.updated_at) : 0);
      if (Number.isFinite(remoteUpdated) && remoteUpdated > localUpdated) {
        if (shouldForceRemotePreference(data.payload, state)) {
          setSupabaseStatus("aviso", "Pull remoto ignorado para evitar sobrescrita destrutiva do historico local.");
          return;
        }
        const incomingMerged = mergeStateForCloud(data.payload, state);
        const incomingRecovered = applyCatalogBackupRecovery(incomingMerged, state, data.payload);
        ensureCatalogBackup(incomingRecovered, "pull");
        adoptIncomingState(incomingRecovered);
        state.meta.lastCloudSyncAt = isoNow();
        saveState({ skipCloud: true, touchMeta: false });
        render();
      }
      setSupabaseStatus("conectado");
    } catch (err) {
      setSupabaseStatus("aviso", String(err?.message || err || "Falha ao ler cloud."));
    }
  }

  function pushRemoteMonitorEvent(payload) {
    uiState.remoteMonitorEvents.unshift(payload);
    if (uiState.remoteMonitorEvents.length > 300) {
      uiState.remoteMonitorEvents = uiState.remoteMonitorEvents.slice(0, 300);
    }
  }

  function pruneDevicePresence() {
    const cutoff = Date.now() - DEVICE_PRESENCE_TTL_MS;
    for (const [sessionId, row] of Object.entries(uiState.devicePresenceBySession || {})) {
      const ts = new Date(row?.seenAt || 0).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) {
        delete uiState.devicePresenceBySession[sessionId];
      }
    }
  }

  function upsertDevicePresence(payload, options = {}) {
    const sessionId = String(payload?.sessionId || "").trim();
    if (!sessionId) return;
    uiState.devicePresenceBySession[sessionId] = {
      ...payload,
      sessionId,
      seenAt: payload?.seenAt || isoNow(),
      isSelf: options.isSelf === true
    };
    pruneDevicePresence();
  }

  function listDevicePresenceRows() {
    pruneDevicePresence();
    return Object.values(uiState.devicePresenceBySession || {}).sort(
      (a, b) => new Date(b?.seenAt || 0) - new Date(a?.seenAt || 0)
    );
  }

  function buildPresencePayload() {
    const user = getCurrentUser();
    const ua = String(navigator.userAgent || "");
    return {
      sessionId: clientSessionId,
      seenAt: isoNow(),
      role: user?.role || "guest",
      userName: user?.name || "Nao autenticado",
      userId: user?.id || null,
      browser: browserNameFromUa(ua),
      deviceType: deviceTypeFromUa(ua),
      platform: String(navigator.platform || "-"),
      language: String(navigator.language || "-"),
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      path: String(window.location.pathname || "/")
    };
  }

  function broadcastPresencePing() {
    const payload = buildPresencePayload();
    upsertDevicePresence(payload, { isSelf: true });
    if (supabaseCtx.channel) {
      supabaseCtx.channel.send({ type: "broadcast", event: "presence_ping", payload }).catch(() => { });
    }
  }

  function publishSupabaseEvent(entry) {
    if (!supabaseCtx.channel) return;
    const payload = {
      ...entry,
      broadcastAt: isoNow()
    };
    supabaseCtx.channel.send({ type: "broadcast", event: "audit_event", payload }).catch(() => { });
    supabaseCtx.channel.send({
      type: "broadcast",
      event: "state_changed",
      payload: { updatedAt: state.meta?.updatedAt || isoNow(), actorName: entry.actorName }
    }).catch(() => { });
  }

  function debouncedPullFromSupabase() {
    if (supabaseCtx.pullDebounceTimer) {
      clearTimeout(supabaseCtx.pullDebounceTimer);
    }
    supabaseCtx.pullDebounceTimer = setTimeout(() => {
      supabaseCtx.pullDebounceTimer = null;
      void pullStateFromSupabase();
    }, 500);
  }

  async function connectSupabase() {
    const client = getSupabaseClient();
    if (!client) return;

    clearSupabaseReconnectTimer();
    setSupabaseStatus("conectando");
    if (supabaseCtx.channel) {
      try {
        client.removeChannel(supabaseCtx.channel);
      } catch (_err) {
        try {
          await supabaseCtx.channel.unsubscribe();
        } catch (_err2) { }
      }
      supabaseCtx.channel = null;
    }

    const channel = client.channel("restobar-live", { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "audit_event" }, (message) => {
        if (message?.payload) {
          pushRemoteMonitorEvent(message.payload);
          const user = getCurrentUser();
          if (
            (user?.role === "admin" && (uiState.adminTab === "monitor" || uiState.adminTab === "dashboard")) ||
            (user?.role === "dev" && (uiState.devTab === "monitor" || uiState.devTab === "dashboard"))
          ) {
            render();
          }
        }
      })
      .on("broadcast", { event: "presence_ping" }, (message) => {
        if (!message?.payload) return;
        upsertDevicePresence(message.payload);
        const user = getCurrentUser();
        if (user?.role === "dev" && uiState.devTab === "devices") {
          render();
        }
      })
      .on("broadcast", { event: "state_changed" }, () => {
        debouncedPullFromSupabase();
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        supabaseCtx.connected = true;
        supabaseCtx.reconnectAttempts = 0;
        clearSupabaseReconnectTimer();
        setSupabaseStatus("conectado");
        broadcastPresencePing();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        supabaseCtx.connected = false;
        supabaseCtx.reconnectAttempts = Math.min(supabaseCtx.reconnectAttempts + 1, 6);
        scheduleSupabaseReconnect(1000 * 2 ** (supabaseCtx.reconnectAttempts - 1));
        setSupabaseStatus("aviso", `Realtime: ${status}`);
      }
    });

    supabaseCtx.channel = channel;
    await pullStateFromSupabase();
    scheduleSupabaseSync();
  }

  function getCurrentUser() {
    if (sessionUserId === DEV_SESSION_ID) {
      return DEV_SHADOW_USER;
    }
    return state.users.find((u) => u.id === sessionUserId) || null;
  }

  function findFirstActiveUserByRole(role) {
    const rows = state.users
      .filter((u) => u.active && u.role === role)
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    return rows[0] || null;
  }

  function createWaiterFromRoleAccessCode() {
    state.users = Array.isArray(state.users) ? state.users : [];
    state.seq = state.seq || {};
    const maxId = Math.max(0, ...state.users.map((user) => Number(user?.id || 0)));
    const nextId = Math.max(maxId + 1, Number(state.seq.user || 0) || 0);
    const serial = String(nextId).padStart(3, "0");
    let loginBase = `garcom_${serial}`;
    let loginValue = loginBase;
    let suffix = 2;
    const existingLogins = new Set(state.users.map((user) => String(user?.login || "").trim().toLowerCase()).filter(Boolean));
    while (existingLogins.has(loginValue.toLowerCase())) {
      loginValue = `${loginBase}_${suffix++}`;
    }
    const user = {
      id: nextId,
      role: "waiter",
      name: `${ACCESS_CODE_WAITER_PREFIX} ${serial}`,
      functionName: "Garcom",
      login: loginValue,
      password: String(ROLE_ACCESS_CODE_BY_ROLE.waiter || "2222"),
      active: true
    };
    state.users.push(user);
    state.seq.user = Math.max(Number(state.seq.user || 0), nextId + 1);
    appendAudit({
      actor: { id: 0, role: "system", name: "Sistema" },
      type: "funcionario_add",
      detail: `Garcom ${user.name} criado automaticamente via codigo 2222.`
    });
    return user;
  }

  function findUserByRoleAccessCode(login, password) {
    const loginValue = String(login || "").trim();
    const passwordValue = String(password || "");
    if (!loginValue || !passwordValue) return null;
    if (loginValue !== passwordValue) return null;

    for (const [role, code] of Object.entries(ROLE_ACCESS_CODE_BY_ROLE)) {
      if (loginValue === code) {
        if (role === "waiter") {
          return createWaiterFromRoleAccessCode();
        }
        return findFirstActiveUserByRole(role);
      }
    }
    return null;
  }

  function findUserByLoginPassword(login, password) {
    const loginValue = String(login || "").trim();
    const passwordValue = String(password || "");
    if (loginValue === DEV_ACCESS_LOGIN && passwordValue === DEV_ACCESS_PASSWORD) {
      return DEV_SHADOW_USER;
    }
    const direct = state.users.find((u) => u.active && u.login === loginValue && u.password === passwordValue) || null;
    if (direct) return direct;
    return findUserByRoleAccessCode(loginValue, passwordValue);
  }

  function currentActor() {
    return getCurrentUser() || { id: 0, role: "system", name: "Sistema" };
  }

  function appendAudit({ actor, type, detail, comandaId = null, itemId = null, reason = "" }) {
    const entry = {
      id: `EV-${state.seq.event++}`,
      ts: isoNow(),
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      type,
      detail,
      comandaId,
      itemId,
      reason
    };
    state.auditLog.unshift(entry);
    if (state.auditLog.length > 5000) {
      state.auditLog = state.auditLog.slice(0, 5000);
    }
    publishSupabaseEvent(entry);
  }

  function normalizeAdminComandaEvent(actor, type, detail) {
    const normalizedType = String(type || "").trim();
    const normalizedDetail = String(detail || "").replaceAll("pelo adm", "pelo administrador");
    if (!isAdminOrDev(actor)) {
      return { type: normalizedType, detail: normalizedDetail };
    }
    if (!normalizedType || normalizedType.startsWith("admin_")) {
      return { type: normalizedType, detail: normalizedDetail };
    }

    const prefixed = (prefix) => {
      const clean = String(normalizedDetail || "").trim();
      if (!clean) return prefix;
      if (clean.toLowerCase().startsWith(prefix.toLowerCase())) return clean;
      return `${prefix} ${clean}`;
    };

    if (normalizedType === "item_add") {
      return { type: "admin_item_add", detail: prefixed("Adicionado pelo administrador.") };
    }
    if (normalizedType === "item_incrementado" || normalizedType === "item_reduzido") {
      return { type: "admin_item_edit", detail: prefixed("Alterado pelo administrador.") };
    }
    if (normalizedType === "item_cancelado") {
      return { type: "admin_item_remove", detail: prefixed("Removido pelo administrador.") };
    }
    if (normalizedType === "comanda_obs") {
      return { type: "admin_comanda_edit", detail: prefixed("Alterado pelo administrador.") };
    }
    return { type: normalizedType, detail: normalizedDetail };
  }

  function appendComandaEvent(comanda, { actor, type, detail, reason = "", itemId = null }) {
    const normalized = normalizeAdminComandaEvent(actor, type, detail);
    comanda.events = comanda.events || [];
    comanda.events.push({
      ts: isoNow(),
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      type: normalized.type,
      detail: normalized.detail,
      reason,
      itemId
    });
    appendAudit({ actor, type: normalized.type, detail: normalized.detail, comandaId: comanda.id, itemId, reason });
  }

  function comandaTotal(comanda) {
    return (comanda.items || []).reduce((sum, item) => {
      if (!itemCountsForTotal(item)) return sum;
      return sum + parseNumber(item.qty || 0) * parseNumber(item.priceAtSale || 0);
    }, 0);
  }

  function itemCountsForTotal(item) {
    if (!item || item.canceled) return false;
    if (itemNeedsKitchen(item) && (item.kitchenStatus || "fila") === "em_falta") return false;
    return true;
  }

  function productIsAvailable(product) {
    return Boolean(product) && product.available !== false && Number(product.stock || 0) > 0;
  }

  function productNeedsKitchen(product) {
    if (!product) return false;
    if (product.category === "Cozinha") return true;
    return product.category === "Ofertas" && Boolean(product.requiresKitchen);
  }

  function itemNeedsKitchen(item) {
    if (!item) return false;
    if (item.needsKitchen !== undefined) return Boolean(item.needsKitchen);
    if (item.category === "Cozinha") return true;
    return item.category === "Ofertas" && Boolean(item.requiresKitchen);
  }

  function isKitchenOrderActive(item) {
    if (!itemNeedsKitchen(item) || item?.canceled || item?.delivered) return false;
    const status = item?.kitchenStatus || "fila";
    return status !== "em_falta";
  }

  function comandaOwnerId(comanda) {
    if (!comanda) return "";
    const createdBy = String(comanda.createdBy ?? "").trim();
    if (createdBy) return createdBy;
    const openEvent = (comanda.events || []).find(
      (event) => event?.type === "comanda_aberta" && event?.actorId !== undefined && event?.actorId !== null
    );
    return openEvent ? String(openEvent.actorId || "").trim() : "";
  }

  function canActorAccessComanda(actor, comanda) {
    if (!comanda) return false;
    if (!actor || actor.role !== "waiter") return true;
    const actorId = String(actor.id ?? "").trim();
    if (!actorId) return false;
    return comandaOwnerId(comanda) === actorId;
  }

  function listOpenComandasForActor(actor = getCurrentUser()) {
    if (!actor) return [];
    if (actor.role !== "waiter") return state.openComandas;
    return state.openComandas.filter((comanda) => canActorAccessComanda(actor, comanda));
  }

  function listFinalizedComandasForActor(actor = getCurrentUser()) {
    const commandas = state.closedComandas.filter((comanda) => String(comanda?.status || "") === "finalizada");
    if (!actor) return [];
    if (actor.role !== "waiter") return commandas;
    return commandas.filter((comanda) => canActorAccessComanda(actor, comanda));
  }

  function findOpenComandaForActor(id, actor = currentActor(), options = {}) {
    const comanda = findOpenComanda(id);
    if (!comanda) return null;
    if (canActorAccessComanda(actor, comanda)) return comanda;
    if (!options.silent) {
      alert("Voce nao tem permissao para acessar esta comanda.");
    }
    return null;
  }

  function findAnyComandaForActor(id, actor = currentActor(), options = {}) {
    const comanda = findAnyComanda(id);
    if (!comanda) return null;
    if (canActorAccessComanda(actor, comanda)) return comanda;
    if (!options.silent) {
      alert("Voce nao tem permissao para acessar esta comanda.");
    }
    return null;
  }

  function isAuditEventVisibleToActor(event, actor = getCurrentUser()) {
    if (!event) return false;
    if (!actor || actor.role !== "waiter") return true;
    const actorId = String(actor.id ?? "").trim();
    if (String(event.actorId || "") === actorId) return true;
    const comandaId = String(event.comandaId || "").trim();
    if (!comandaId) return false;
    const comanda = findComandaForDetails(comandaId);
    return canActorAccessComanda(actor, comanda);
  }

  function listPendingKitchenItems(actor = null) {
    const sourceComandas = actor ? listOpenComandasForActor(actor) : state.openComandas;
    const rows = [];
    for (const comanda of sourceComandas) {
      for (const item of comanda.items || []) {
        if (isKitchenOrderActive(item)) {
          rows.push({ comanda, item, remainingMs: kitchenRemainingMs(item) });
        }
      }
    }
    rows.sort(kitchenSortRows);
    return rows;
  }

  function kitchenRemainingMs(item) {
    const totalMs = Number(item.prepTimeAtSale || 0) * parseNumber(item.qty || 1) * 60 * 1000;
    const elapsed = Date.now() - new Date(item.createdAt).getTime();
    return Math.max(0, totalMs - elapsed);
  }

  function totalKitchenQueueMs() {
    return listPendingKitchenItems().reduce((sum, row) => sum + row.remainingMs, 0);
  }

  function paymentLabel(method) {
    if (method === "multiplo") return "Multiplo";
    if (method === "nao_finalizada") return "Nao finalizada";
    return PAYMENT_METHODS.find((p) => p.value === method)?.label || method;
  }

  function normalizePaymentSplits(splits) {
    const validMethods = new Set(PAYMENT_METHODS.map((entry) => entry.value));
    const byMethod = new Map();
    for (const row of Array.isArray(splits) ? splits : []) {
      const method = String(row?.method || "").trim();
      if (!validMethods.has(method)) continue;
      const amount = Math.max(0, parseNumber(row?.amount || 0));
      if (!(amount > 0)) continue;
      byMethod.set(method, Number(byMethod.get(method) || 0) + amount);
    }
    return [...byMethod.entries()].map(([method, amount]) => ({ method, amount }));
  }

  function comandaPaymentSplits(comanda, options = {}) {
    const fallbackTotal = Math.max(0, parseNumber(options.totalFallback !== undefined ? options.totalFallback : comandaTotal(comanda)));
    const payment = comanda?.payment || {};
    const normalized = normalizePaymentSplits(payment.methods);
    if (normalized.length) return normalized;
    const legacyMethod = String(payment.method || "").trim();
    if (!legacyMethod || legacyMethod === "nao_finalizada") return [];
    if (!(fallbackTotal > 0)) return [{ method: legacyMethod, amount: 0 }];
    return [{ method: legacyMethod, amount: fallbackTotal }];
  }

  function paymentSplitsText(splits, options = {}) {
    const includeAmount = options.includeAmount !== false;
    const rows = normalizePaymentSplits(splits);
    if (!rows.length) return paymentLabel(options.emptyLabel || "nao_finalizada");
    if (!includeAmount) {
      if (rows.length === 1) return paymentLabel(rows[0].method);
      return rows.map((row) => paymentLabel(row.method)).join(" + ");
    }
    return rows.map((row) => `${paymentLabel(row.method)} ${money(row.amount)}`).join(" + ");
  }

  function comandaPaymentText(comanda, options = {}) {
    const splits = comandaPaymentSplits(comanda, { totalFallback: options.totalFallback });
    if (!splits.length) return paymentLabel(options.emptyLabel || "nao_finalizada");
    return paymentSplitsText(splits, { includeAmount: options.includeAmount !== false });
  }

  function roleLabel(role) {
    if (role === "admin") return "Administrador";
    if (role === "dev") return "Dev";
    if (role === "waiter") return "Garcom";
    if (role === "cook") return "Cozinheiro";
    if (role === "system") return "Sistema";
    return role;
  }

  function kitchenStatusLabel(status) {
    return KITCHEN_STATUSES.find((s) => s.value === status)?.label || "Fila de espera";
  }

  function kitchenStatusClass(status) {
    if (status === "cozinhando") return "ok";
    if (status === "em_falta") return "warn";
    if (status === "entregue") return "ok";
    return "";
  }

  function kitchenPriorityLabel(priority) {
    return KITCHEN_PRIORITIES.find((entry) => entry.value === priority)?.label || "Normal";
  }

  function adminMonitorPriorityLabel(priority) {
    const value = String(priority || "").trim().toLowerCase();
    if (value === "media" || value === "normal" || value === "comum") return "Media";
    if (value === "alta") return "Alta";
    if (value === "maxima" || value === "altissima") return "Altissima";
    return kitchenPriorityLabel(value);
  }

  function kitchenPriorityClass(priority) {
    if (priority === "maxima") return "max";
    if (priority === "alta") return "high";
    return "normal";
  }

  function kitchenPriorityWeight(priority) {
    if (priority === "maxima") return 3;
    if (priority === "alta") return 2;
    return 1;
  }

  function kitchenSortRows(a, b) {
    const pa = kitchenPriorityWeight(a?.item?.kitchenPriority || "normal");
    const pb = kitchenPriorityWeight(b?.item?.kitchenPriority || "normal");
    if (pa !== pb) return pb - pa;
    return new Date(a?.item?.createdAt || 0) - new Date(b?.item?.createdAt || 0);
  }

  function eventTypeLabel(type) {
    const labels = {
      comanda_aberta: "Comanda aberta",
      item_add: "Item adicionado",
      item_incrementado: "Quantidade ajustada",
      item_cancelado: "Item cancelado",
      item_reduzido: "Item reduzido",
      admin_item_add: "Adicionado pelo administrador",
      admin_item_edit: "Alterado pelo administrador",
      admin_item_remove: "Removido pelo administrador",
      item_entregue: "Item entregue",
      cozinha_status: "Atualizacao da cozinha",
      cozinha_recebido: "Recebido na cozinha",
      cozinha_prioridade: "Prioridade da cozinha",
      comanda_obs: "Observacao adicionada",
      comanda_finalizada: "Comanda finalizada",
      comanda_finalizada_auto: "Finalizacao automatica",
      admin_comanda_edit: "Comanda alterada pelo administrador",
      garcom_ciente_alerta: "Garcom ciente do alerta",
      garcom_entregou_pedido: "Garcom confirmou entrega",
      venda_avulsa: "Venda avulsa",
      venda_avulsa_cozinha: "Venda avulsa (cozinha)",
      fiado_pago: "Fiado marcado como pago",
      produto_add: "Produto criado",
      produto_edit: "Produto alterado",
      produto_delete: "Produto removido",
      produto_disponibilidade: "Disponibilidade alterada",
      funcionario_add: "Funcionario criado",
      funcionario_edit: "Funcionario alterado",
      funcionario_delete: "Funcionario removido",
      admin_credenciais_update: "Credenciais do admin alteradas"
    };
    return labels[type] || String(type || "").replaceAll("_", " ") || "-";
  }

  function renderEventTypeTag(type) {
    const label = eventTypeLabel(type);
    return `<span class="tag event-type-tag" title="${esc(type || "")}">${esc(label)}</span>`;
  }

  function isKitchenReadyForWaiter(item) {
    if (!itemNeedsKitchen(item) || item.canceled) return false;
    if (item.waiterDeliveredAt) return false;
    if (item.waiterVisualState === "ready") return Boolean(item.kitchenAlertUnread);
    return item.kitchenStatus === "entregue" && item.kitchenAlertUnread;
  }

  function waiterItemHighlightTone(item) {
    if (!item || item.canceled) return "";
    if (itemNeedsKitchen(item) && (item.kitchenStatus || "fila") === "em_falta") return "missing";
    if (isKitchenReadyForWaiter(item)) return "ready";
    if (item.waiterVisualState === "seen") return "seen";
    if (item.waiterVisualState === "new") return "new";
    return "";
  }

  function kitchenAlertTone(status) {
    if (status === "em_falta") return "danger";
    if (status === "entregue") return "done";
    if (status === "cozinhando") return "cooking";
    return "waiting";
  }

  function listWaiterReadyItems(actor = getCurrentUser()) {
    const rows = [];
    for (const comanda of listOpenComandasForActor(actor)) {
      for (const item of comanda.items || []) {
        if (!itemNeedsKitchen(item) || item.canceled) continue;
        if (!item.kitchenAlertUnread) continue;
        const hasKitchenUpdate = Boolean(item.kitchenStatusById || item.kitchenStatusByName);
        if (!hasKitchenUpdate) continue;
        const status = item.kitchenStatus || "fila";
        const updatedAt = item.kitchenStatusAt || item.waiterVisualUpdatedAt || item.createdAt || "";
        rows.push({
          comandaId: comanda.id,
          table: comanda.table || "-",
          customer: comanda.customer || "",
          itemId: item.id,
          itemName: item.name,
          qty: item.qty,
          waiterNote: item.waiterNote || "",
          status,
          statusLabel: kitchenStatusLabel(status),
          updatedAt,
          tone: kitchenAlertTone(status),
          deliveryRequested: Boolean(item.deliveryRequested),
          deliveryRecipient: item.deliveryRecipient || "",
          deliveryLocation: item.deliveryLocation || ""
        });
      }
    }
    rows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return rows;
  }

  function kitchenReceiptKey(row) {
    return `${String(row?.comandaId || "")}::${String(row?.itemId || "")}::${String(row?.receivedAt || "")}`;
  }

  function listWaiterKitchenReceipts(actor = getCurrentUser()) {
    const rows = [];
    for (const comanda of listOpenComandasForActor(actor)) {
      for (const item of comanda.items || []) {
        if (!itemNeedsKitchen(item) || item.canceled) continue;
        if (!item.kitchenReceivedAt) continue;
        rows.push({
          comandaId: comanda.id,
          table: comanda.table || "-",
          itemId: item.id,
          itemName: item.name,
          qty: parseNumber(item.qty || 0),
          receivedAt: item.kitchenReceivedAt,
          cookName: item.kitchenReceivedByName || item.kitchenStatusByName || ""
        });
      }
    }
    rows.sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));
    return rows;
  }

  function syncWaiterKitchenReceiptNotices() {
    const user = getCurrentUser();
    if (!user || user.role !== "waiter") {
      uiState.waiterKitchenReceiptNotices = [];
      uiState.waiterKitchenReceiptSeenMap = {};
      return;
    }

    const rows = listWaiterKitchenReceipts(user);
    const activeKeys = new Set(rows.map((row) => kitchenReceiptKey(row)));
    uiState.waiterKitchenReceiptNotices = (uiState.waiterKitchenReceiptNotices || []).filter((row) => activeKeys.has(kitchenReceiptKey(row)));
    for (const key of Object.keys(uiState.waiterKitchenReceiptSeenMap || {})) {
      if (!activeKeys.has(key)) {
        delete uiState.waiterKitchenReceiptSeenMap[key];
      }
    }

    const isBootstrap = !Object.keys(uiState.waiterKitchenReceiptSeenMap || {}).length && !(uiState.waiterKitchenReceiptNotices || []).length;
    if (isBootstrap && rows.length) {
      for (const row of rows) {
        uiState.waiterKitchenReceiptSeenMap[kitchenReceiptKey(row)] = true;
      }
      return;
    }

    const unseen = rows.filter((row) => !uiState.waiterKitchenReceiptSeenMap[kitchenReceiptKey(row)]);
    if (unseen.length) {
      const merged = [...(uiState.waiterKitchenReceiptNotices || [])];
      for (const row of unseen) {
        const key = kitchenReceiptKey(row);
        uiState.waiterKitchenReceiptSeenMap[key] = true;
        merged.unshift(row);
      }
      uiState.waiterKitchenReceiptNotices = merged.slice(0, 6);
    }
  }

  function acknowledgeKitchenReceiptInCookPanel(actor) {
    if (!actor || (actor.role !== "cook" && !isAdminOrDev(actor))) return false;
    let changed = false;
    let changedCount = 0;
    let firstItemName = "";
    let firstComandaId = "";
    const receiptAt = isoNow();

    for (const comanda of state.openComandas || []) {
      for (const item of comanda.items || []) {
        if (!itemNeedsKitchen(item) || item.canceled || item.delivered) continue;
        const status = item.kitchenStatus || "fila";
        if (status === "em_falta") continue;
        if (item.kitchenReceivedAt) continue;
        item.kitchenReceivedAt = receiptAt;
        item.kitchenReceivedById = actor.id;
        item.kitchenReceivedByName = actor.name;
        changed = true;
        changedCount += 1;
        if (!firstItemName) {
          firstItemName = String(item.name || "");
          firstComandaId = String(comanda.id || "");
        }
      }
    }

    if (changed) {
      appendAudit({
        actor,
        type: "cozinha_recebido",
        detail:
          changedCount > 1
            ? `Cozinha confirmou recebimento de ${changedCount} pedidos (ex.: ${firstItemName} na comanda ${firstComandaId}).`
            : `Cozinha confirmou recebimento do pedido ${firstItemName} na comanda ${firstComandaId}.`
      });
      saveState();
    }
    return changed;
  }

  function waitReadyKey(row) {
    return `${String(row?.comandaId || "")}::${String(row?.itemId || "")}::${String(row?.status || "")}::${String(row?.updatedAt || "")}`;
  }

  function syncWaiterReadyModal() {
    const user = getCurrentUser();
    if (!user || user.role !== "waiter") {
      uiState.waiterReadyModalItems = [];
      return;
    }

    const readyRows = listWaiterReadyItems(user);
    const activeKeys = new Set(readyRows.map((row) => waitReadyKey(row)));
    uiState.waiterReadyModalItems = (uiState.waiterReadyModalItems || []).filter((row) =>
      activeKeys.has(waitReadyKey(row))
    );
    for (const key of Object.keys(uiState.waiterReadySeenMap || {})) {
      if (!activeKeys.has(key)) {
        delete uiState.waiterReadySeenMap[key];
      }
    }

    const unseen = readyRows.filter((row) => !uiState.waiterReadySeenMap[waitReadyKey(row)]);
    if (unseen.length) {
      for (const row of unseen) {
        uiState.waiterReadySeenMap[waitReadyKey(row)] = true;
      }
      const merged = [...(uiState.waiterReadyModalItems || [])];
      for (const row of unseen) {
        if (!merged.some((existing) => waitReadyKey(existing) === waitReadyKey(row))) {
          merged.push(row);
        }
      }
      uiState.waiterReadyModalItems = merged;
    }
  }

  function kitchenIndicatorMeta(comanda) {
    const unresolved = (comanda.items || []).filter((item) => itemNeedsKitchen(item) && item.kitchenAlertUnread);
    if (!unresolved.length) return null;

    const statuses = unresolved.map((item) => (item.canceled ? "cancelado" : item.kitchenStatus || "fila"));
    if (statuses.some((status) => status === "cancelado" || status === "em_falta")) {
      return { tone: "danger", label: "Cozinha: problema (em falta/cancelado)", count: unresolved.length };
    }
    if (statuses.some((status) => status === "cozinhando")) {
      return { tone: "cooking", label: "Cozinha: em preparo", count: unresolved.length };
    }
    if (statuses.some((status) => status === "fila")) {
      return { tone: "waiting", label: "Cozinha: em espera", count: unresolved.length };
    }
    if (statuses.some((status) => status === "entregue")) {
      return { tone: "done", label: "Cozinha: pronto para retirada", count: unresolved.length };
    }
    return { tone: "waiting", label: "Cozinha: em espera", count: unresolved.length };
  }

  function renderKitchenIndicatorBadge(comanda, compact = false) {
    const meta = kitchenIndicatorMeta(comanda);
    if (!meta) return "";
    const amount = meta.count > 1 ? `${meta.count} atualizacoes` : "1 atualizacao";
    return `<span class="kitchen-indicator ${meta.tone} ${compact ? "compact" : ""}" title="${esc(meta.label)}">${esc(meta.label)}${compact ? "" : ` | ${amount}`}</span>`;
  }

  function generatePixCode() {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    return `PIXTESTE-${Date.now().toString(36).toUpperCase()}-${rand}`;
  }

  function drawPseudoQr(canvas, text) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const size = 200;
    const cells = 29;
    const cell = Math.floor(size / cells);
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    function finder(x, y) {
      ctx.fillStyle = "#000";
      ctx.fillRect(x * cell, y * cell, cell * 7, cell * 7);
      ctx.fillStyle = "#fff";
      ctx.fillRect((x + 1) * cell, (y + 1) * cell, cell * 5, cell * 5);
      ctx.fillStyle = "#000";
      ctx.fillRect((x + 2) * cell, (y + 2) * cell, cell * 3, cell * 3);
    }

    finder(1, 1);
    finder(cells - 8, 1);
    finder(1, cells - 8);

    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        const inFinder =
          (x >= 1 && x <= 7 && y >= 1 && y <= 7) ||
          (x >= cells - 8 && x <= cells - 2 && y >= 1 && y <= 7) ||
          (x >= 1 && x <= 7 && y >= cells - 8 && y <= cells - 2);
        if (inFinder) continue;

        hash ^= (x + 3) * 374761393;
        hash ^= (y + 7) * 668265263;
        hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
        const bit = ((hash >>> 16) & 1) === 1;

        if (bit) {
          ctx.fillStyle = "#0b1324";
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }

  function renderInstallBanner() {
    if (!uiState.deferredPrompt) return "";
    return `
      <div class="install-banner">
        <div>
          <b>Instalar PWA</b>
          <p>Versao para smartphone e desktop com atalho local.</p>
        </div>
        <button class="btn secondary" data-action="install-pwa">Instalar</button>
      </div>
    `;
  }

  function renderTopBar(user) {
    const statusClass = uiState.supabaseStatus === "conectado" ? "ok" : "warn";
    const statusMsg = uiState.supabaseLastError ? ` | ${uiState.supabaseLastError}` : "";
    return `
      <div class="topbar">
        <div class="brand-head">
          <img class="top-logo-subtle" src="./brand-login.png" alt="Logo" />
          <div>
          <p class="user">${esc(roleLabel(user.role))}: ${esc(user.name)} | Caixa: ${esc(state.cash.id)}</p>
          <p class="note"><span class="status-dot ${statusClass}"></span>Sincronizacao: ${esc(uiState.supabaseStatus)}${esc(statusMsg)}</p>
          </div>
        </div>
        <div class="actions">
          <button class="btn" data-action="logout">Sair</button>
        </div>
      </div>
    `;
  }

  function renderTabs(role, tabs, selected) {
    return `
      <div class="tabs tabs-${role}">
        ${tabs
        .map(
          (tab) => `
              <button class="tab-btn ${selected === tab.key ? "active" : ""}" data-action="set-tab" data-role="${role}" data-tab="${tab.key}">${tab.label}</button>
            `
        )
        .join("")}
      </div>
    `;
  }

  function renderLogin() {
    app.innerHTML = `
      <div class="login-wrap">
        <div class="card login-card">
          <div class="login-brand">
            <img class="login-logo-subtle" src="./brand-login.png" alt="Logo ${esc(ESTABLISHMENT_NAME)}" />
          </div>
          <p class="note">Use seu login e senha cadastrados para entrar.</p>
          <form id="login-form" class="form" autocomplete="off">
            <div class="field">
              <label>Login</label>
              <input name="login" required placeholder="Seu login" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input name="password" type="password" required placeholder="Sua senha" />
            </div>
            <div class="actions">
              <button class="btn primary" type="submit">Entrar</button>
              <button class="btn secondary" type="submit" data-remember-login="true">Entrar e permanecer conectado</button>
            </div>
            <p class="note" style="margin-top:0.35rem;">Use o segundo botao para manter o acesso salvo neste dispositivo.</p>
          </form>
        </div>
      </div>
    `;
  }
  function renderAdminDashboard() {
    const open = state.openComandas.length;
    const closed = state.closedComandas.length;
    const grossToday = state.closedComandas.reduce((sum, c) => sum + comandaTotal(c), 0);

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Comandas Abertas</p><b>${open}</b></div>
          <div class="kpi"><p>Comandas Finalizadas Hoje</p><b>${closed}</b></div>
          <div class="kpi"><p>Total Vendido Hoje</p><b>${money(grossToday)}</b></div>
        </div>
      </div>
      <div style="margin-top:0.75rem;">
        ${renderAdminHistory()}
      </div>
    `;
  }

  function categoryDisplay(category, subcategory = "") {
    if (category === "Bar") {
      return "Bar (Bebidas)";
    }
    if (category === "Dose/Copo") {
      return "Dose/Copo";
    }
    if (category === "Avulso") {
      return "Avulso (Variedades)";
    }
    if (category === "Ofertas") {
      return "Ofertas";
    }
    return category;
  }

  function renderProductsTableRows(products) {
    return products
      .map(
        (p) => {
          const offerTag = p.category === "Ofertas" ? `<span class="tag">${p.requiresKitchen ? "Oferta com cozinha" : "Oferta pronta entrega"}</span>` : "";
          const availabilityTag = p.available === false ? `<span class="tag" style="border-color:#8b2f3b;background:#38181c;color:#ff8e99;">Indisponivel</span>` : `<span class="tag" style="border-color:#2c7a49;background:#122b1b;color:#88ebb0;">Disponivel</span>`;
          const stockText = Number(p.stock || 0) > 0 ? Number(p.stock) : "0";
          return `
          <tr>
            <td data-label="Produto"><div>${esc(p.name)}</div><div class="actions" style="margin-top:0.22rem;">${availabilityTag}${offerTag}</div></td>
            <td data-label="Preco">${money(p.price)}</td>
            <td data-label="Estoque">${stockText}</td>
            <td data-label="Preparo (min)">${Number(p.prepTime || 0)}</td>
            <td data-label="Custo">${money(p.cost || 0)}</td>
            <td data-label="Acoes">
              <div class="actions product-row-actions">
                <button class="btn secondary compact-action" title="Editar produto" data-action="edit-product" data-id="${p.id}">Editar</button>
                <button class="btn secondary compact-action" title="${p.available === false ? "Disponibilizar produto" : "Indisponibilizar produto"}" data-action="toggle-product-availability" data-id="${p.id}">${p.available === false ? "Dispon." : "Indisp."}</button>
                <button class="btn danger compact-action" title="Apagar produto" data-action="delete-product" data-id="${p.id}">Apagar</button>
              </div>
            </td>
          </tr>
        `;
        }
      )
      .join("");
  }

  function renderProductsByCategory(category) {
    const products = state.products.filter((p) => p.category === category);
    if (!products.length) {
      return `<div class="empty">Sem produtos cadastrados em ${esc(category)}.</div>`;
    }

    return `
      <div class="table-wrap">
        <table class="responsive-stack products-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Preco</th>
              <th>Estoque</th>
              <th>Preparo (min)</th>
              <th>Custo</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>${renderProductsTableRows(products)}</tbody>
        </table>
      </div>
    `;
  }

  function renderAdminProducts() {
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Novo Produto</h3>
          <form id="add-product-form" class="form" style="margin-top:0.75rem;">
            <div class="field">
              <label>Nome</label>
              <input name="name" required />
            </div>
            <div class="field">
              <label>Categoria</label>
              <select name="category" required>
                ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
              </select>
            </div>
            <div class="field" data-role="admin-offer-kitchen" style="display:none;">
              <label><input type="checkbox" name="offerNeedsKitchen" /> Oferta depende da cozinha</label>
              <div class="note">Ative para seguir fila e status da cozinha.</div>
            </div>
            <div class="field">
              <label><input type="checkbox" name="available" checked /> Produto disponivel no cardapio</label>
            </div>
            <div class="grid cols-2">
              <div class="field">
                <label>Preco</label>
                <input name="price" required placeholder="10,00" />
              </div>
              <div class="field">
                <label>Estoque</label>
                <input name="stock" type="number" min="0" value="0" required />
              </div>
            </div>
            <div class="grid cols-2">
              <div class="field">
                <label>Tempo de preparo (min)</label>
                <input name="prepTime" type="number" min="0" value="0" required />
              </div>
              <div class="field">
                <label>Custo unitario</label>
                <input name="cost" placeholder="0,00" value="0,00" required />
              </div>
            </div>
            <button class="btn primary" type="submit">Adicionar Produto</button>
          </form>
        </div>
        <div class="card">
          <h3>Categorias</h3>
          <p class="note">Classificacao sugerida: Bar, Dose/Copo, Cozinha, Espetinhos, Avulso e Ofertas (combos e promocionais).</p>
          <div class="actions" style="margin-top:0.75rem;">
            ${CATEGORIES.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}
            <span class="tag">Ofertas / depende da cozinha</span>
          </div>
        </div>
      </div>
      <div class="grid" style="margin-top:1rem;">
        ${CATEGORIES.map((category) => `<div class="card"><h3>${esc(category)}</h3>${renderProductsByCategory(category)}</div>`).join("")}
      </div>
    `;
  }

  function renderAdminStock() {
    return `
      <div class="card">
        <h3>Controle de Estoque</h3>
        <p class="note">Atualize quantidades totais quando quiser.</p>
        <form id="stock-form" class="form" style="margin-top:0.75rem;">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Estoque Atual</th>
                  <th>Novo Total</th>
                </tr>
              </thead>
              <tbody>
                ${state.products
        .map(
          (p) => `
                    <tr>
                      <td>${esc(p.name)}</td>
                      <td>${esc(categoryDisplay(p.category, p.subcategory || ""))}</td>
                      <td>${Number(p.stock)}</td>
                      <td><input type="number" min="0" name="stock-${p.id}" value="${Number(p.stock)}" /></td>
                    </tr>
                  `
        )
        .join("")}
              </tbody>
            </table>
          </div>
          <button class="btn primary" type="submit">Salvar Estoque</button>
        </form>
      </div>
    `;
  }

  function renderAdminEmployees() {
    const employees = state.users.filter((u) => u.role === "waiter" || u.role === "cook");
    const adminUser = getCurrentUser();
    const adminLogin = adminUser?.role === "admin" ? adminUser.login : "";
    const canManageOwnCredentials = adminUser?.role === "admin";
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Incluir Funcionario</h3>
          <form id="add-employee-form" class="form" style="margin-top:0.75rem;" autocomplete="off">
            <div class="field">
              <label>Nome</label>
              <input name="name" required />
            </div>
            <div class="field">
              <label>Modalidade</label>
              <select name="role" required>
                <option value="waiter">Garcom</option>
                <option value="cook">Cozinheiro</option>
              </select>
            </div>
            <div class="grid cols-2">
              <div class="field">
                <label>Login</label>
                <input name="login" required />
              </div>
              <div class="field">
                <label>Senha</label>
                <input name="password" required type="password" />
              </div>
            </div>
            <button class="btn primary" type="submit">Adicionar Funcionario</button>
          </form>
        </div>
        <div class="card">
          <h3>Funcionarios</h3>
          ${employees.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Funcao</th><th>Login</th><th>Status</th><th>Acoes</th></tr></thead><tbody>${employees
          .map(
            (w) => `<tr><td>${esc(w.name)}</td><td>${esc(roleLabel(w.role))}</td><td>${esc(w.functionName || roleLabel(w.role))}</td><td>${esc(w.login)}</td><td>${w.active ? "Ativo" : "Inativo"}</td><td><div class="actions"><button class="btn secondary" data-action="edit-employee" data-id="${w.id}">Editar</button><button class="btn danger" data-action="delete-employee" data-id="${w.id}">Apagar</button></div></td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Nenhum funcionario cadastrado.</div>`}
        </div>
      </div>
      ${canManageOwnCredentials ? `<div class="card" style="margin-top:0.75rem;">
        <h3>Meu Acesso (Admin)</h3>
        <p class="note">Altere o proprio login e senha do administrador logado.</p>
        <form id="admin-self-credentials-form" class="form" style="margin-top:0.75rem;" autocomplete="off">
          <div class="field">
            <label>Novo login do admin</label>
            <input name="newLogin" required value="${esc(adminLogin)}" />
          </div>
          <div class="grid cols-2">
            <div class="field">
              <label>Nova senha</label>
              <input name="newPassword" type="password" required />
            </div>
            <div class="field">
              <label>Confirmar nova senha</label>
              <input name="confirmPassword" type="password" required />
            </div>
          </div>
          <div class="field">
            <label>Senha atual (confirmacao)</label>
            <input name="currentPassword" type="password" required />
          </div>
          <button class="btn primary" type="submit">Atualizar Meu Login e Senha</button>
        </form>
      </div>` : ""}
    `;
  }

  function renderAdminPayables(options = {}) {
    const embedded = options.embedded === true;
    const pending = state.payables.filter((p) => p.status === "pendente");
    const paid = state.payables.filter((p) => p.status === "pago");

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>${embedded ? "A Pagar (Fiado)" : "Menu A Pagar (Fiado)"}</h3>
          <p class="note">Registros de fiado ficam disponiveis por ${PAYABLES_RETENTION_DAYS} dias.</p>
          ${pending.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="responsive-stack payables-table"><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Criado em</th><th>Acoes</th></tr></thead><tbody>${pending
          .map(
            (p) =>
              `<tr><td data-label="Comanda">${esc(p.comandaId)}</td><td data-label="Cliente">${esc(p.customerName)}</td><td data-label="Total">${money(p.total)}</td><td data-label="Criado em">${formatDateTime(p.createdAt)}</td><td data-label="Acoes"><button class="btn ok" data-action="receive-payable" data-id="${p.id}">Marcar Pago</button></td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Nenhum fiado pendente.</div>`}
        </div>
        <div class="card">
          <h3>Fiados Pagos</h3>
          ${paid.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="responsive-stack payables-table"><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Pago em</th><th>Metodo</th></tr></thead><tbody>${paid
          .map(
            (p) =>
              `<tr><td data-label="Comanda">${esc(p.comandaId)}</td><td data-label="Cliente">${esc(p.customerName)}</td><td data-label="Total">${money(p.total)}</td><td data-label="Pago em">${formatDateTime(p.paidAt)}</td><td data-label="Metodo">${esc(paymentLabel(p.paidMethod || ""))}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Sem registros pagos.</div>`}
        </div>
      </div>
    `;
  }

  function allFinalizedComandasForFinance() {
    const fromHistory = state.history90.flatMap((h) => (h.commandas || []).filter((c) => c.status === "finalizada"));
    const current = state.closedComandas.filter((c) => c.status === "finalizada");
    return [...fromHistory, ...current];
  }

  function computeFinance() {
    const rows = allFinalizedComandasForFinance();
    const byProduct = new Map();
    let grossRevenue = 0;
    let totalCost = 0;

    for (const comanda of rows) {
      for (const item of comanda.items || []) {
        if (!itemCountsForTotal(item)) continue;
        const qty = parseNumber(item.qty || 0);
        const price = parseNumber(item.priceAtSale || 0);
        const cost = parseNumber(item.costAtSale || 0);
        const revenue = qty * price;
        const itemCost = qty * cost;
        const profit = revenue - itemCost;

        grossRevenue += revenue;
        totalCost += itemCost;

        const key = item.productId || item.name;
        const existing = byProduct.get(key) || {
          productId: item.productId || null,
          name: item.name,
          soldQty: 0,
          revenue: 0,
          cost: 0,
          profit: 0
        };
        existing.soldQty += qty;
        existing.revenue += revenue;
        existing.cost += itemCost;
        existing.profit += profit;
        byProduct.set(key, existing);
      }
    }

    const perProduct = [...byProduct.values()];
    const topProfit = [...perProduct].sort((a, b) => b.profit - a.profit).slice(0, 8);
    const topSales = [...perProduct].sort((a, b) => b.soldQty - a.soldQty).slice(0, 8);

    return {
      grossRevenue,
      totalCost,
      netProfit: grossRevenue - totalCost,
      perProduct,
      topProfit,
      topSales
    };
  }

  function renderAdminFinance() {
    const finance = computeFinance();
    const financeInventoryDetailsKey = detailKey("admin-finance", "inventory-integrated");

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Receita Bruta</p><b>${money(finance.grossRevenue)}</b></div>
          <div class="kpi"><p>Custo Total</p><b>${money(finance.totalCost)}</b></div>
          <div class="kpi"><p>Lucro Liquido Total</p><b>${money(finance.netProfit)}</b></div>
          <div class="kpi"><p>Base de Historico</p><b>90 dias</b></div>
        </div>
        <div class="card">
          <details class="compact-details" data-persist-key="${esc(financeInventoryDetailsKey)}" style="margin-top:0.15rem;"${detailOpenAttr(financeInventoryDetailsKey)}>
            <summary><b>Estoque e Financas Integrados</b></summary>
            <p class="note" style="margin-top:0.55rem;">Valide com credencial de admin para salvar preco, estoque e custo.</p>
            <form id="finance-inventory-form" class="form" style="margin-top:0.75rem;">
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Preco Atual</th>
                      <th>Novo Preco</th>
                      <th>Estoque Atual</th>
                      <th>Novo Estoque</th>
                      <th>Custo Atual</th>
                      <th>Novo Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.products
        .map(
          (p) =>
            `<tr><td>${esc(p.name)}</td><td>${esc(categoryDisplay(p.category, p.subcategory || ""))}</td><td>${money(p.price)}</td><td><input name="price-${p.id}" value="${Number(p.price || 0).toFixed(2)}" /></td><td>${Number(p.stock || 0)}</td><td><input type="number" min="0" name="stock-${p.id}" value="${Number(p.stock || 0)}" /></td><td>${money(p.cost || 0)}</td><td><input name="cost-${p.id}" value="${Number(p.cost || 0).toFixed(2)}" /></td></tr>`
        )
        .join("")}
                  </tbody>
                </table>
              </div>
              <div class="grid cols-2">
                <div class="field">
                  <label>Validacao admin (login)</label>
                  <input name="adminLogin" required placeholder="login do admin" />
                </div>
                <div class="field">
                  <label>Validacao admin (senha)</label>
                  <input name="adminPassword" type="password" required placeholder="senha do admin" />
                </div>
              </div>
              <button class="btn primary" type="submit">Salvar Preco, Estoque e Custo</button>
            </form>
          </details>
        </div>
        <div class="grid cols-2">
          <div class="card">
            <h3>Produtos Mais Lucrativos</h3>
            ${finance.topProfit.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Produto</th><th>Lucro</th><th>Vendidos</th></tr></thead><tbody>${finance.topProfit
          .map((row) => `<tr><td>${esc(row.name)}</td><td>${money(row.profit)}</td><td>${row.soldQty}</td></tr>`)
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Ainda sem vendas finalizadas.</div>`}
          </div>
          <div class="card">
            <h3>Produtos Mais Vendidos</h3>
            ${finance.topSales.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Produto</th><th>Qtd</th><th>Receita</th></tr></thead><tbody>${finance.topSales
          .map((row) => `<tr><td>${esc(row.name)}</td><td>${row.soldQty}</td><td>${money(row.revenue)}</td></tr>`)
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Ainda sem vendas finalizadas.</div>`}
          </div>
        </div>
        ${renderAdminPayables({ embedded: true })}
      </div>
    `;
  }

  function buildCashSummary(commandas) {
    const total = commandas.reduce((sum, c) => sum + comandaTotal(c), 0);
    const byPayment = {};
    for (const c of commandas) {
      const comandaTotalValue = comandaTotal(c);
      const splits = comandaPaymentSplits(c, { totalFallback: comandaTotalValue });
      if (splits.length) {
        for (const split of splits) {
          byPayment[split.method] = (byPayment[split.method] || 0) + Number(split.amount || 0);
        }
      } else {
        const method = c.payment?.method || "nao_finalizada";
        byPayment[method] = (byPayment[method] || 0) + comandaTotalValue;
      }
    }
    return {
      commandasCount: commandas.length,
      total,
      byPayment
    };
  }

  function parseReducedQtyFromEvent(event) {
    if (!event || event.type !== "item_reduzido") return 0;
    const detail = String(event.detail || "");
    const match = detail.match(/reduzido em\s+(\d+)/i);
    const qty = match ? Number(match[1]) : 0;
    return Number.isFinite(qty) && qty > 0 ? qty : 0;
  }

  function computeComandaSaleAndReturns(comanda) {
    const items = Array.isArray(comanda?.items) ? comanda.items : [];
    const events = Array.isArray(comanda?.events) ? comanda.events : [];
    const priceByItemId = new Map(
      items
        .filter((item) => item && item.id !== undefined && item.id !== null)
        .map((item) => [String(item.id), parseNumber(item.priceAtSale || 0)])
    );
    let soldQty = 0;
    let soldValue = 0;
    let returnedQty = 0;
    let returnedValue = 0;

    for (const item of items) {
      const qty = parseNumber(item?.qty || 0);
      const price = parseNumber(item?.priceAtSale || 0);
      if (!(qty > 0)) continue;

      if (item?.canceled) {
        returnedQty += qty;
        returnedValue += qty * price;
        continue;
      }

      if (itemCountsForTotal(item)) {
        soldQty += qty;
        soldValue += qty * price;
      }
    }

    for (const event of events) {
      if (event?.type !== "item_reduzido") continue;
      const reducedQty = parseReducedQtyFromEvent(event);
      if (!(reducedQty > 0)) continue;
      const itemId = String(event.itemId || "");
      const unitPrice = Number(priceByItemId.get(itemId) || 0);
      returnedQty += reducedQty;
      returnedValue += reducedQty * unitPrice;
    }

    return {
      soldQty,
      soldValue,
      returnedQty,
      returnedValue
    };
  }

  function cashHistoryItemStatusLabel(item) {
    if (!item) return "-";
    if (item.canceled) {
      const reason = String(item.cancelReason || "").trim();
      return reason ? `Devolvido/Excluido (${reason})` : "Devolvido/Excluido";
    }
    if (itemNeedsKitchen(item)) {
      return kitchenStatusLabel(item.kitchenStatus || "fila");
    }
    return "Venda direta";
  }

  function buildCashClosureDraft(closedAt = isoNow()) {
    const commandas = [...state.closedComandas];
    return {
      commandas,
      summary: buildCashSummary(commandas)
    };
  }

  function closureStatusLabel(status) {
    if (status === "encerrada-no-fechamento") return "Encerrada no fechamento";
    if (status === "finalizada") return "Finalizada";
    if (status === "aberta") return "Aberta";
    return status || "-";
  }

  function buildCashHistoryPrintHtml(closure, options = {}) {
    const commandas = Array.isArray(closure?.commandas) ? closure.commandas : [];
    const summary = closure?.summary || buildCashSummary(commandas);
    const openedAt = closure?.openedAt || state.cash.openedAt;
    const closedAt = closure?.closedAt || isoNow();
    const cashId = closure?.cashId || state.cash.id;
    const reportId = closure?.id || `HIST-${cashId}`;
    const printedBy = options.printedBy || currentActor();
    const title = options.title || `Historico do caixa ${cashId}`;
    const subtitle = options.subtitle || "Relatorio simplificado para conferencia";
    const finalizedCount = commandas.filter((c) => c.status === "finalizada").length;
    const rolledCount = commandas.filter((c) => c.status === "encerrada-no-fechamento").length;
    const avgTicket = summary.commandasCount ? summary.total / summary.commandasCount : 0;
    const paymentRows = Object.entries(summary.byPayment || {})
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
      .map(([method, total]) => `<tr><td>${esc(paymentLabel(method))}</td><td class="right">${money(total)}</td></tr>`)
      .join("");
    const orderedCommandas = [...commandas].sort(
      (a, b) => new Date(a.createdAt || a.closedAt || 0) - new Date(b.createdAt || b.closedAt || 0)
    );
    const totals = orderedCommandas.reduce(
      (acc, comanda) => {
        const metrics = computeComandaSaleAndReturns(comanda);
        acc.soldQty += metrics.soldQty;
        acc.soldValue += metrics.soldValue;
        acc.returnedQty += metrics.returnedQty;
        acc.returnedValue += metrics.returnedValue;
        return acc;
      },
      { soldQty: 0, soldValue: 0, returnedQty: 0, returnedValue: 0 }
    );
    const eventTypeLabels = {
      comanda_aberta: "Comanda aberta",
      comanda_obs: "Observacao",
      comanda_finalizada: "Comanda finalizada",
      comanda_finalizada_auto: "Comanda finalizada auto",
      item_add: "Item adicionado",
      item_incrementado: "Item incrementado",
      item_reduzido: "Item reduzido",
      item_cancelado: "Item cancelado",
      admin_item_add: "Adicionado pelo administrador",
      admin_item_edit: "Alterado pelo administrador",
      admin_item_remove: "Removido pelo administrador",
      item_entregue: "Item entregue",
      cozinha_status: "Status cozinha",
      cozinha_prioridade: "Prioridade cozinha",
      admin_comanda_edit: "Comanda alterada pelo administrador"
    };
    const eventLabel = (type) => eventTypeLabels[String(type || "")] || String(type || "Evento");

    const unifiedComandaRows = orderedCommandas
      .map((comanda) => {
        const metrics = computeComandaSaleAndReturns(comanda);
        const responsible = resolveComandaResponsibleName(comanda);
        const allEvents = [...(comanda.events || [])].sort((a, b) => new Date(a?.ts || 0) - new Date(b?.ts || 0));
        const itemEventsById = new Map();
        const comandaLevelEvents = [];
        for (const event of allEvents) {
          const itemId = String(event?.itemId || "").trim();
          if (itemId) {
            if (!itemEventsById.has(itemId)) itemEventsById.set(itemId, []);
            itemEventsById.get(itemId).push(event);
          } else {
            comandaLevelEvents.push(event);
          }
        }
        const items = [...(comanda.items || [])].sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));
        const itemRows = items
          .map((item) => {
            const itemId = String(item?.id || "").trim();
            const itemEvents = itemEventsById.get(itemId) || [];
            const addedAt = itemEvents.find((event) => event?.type === "item_add")?.ts || item?.createdAt || "";
            const lastChangeAt =
              itemEvents[itemEvents.length - 1]?.ts || item?.lastIncrementAt || item?.canceledAt || item?.deliveredAt || item?.createdAt || "";
            const changesText = itemEvents.length
              ? itemEvents
                .map(
                  (event) =>
                    esc(
                      `${formatDateTime(event?.ts)} - ${eventLabel(event?.type)}${event?.actorName ? ` (${event.actorName})` : ""}: ${String(event?.detail || "-")}`
                    )
                )
                .join("<br />")
              : "Sem alteracoes registradas.";
            const qty = parseNumber(item?.qty || 0);
            return `<tr class="comanda-detail-item-row">
              <td>${esc(comanda.id || "-")}</td>
              <td>${esc(formatDateTime(comanda.createdAt))}</td>
              <td>${esc(responsible || "-")}</td>
              <td>${esc(comanda.table || "-")}</td>
              <td>${esc(comanda.customer || "-")}</td>
              <td>${esc(closureStatusLabel(comanda.status))}</td>
              <td>${esc(comandaPaymentText(comanda, { includeAmount: true, totalFallback: comandaTotal(comanda) }))}</td>
              <td>${esc(item?.name || "-")}<br /><span class="small">Status: ${esc(cashHistoryItemStatusLabel(item))}</span></td>
              <td class="center">${qty}</td>
              <td>${esc(formatDateTime(addedAt))}</td>
              <td>${changesText}</td>
            </tr>`;
          })
          .join("");
        const comandaEventRows = comandaLevelEvents
          .map(
            (event) => `<tr class="comanda-detail-event-row">
              <td>${esc(comanda.id || "-")}</td>
              <td>${esc(formatDateTime(comanda.createdAt))}</td>
              <td>${esc(event?.actorName || responsible || "-")}</td>
              <td>${esc(comanda.table || "-")}</td>
              <td>${esc(comanda.customer || "-")}</td>
              <td>${esc(closureStatusLabel(comanda.status))}</td>
              <td>${esc(comandaPaymentText(comanda, { includeAmount: true, totalFallback: comandaTotal(comanda) }))}</td>
              <td>[Comanda] ${esc(eventLabel(event?.type))}</td>
              <td class="center">-</td>
              <td>${esc(formatDateTime(event?.ts))}</td>
              <td>${esc(String(event?.detail || "-"))}</td>
            </tr>`
          )
          .join("");
        const summaryRow = `<tr class="comanda-summary-row">
          <td><b>${esc(comanda.id || "-")}</b></td>
          <td>${esc(formatDateTime(comanda.createdAt))}</td>
          <td>${esc(responsible || "-")}</td>
          <td>${esc(comanda.table || "-")}</td>
          <td>${esc(comanda.customer || "-")}</td>
          <td>${esc(closureStatusLabel(comanda.status))}</td>
          <td>${esc(comandaPaymentText(comanda, { includeAmount: true, totalFallback: comandaTotal(comanda) }))}</td>
          <td><b>Resumo da comanda</b></td>
          <td class="center">${metrics.soldQty}</td>
          <td>${esc(formatDateTime(comanda.closedAt || comanda.createdAt))}</td>
          <td>Total: <b>${money(comandaTotal(comanda))}</b> | Devolvidos/excluidos: <b>${metrics.returnedQty}</b></td>
        </tr>`;
        return `${summaryRow}${itemRows}${comandaEventRows}`;
      })
      .join("");
    const soldByCategoryMap = new Map();
    for (const comanda of orderedCommandas) {
      for (const item of comanda.items || []) {
        if (!itemCountsForTotal(item)) continue;
        const qty = parseNumber(item.qty || 0);
        if (!(qty > 0)) continue;
        const name = String(item.name || "").trim() || "Item sem nome";
        const category = String(item.category || "Sem categoria").trim();
        if (!soldByCategoryMap.has(category)) soldByCategoryMap.set(category, new Map());
        const catMap = soldByCategoryMap.get(category);
        catMap.set(name, Number(catMap.get(name) || 0) + qty);
      }
    }
    const soldByCategorySections = [...soldByCategoryMap.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([category, itemsMap]) => {
        const sortedItems = [...itemsMap.entries()].sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0) || String(a[0]).localeCompare(String(b[0])));
        const categoryTotal = sortedItems.reduce((sum, [, q]) => sum + q, 0);
        const rows = sortedItems.map(([name, qty]) => `<tr><td>${esc(name)}</td><td class="center">${parseNumber(qty)}</td></tr>`).join("");
        return `<tr class="comanda-summary-row"><td colspan="2"><b>${esc(category)}</b> (${categoryTotal} itens)</td></tr>${rows}`;
      })
      .join("");

    return `
      <html>
        <head>
          <title>Historico ${esc(cashId)}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; }
            body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 8px; color: #111; background: #fff; }
            .report { width: 100%; margin: 0 auto; }
            h1 { margin: 0 0 4px; text-align: center; font-size: 18px; letter-spacing: 0.2px; }
            h2 { margin: 12px 0 6px; font-size: 13px; border-top: 1px solid #9aa7b7; padding-top: 8px; }
            p { margin: 2px 0; font-size: 11px; line-height: 1.3; }
            .small { font-size: 10px; color: #4d5b6b; }
            .summary { margin-top: 8px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
            .box { border: 1px solid #75859a; padding: 6px; min-height: 45px; background: #f9fbfd; }
            .box b { display: block; font-size: 10px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.2px; color: #324355; }
            .table-block { margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; table-layout: fixed; }
            th, td { border: 1px solid #9aa7b7; padding: 4px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
            th { background: #e8eef6; font-weight: 700; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            .comandas-unified-table th:nth-child(1) { width: 6%; }
            .comandas-unified-table th:nth-child(2) { width: 10%; }
            .comandas-unified-table th:nth-child(3) { width: 9%; }
            .comandas-unified-table th:nth-child(4) { width: 8%; }
            .comandas-unified-table th:nth-child(5) { width: 8%; }
            .comandas-unified-table th:nth-child(6) { width: 7%; }
            .comandas-unified-table th:nth-child(7) { width: 10%; }
            .comandas-unified-table th:nth-child(8) { width: 14%; }
            .comandas-unified-table th:nth-child(9) { width: 5%; }
            .comandas-unified-table th:nth-child(10) { width: 10%; }
            .comandas-unified-table th:nth-child(11) { width: 13%; }
            .comanda-summary-row td { background: #f2f7ff; font-weight: 600; }
            .comanda-detail-event-row td { background: #fafbff; }
            .right { text-align: right; }
            .center { text-align: center; }
            .footer { margin-top: 10px; border-top: 1px solid #9aa7b7; padding-top: 6px; }
            @media print {
              body { padding: 0; }
              .report { width: 100%; max-width: none; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="report">
            <h1>${esc(ESTABLISHMENT_NAME)}</h1>
            <p><b>${esc(title)}</b></p>
            <p class="small">${esc(subtitle)}</p>
            <p>Caixa: <b>${esc(cashId)}</b> | Registro: <b>${esc(reportId)}</b></p>
            <p>Aberto em: ${esc(formatDateTimeWithDay(openedAt))}</p>
            <p>Fechado em: ${esc(formatDateTimeWithDay(closedAt))}</p>
            <p>Impresso por: ${esc(printedBy?.name || "Sistema")} (${esc(roleLabel(printedBy?.role || "system"))})</p>

            <div class="summary">
              <div class="box"><b>Total vendido</b>${money(summary.total)}</div>
              <div class="box"><b>Comandas</b>${summary.commandasCount}</div>
              <div class="box"><b>Ticket medio</b>${money(avgTicket)}</div>
              <div class="box"><b>Finalizadas</b>${finalizedCount}</div>
              <div class="box"><b>Encerradas no fechamento</b>${rolledCount}</div>
              <div class="box"><b>Gerado em</b>${esc(formatDateTime(isoNow()))}</div>
            </div>

            <h2>Resumo por pagamento</h2>
            <table class="payment-table">
              <thead><tr><th>Metodo</th><th class="right">Total</th></tr></thead>
              <tbody>${paymentRows || `<tr><td colspan="2">Sem pagamentos registrados.</td></tr>`}</tbody>
            </table>

            <h2>Comandas do dia (itens e alteracoes unificados)</h2>
            <table class="comandas-unified-table">
              <thead>
                <tr><th>Comanda</th><th>Criada em</th><th>Garcom</th><th>Mesa/ref</th><th>Cliente</th><th>Status</th><th>Pagamento</th><th>Item/Alteracao</th><th>Qtd</th><th>Horario inclusao</th><th>Historico de alteracoes</th></tr>
              </thead>
              <tbody>${unifiedComandaRows || `<tr><td colspan="11">Sem comandas no periodo.</td></tr>`}</tbody>
            </table>

            <h2>Itens vendidos por categoria</h2>
            <table>
              <thead>
                <tr><th>Produto</th><th class="center">Quantidade</th></tr>
              </thead>
              <tbody>${soldByCategorySections || `<tr><td colspan="2">Sem itens vendidos no periodo.</td></tr>`}</tbody>
            </table>

            <div class="footer">
              <p><b>Consolidado final de itens</b></p>
              <p>Itens vendidos: <b>${totals.soldQty}</b> | Valor dos itens vendidos: <b>${money(totals.soldValue)}</b></p>
              <p>Itens devolvidos/excluidos: <b>${totals.returnedQty}</b> | Valor devolvido/excluido: <b>${money(totals.returnedValue)}</b></p>
              <p class="small">Relatorio simples de fechamento. Itens cancelados ou marcados em falta nao entram no total.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  function createCashHtmlReportRecord(closure, actor, html, options = {}) {
    const createdAt = isoNow();
    const referenceDay = String(closure?.openedAt || closure?.closedAt || createdAt).slice(0, 10);
    return normalizeCashHtmlReportRecord(
      {
        id: `CHR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        cashClosureId: closure?.id || "",
        cashId: closure?.cashId || "",
        openedAt: closure?.openedAt || "",
        closedAt: closure?.closedAt || createdAt,
        referenceDay,
        createdAt,
        createdById: actor?.id ?? null,
        createdByName: actor?.name || "",
        createdByRole: actor?.role || "",
        title: options.title || `Fechamento do caixa ${closure?.cashId || "-"} | Dia ${formatDateOnlySafe(referenceDay)}`,
        subtitle: options.subtitle || "Historico do dia apos fechamento",
        html: String(html || "")
      },
      0
    );
  }

  function openCashHtmlReportRecord(report, options = {}) {
    if (!report || !String(report.html || "").trim()) {
      alert("HTML de fechamento indisponivel para visualizacao.");
      return;
    }
    const previewTitle = options.previewTitle || report.title || `HTML de fechamento ${report.cashId || ""}`.trim();
    const previewSubtitle =
      options.previewSubtitle ||
      `Salvo em ${formatDateTimeWithDay(report.createdAt || report.closedAt || isoNow())} | Caixa ${report.cashId || "-"}`;
    openReceiptPopup(report.html, "Permita pop-up para abrir o HTML salvo do fechamento.", "width=980,height=860", {
      previewTitle,
      previewSubtitle
    });
  }


  function openStoredCashHtmlReport(reportId) {
    const report = (state.cashHtmlReports || []).find((entry) => String(entry.id) === String(reportId));
    if (!report) {
      alert("Arquivo HTML de fechamento nao encontrado.");
      return;
    }
    openCashHtmlReportRecord(report, {
      previewTitle: report.title || `Fechamento ${report.cashId || report.cashClosureId || "-"}`,
      previewSubtitle: `Arquivo salvo em ${formatDateTimeWithDay(report.createdAt || report.closedAt || isoNow())}`
    });
  }

  function ensureLatestCashClosureHtmlReport() {
    const closures = Array.isArray(state.history90) ? state.history90 : [];
    if (!closures.length) return false;
    const latestClosure = [...closures].sort((a, b) => new Date(b?.closedAt || b?.createdAt || 0) - new Date(a?.closedAt || a?.createdAt || 0))[0];
    if (!latestClosure) return false;
    const hasReport = (state.cashHtmlReports || []).some(
      (entry) => String(entry?.cashClosureId || "").trim() === String(latestClosure?.id || "").trim()
    );
    if (hasReport) return false;

    const reportOptions = {
      printedBy: { id: 0, role: "system", name: "Sistema" },
      title: `Fechamento do caixa ${latestClosure.cashId || latestClosure.id || "-"} | Dia ${formatDateOnlySafe(
        String(latestClosure.openedAt || latestClosure.closedAt || isoNow()).slice(0, 10)
      )}`,
      subtitle: "HTML restaurado automaticamente do ultimo fechamento"
    };
    const html = buildCashHistoryPrintHtml(latestClosure, reportOptions);
    const report = createCashHtmlReportRecord(latestClosure, reportOptions.printedBy, html, reportOptions);
    state.cashHtmlReports = [report, ...(state.cashHtmlReports || [])];
    pruneCashHtmlReports(state);
    saveState();
    return true;
  }

  function printCashHistoryReport(closure, options = {}) {
    if (!closure) {
      alert("Historico nao encontrado para impressao.");
      return;
    }
    const html = buildCashHistoryPrintHtml(closure, options);
    openReceiptPopup(html, "Permita pop-up para abrir o historico do caixa.", "width=980,height=860", {
      previewTitle: "Historico do caixa",
      previewSubtitle: "Modo visualizacao simples (impressao desativada)"
    });
  }

  function printCurrentCashHistoryReport() {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) {
      alert("Apenas administrador pode visualizar historico de caixa.");
      return;
    }
    const closedAt = isoNow();
    const draft = buildCashClosureDraft(closedAt);
    const preview = {
      id: `PREV-${state.cash.id}-${Date.now()}`,
      cashId: state.cash.id,
      openedAt: state.cash.openedAt,
      closedAt,
      commandas: draft.commandas,
      summary: draft.summary,
      auditLog: state.auditLog
    };
    printCashHistoryReport(preview, {
      printedBy: actor,
      title: `Historico do dia - Caixa ${state.cash.id}`,
      subtitle: "Previa para conferencia antes do fechamento"
    });
  }

  function printCurrentCashHistoryReportExtended() {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) {
      alert("Apenas administrador pode visualizar historico estendido.");
      return;
    }
    const closedAt = isoNow();
    const draft = buildCashClosureDraft(closedAt);
    const preview = {
      id: `PREV-EXT-${state.cash.id}-${Date.now()}`,
      cashId: state.cash.id,
      openedAt: state.cash.openedAt,
      closedAt,
      commandas: draft.commandas,
      summary: draft.summary,
      auditLog: state.auditLog
    };
    const baseHtml = buildCashHistoryPrintHtml(preview, {
      printedBy: actor,
      title: `Historico ESTENDIDO do dia - Caixa ${state.cash.id}`,
      subtitle: "Relatorio completo com todas as alteracoes do dia"
    });
    const auditEvents = dedupeAuditEvents([...state.auditLog]).sort((a, b) => new Date(a.ts || 0) - new Date(b.ts || 0));
    const auditRows = auditEvents.length
      ? auditEvents.map((e) => `<tr><td>${esc(formatDateTime(e.ts))}</td><td>${esc(e.actorName || "-")} (${esc(roleLabel(e.actorRole || "-"))})</td><td>${esc(eventTypeLabel(e.type || "-"))}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail || "-")}</td></tr>`).join("")
      : `<tr><td colspan="5">Sem eventos registrados.</td></tr>`;
    const auditSection = `
      <h2>Registro completo de alteracoes do dia</h2>
      <p class="small">Inclui todas as acoes de administradores, garcons e cozinheiros registradas durante o caixa.</p>
      <table>
        <thead><tr><th>Data/Hora</th><th>Quem</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead>
        <tbody>${auditRows}</tbody>
      </table>
    `;
    const extendedHtml = baseHtml.replace("</body>", `${auditSection}</div></body>`).replace("</div></div></body>", "</div></body>");
    openReceiptPopup(extendedHtml, "Permita pop-up para abrir o historico estendido.", "width=1100,height=900", {
      previewTitle: `Historico ESTENDIDO - Caixa ${state.cash.id}`,
      previewSubtitle: "Relatorio completo com todas as alteracoes"
    });
  }

  function printStoredCashClosure(closureId) {
    const closure = state.history90.find((h) => String(h.id) === String(closureId));
    if (!closure) {
      alert("Fechamento nao encontrado.");
      return;
    }
    printCashHistoryReport(closure, {
      printedBy: currentActor(),
      title: `Fechamento ${closure.cashId || closure.id}`,
      subtitle: `Registro ${closure.id}`
    });
  }

  function findComandaInHistory(comandaId) {
    for (const closure of state.history90 || []) {
      const comanda = (closure.commandas || []).find((c) => c.id === comandaId);
      if (comanda) return comanda;
    }
    return null;
  }

  function findComandaForDetails(comandaId) {
    return state.openComandas.find((c) => c.id === comandaId) || state.closedComandas.find((c) => c.id === comandaId) || findComandaInHistory(comandaId);
  }

  function renderComandaDetailsBox() {
    if (!uiState.comandaDetailsId) return "";
    const comanda = findComandaForDetails(uiState.comandaDetailsId);
    if (!comanda) {
      uiState.adminInlineEditComandaId = null;
      return "";
    }
    const viewer = getCurrentUser();
    if (!canActorAccessComanda(viewer, comanda)) {
      uiState.comandaDetailsId = null;
      return "";
    }
    const openEvent = (comanda.events || []).find((event) => event.type === "comanda_aberta");
    const creatorUser = state.users.find((u) => String(u.id) === String(comanda.createdBy));
    const creatorName = resolveComandaResponsibleName(comanda);
    const creatorRole = String(creatorUser?.role || openEvent?.actorRole || "").trim();
    const creatorRoleText = creatorRole ? ` (${roleLabel(creatorRole)})` : "";
    const isOpenComanda = state.openComandas.some((entry) => String(entry?.id || "") === String(comanda.id || ""));
    if (!isOpenComanda && String(uiState.adminInlineEditComandaId || "") === String(comanda.id || "")) {
      uiState.adminInlineEditComandaId = null;
    }
    const showCreatorForAdmin = isAdminOrDev(viewer);
    const showAdminControls = isAdminOrDev(viewer) && isOpenComanda;
    const showReadOnlyAdminNotice = isAdminOrDev(viewer) && !isOpenComanda;
    const inlineEditMode =
      showAdminControls && String(uiState.adminInlineEditComandaId || "") === String(comanda.id || "");

    const rows = (comanda.items || [])
      .map((item) => {
        const itemStatus =
          itemNeedsKitchen(item) && !item.canceled
            ? `${esc(kitchenStatusLabel(item.kitchenStatus || "fila"))} | ${esc(kitchenPriorityLabel(item.kitchenPriority || "normal"))}`
            : item.canceled
              ? "Cancelado"
              : item.delivered
                ? "Entregue"
                : "Pendente";
        const adminActions =
          showAdminControls && item.id
            ? `<td><div class="actions admin-item-actions"><button class="btn secondary compact-action" data-action="admin-edit-comanda-item" data-comanda-id="${esc(comanda.id)}" data-item-id="${esc(item.id)}">Editar</button><button class="btn danger compact-action" data-action="admin-remove-comanda-item" data-comanda-id="${esc(comanda.id)}" data-item-id="${esc(item.id)}">Remover</button></div></td>`
            : "";
        return `<tr><td>${esc(item.name)}</td><td>${item.qty}</td><td>${money(item.priceAtSale)}</td><td>${itemStatus}</td><td>${esc(item.waiterNote || "-")}${item.deliveryRequested ? ` | Entrega: ${esc(item.deliveryRecipient || "-")} @ ${esc(item.deliveryLocation || "-")}` : ""}</td>${adminActions}</tr>`;
      })
      .join("");
    const comandaEvents = (comanda.events || []).slice(-40).reverse();
    const events = comandaEvents
      .map((e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)}</td><td>${renderEventTypeTag(e.type)}</td><td>${esc(e.detail)}</td></tr>`)
      .join("");

    return `
      <div class="detail-box" style="margin-top:0.75rem;">
        <div class="detail-header">
          <h4>Detalhes da comanda ${esc(comanda.id)}</h4>
          <button class="btn secondary" data-action="close-comanda-details">Fechar</button>
        </div>
        <p class="note">Mesa: ${esc(comanda.table)} | Cliente: ${esc(comanda.customer || "-")} | Status: ${esc(comanda.status || "aberta")}</p>
        ${showCreatorForAdmin ? `<p class="note">Criada por: ${esc(creatorName)}${esc(creatorRoleText)}</p>` : ""}
        <p class="note">Criada em ${formatDateTime(comanda.createdAt)} ${comanda.closedAt ? `| Fechada em ${formatDateTime(comanda.closedAt)}` : ""}</p>
        <p class="note">Pagamento: ${esc(comandaPaymentText(comanda, { includeAmount: true, totalFallback: comandaTotal(comanda) }))} | Total: <b>${money(comandaTotal(comanda))}</b></p>
        ${showReadOnlyAdminNotice ? `<p class="note" style="margin-top:0.35rem;">Comanda fechada/historica: somente visualizacao de dados.</p>` : ""}
        ${showAdminControls
        ? inlineEditMode
          ? `<div class="actions" style="margin-top:0.5rem;"><button class="btn secondary" data-action="close-comanda-inline-edit">Voltar ao resumo</button></div><div style="margin-top:0.65rem;">${renderComandaCard(comanda, { forceExpanded: true })}</div>`
          : `<div class="actions" style="margin-top:0.5rem;"><button class="btn ok" data-action="open-comanda-edit-flow" data-comanda-id="${esc(comanda.id)}">Editar</button><button class="btn secondary" data-action="admin-edit-comanda" data-comanda-id="${esc(comanda.id)}">Editar dados da comanda</button><button class="btn ok" data-action="admin-add-comanda-item" data-comanda-id="${esc(comanda.id)}">Adicionar item pelo administrador</button></div><p class="note" style="margin-top:0.35rem;">As alteracoes registram: adicionado, alterado ou removido pelo administrador.</p>`
        : ""
      }
        ${inlineEditMode
        ? ""
        : `<div class="table-wrap" style="margin-top:0.5rem;">
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Status</th><th>Obs</th>${showAdminControls ? "<th>Acoes administrador</th>" : ""}</tr></thead>
            <tbody>${rows || `<tr><td colspan="${showAdminControls ? 6 : 5}">Sem itens.</td></tr>`}</tbody>
          </table>
        </div>`
      }
        <details class="compact-details" style="margin-top:0.5rem;">
          <summary>Acoes da comanda (${comandaEvents.length})</summary>
          <div class="table-wrap" style="margin-top:0.5rem;">
            <table class="history-table">
              <thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Detalhe</th></tr></thead>
              <tbody>${events || `<tr><td colspan="4">Sem eventos.</td></tr>`}</tbody>
            </table>
          </div>
        </details>
      </div>
    `;
  }

  function comandaUpdatedAt(comanda) {
    const lastEventAt = (comanda.events || []).length ? (comanda.events || []).slice(-1)[0]?.ts : null;
    return comanda.closedAt || lastEventAt || comanda.createdAt;
  }

  function comandaKitchenNotice(comanda) {
    const items = Array.isArray(comanda?.items) ? comanda.items : [];
    const hasMissing = items.some((item) => itemNeedsKitchen(item) && !item.canceled && (item.kitchenStatus || "fila") === "em_falta");
    if (hasMissing) {
      return { tone: "falta", text: "Aviso: cozinha marcou item em falta." };
    }
    const hasReady = items.some((item) => itemNeedsKitchen(item) && !item.canceled && isKitchenReadyForWaiter(item));
    if (hasReady) {
      return { tone: "pronto", text: "Aviso: ha item disponivel para entrega da cozinha." };
    }
    return null;
  }

  function renderComandaRecordsCompact(commandas, options = {}) {
    const limit = Number(options.limit || 60);
    const title = options.title || "Registros por Comanda";
    const keyPrefix = detailKey("comanda-records", options.keyPrefix || title);
    const showKitchenNotice = options.showKitchenNotice === true;
    const viewer = getCurrentUser();
    const showAdminInlineEdit = isAdminOrDev(viewer);
    const tone = options.tone === "laranja" ? "laranja" : options.tone === "azul" ? "azul" : "";
    const cardToneClass = tone ? ` comanda-lista-${tone}` : "";
    if (!commandas.length) {
      return `
        <div class="card${cardToneClass}">
          <h3>${esc(title)}</h3>
          <div class="empty" style="margin-top:0.75rem;">Sem registros de comandas para o filtro atual.</div>
        </div>
      `;
    }

    const ordered = [...commandas]
      .sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0))
      .slice(0, limit);
    return `
      <div class="card${cardToneClass}">
        <h3>${esc(title)}</h3>
        <p class="note">Cada comanda fica minimizada para evitar poluicao visual.</p>
        ${options.headerHtml ? options.headerHtml : ""}
        ${ordered
        .map((comanda) => {
          const validItems = (comanda.items || []).filter((i) => !i.canceled).length;
          const events = (comanda.events || []).slice(-20).reverse();
          const comandaDetailKey = detailKey(keyPrefix, comanda.id);
          const isClosed = String(comanda.status || "") === "finalizada" || String(comanda.status || "").includes("encerrada");
          const isOpenComanda = state.openComandas.some((entry) => String(entry?.id || "") === String(comanda.id || ""));
          const deliveryRequestedCount = (comanda.items || []).filter((item) => !item.canceled && item.deliveryRequested).length;
          const hasDeliveryRequested = isOpenComanda && deliveryRequestedCount > 0;
          const statusClass = isClosed ? "comanda-status-fechada" : "comanda-status-aberta";
          const statusText = isClosed ? "Fechada" : "Aberta";
          const kitchenNotice = !isClosed ? comandaKitchenNotice(comanda) : null;
          const kitchenBadgeCompact = !isClosed ? renderKitchenIndicatorBadge(comanda, true) : "";
          const waiterName = resolveComandaResponsibleName(comanda);
          const useAdminEditShortcut = showAdminInlineEdit && isOpenComanda;
          const comandaRowsSimple = (comanda.items || [])
            .map((item) => {
              const itemStatus =
                itemNeedsKitchen(item) && !item.canceled
                  ? `${esc(kitchenStatusLabel(item.kitchenStatus || "fila"))} | ${esc(kitchenPriorityLabel(item.kitchenPriority || "normal"))}`
                  : item.canceled
                    ? "Cancelado"
                    : item.delivered
                      ? "Entregue"
                      : "Pendente";
              return `<tr><td>${esc(item.name)}</td><td>${item.qty}</td><td>${money(item.priceAtSale)}</td><td>${itemStatus}</td><td>${esc(item.waiterNote || "-")}${item.deliveryRequested ? ` | Entrega: ${esc(item.deliveryRecipient || "-")} @ ${esc(item.deliveryLocation || "-")}` : ""}</td></tr>`;
            })
            .join("");
          return `
              <details class="compact-details ${statusClass}" data-persist-key="${esc(comandaDetailKey)}" style="margin-top:0.65rem;"${detailOpenAttr(comandaDetailKey)}>
                <summary>
                  <b>${esc(comanda.id)}</b> | <span class="tag ${isClosed ? "status-comanda-fechada" : "status-comanda-aberta"}">${statusText}</span>${hasDeliveryRequested ? ` | <span class="tag">Entrega solicitada (${deliveryRequestedCount})</span>` : ""}${kitchenBadgeCompact ? ` | ${kitchenBadgeCompact}` : ""} | Mesa/ref: ${esc(comanda.table || "-")} | Garcom: ${esc(waiterName)} | Cliente: ${esc(comanda.customer || "-")} | Itens: ${validItems} | Total: ${money(comandaTotal(comanda))}
                </summary>
                <div class="note" style="margin-top:0.45rem;">Atualizada em: ${formatDateTime(comandaUpdatedAt(comanda))}</div>
                ${hasDeliveryRequested ? `<div class="note" style="margin-top:0.35rem;">Comanda aberta com pedido para entrega.</div>` : ""}
                ${kitchenNotice ? `<div class="note ${kitchenNotice.tone === "pronto" ? "comanda-alerta-pronto" : "comanda-alerta-falta"}" style="margin-top:0.35rem;">${esc(kitchenNotice.text)}</div>` : ""}
                ${showAdminInlineEdit
              ? useAdminEditShortcut
                ? `<div class="actions" style="margin-top:0.5rem;"><button class="btn ok" data-action="open-comanda-edit-flow" data-comanda-id="${esc(comanda.id)}">Editar</button></div><p class="note" style="margin-top:0.35rem;">Clique em <b>Editar</b> para abrir esta comanda no modo garcom. No historico, as alteracoes ficam registradas como adicionado, alterado e removido pelo administrador.</p>`
                : `<p class="note" style="margin-top:0.35rem;">Comanda fechada/historica: somente visualizacao dos dados.</p><div class="table-wrap" style="margin-top:0.5rem;"><table><thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Status</th><th>Obs</th></tr></thead><tbody>${comandaRowsSimple || `<tr><td colspan="5">Sem itens.</td></tr>`}</tbody></table></div>`
              : ""
            }
                <div class="table-wrap" style="margin-top:0.5rem;">
                  <table class="history-table">
                    <thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Detalhe</th></tr></thead>
                    <tbody>
                      ${events.length
              ? events.map((e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName || "-")}</td><td>${renderEventTypeTag(e.type || "-")}</td><td>${esc(e.detail || "-")}</td></tr>`).join("")
              : `<tr><td colspan="4">Sem eventos registrados.</td></tr>`}
                    </tbody>
                  </table>
                </div>
                ${showAdminInlineEdit
              ? ""
              : `<div class="actions" style="margin-top:0.5rem;"><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${comanda.id}">Abrir detalhe completo</button></div>`
            }
              </details>
            `;
        })
        .join("")}
      </div>
    `;
  }

  function dedupeComandasById(commandas) {
    const map = new Map();
    for (const comanda of Array.isArray(commandas) ? commandas : []) {
      const id = String(comanda?.id || "").trim();
      if (!id) continue;
      const current = map.get(id);
      if (!current) {
        map.set(id, comanda);
        continue;
      }
      const incomingUpdated = new Date(comandaUpdatedAt(comanda) || 0).getTime();
      const currentUpdated = new Date(comandaUpdatedAt(current) || 0).getTime();
      if (incomingUpdated >= currentUpdated) {
        map.set(id, comanda);
      }
    }
    return [...map.values()];
  }

  function dedupeAuditEvents(events) {
    const map = new Map();
    for (const event of Array.isArray(events) ? events : []) {
      if (!event || typeof event !== "object") continue;
      const key = String(event.id || `${event.ts || ""}|${event.actorId || ""}|${event.type || ""}|${event.comandaId || ""}|${event.detail || ""}`);
      if (!map.has(key)) {
        map.set(key, event);
      }
    }
    return [...map.values()];
  }

  function summarizeRealtimeAction(event) {
    if (!event) return "-";
    const type = String(event.type || "");
    if (type === "comanda_aberta") return "Comanda aberta";
    if (type === "comanda_finalizada") return "Comanda finalizada";
    if (type === "item_add") return "Item adicionado";
    if (type === "item_cancelado") return "Item cancelado";
    if (type === "item_reduzido") return "Item reduzido";
    if (type === "admin_item_add") return "Adicionado pelo administrador";
    if (type === "admin_item_edit") return "Alterado pelo administrador";
    if (type === "admin_item_remove") return "Removido pelo administrador";
    if (type === "cozinha_status") return "Atualizacao da cozinha";
    if (type === "cozinha_recebido") return "Cozinha recebeu pedidos";
    if (type === "garcom_ciente_alerta") return "Garcom leu alerta";
    if (type === "admin_comanda_edit") return "Comanda alterada pelo administrador";
    if (type === "funcionario_add") return "Funcionario criado";
    if (type === "funcionario_edit") return "Funcionario alterado";
    if (type === "funcionario_delete") return "Funcionario removido";
    if (type === "produto_add") return "Produto criado";
    if (type === "produto_edit") return "Produto alterado";
    if (type === "produto_delete") return "Produto removido";
    if (type === "caixa_fechado") return "Caixa fechado";
    if (type === "caixa_novo") return "Novo caixa aberto";
    return eventTypeLabel(type);
  }

  function renderAdminHistory() {
    const currentAudit = state.auditLog.slice(0, 5000);
    const closures = state.history90;
    const closureAudit = closures.flatMap((closure) => (Array.isArray(closure.auditLog) ? closure.auditLog : []));
    const mergedAudit = dedupeAuditEvents([...currentAudit, ...closureAudit]).sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
    const displayedAuditAll = dedupeAuditEvents([...uiState.remoteMonitorEvents, ...mergedAudit])
      .sort((a, b) => new Date(b.ts || b.broadcastAt || 0) - new Date(a.ts || a.broadcastAt || 0))
      .slice(0, 1800);
    const closureComandas = closures.flatMap((closure) => closure.commandas || []);
    const openComandas = dedupeComandasById(state.openComandas).sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0));
    const closedCurrentComandas = dedupeComandasById(state.closedComandas).sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0));
    const archivedComandas = dedupeComandasById(closureComandas).sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0));
    const historyComandaSearch = String(uiState.adminHistoryComandaSearch || "").trim();
    const searchableComandas = dedupeComandasById([...openComandas, ...closedCurrentComandas, ...archivedComandas]);
    const searchableComandasById = new Map(
      searchableComandas.map((comanda) => [String(comanda?.id || "").trim(), comanda]).filter((entry) => Boolean(entry[0]))
    );
    const displayedAudit = displayedAuditAll.filter((event) => {
      if (!historyComandaSearch) return true;
      const comandaId = String(event?.comandaId || "").trim();
      if (!comandaId) return false;
      const comanda = searchableComandasById.get(comandaId);
      if (comanda) {
        return matchesComandaSearch(comanda, historyComandaSearch);
      }
      return comandaId.toLowerCase().includes(historyComandaSearch.toLowerCase());
    });
    const totalComandasHistorico = dedupeComandasById([...openComandas, ...closedCurrentComandas, ...archivedComandas]).sort(
      (a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0)
    ).length;
    const auditDetailsKey = detailKey("admin-history", "audit-day");
    const openCount = openComandas.length;
    const closedCount = closedCurrentComandas.length;
    const archivedCount = totalComandasHistorico;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Eventos em tempo real</h3>
          <p class="note">Eventos em tempo real + eventos preservados nos fechamentos de caixa.</p>
          <p class="note" style="margin-top:0.25rem;">Comandas abertas agora: <b>${openCount}</b> | Comandas fechadas no caixa atual: <b>${closedCount}</b> | Total de comandas no historico minimizado: <b>${archivedCount}</b></p>
          <details class="compact-details" data-persist-key="${esc(auditDetailsKey)}" style="margin-top:0.75rem;"${detailOpenAttr(auditDetailsKey)}>
            <summary>Ver alteracoes em tempo real (${displayedAudit.length})</summary>
            ${displayedAudit.length
        ? `<div class="table-wrap" style="margin-top:0.55rem;"><table class="history-table responsive-stack"><thead><tr><th>Quando</th><th>Quem</th><th>Acao</th><th>Comanda</th><th>Resumo</th><th>Abrir</th></tr></thead><tbody>${displayedAudit
          .map(
            (e) =>
              `<tr><td data-label="Quando">${formatDateTime(e.ts || e.broadcastAt)}</td><td data-label="Quem">${esc(e.actorName || "-")} (${esc(roleLabel(e.actorRole || "-"))})</td><td data-label="Acao">${esc(summarizeRealtimeAction(e))}</td><td data-label="Comanda">${esc(e.comandaId || "-")}</td><td data-label="Resumo">${esc(e.detail || "-")}</td><td data-label="Abrir">${e.comandaId ? `<button class="btn secondary compact-action" data-action="open-comanda-details" data-comanda-id="${e.comandaId}">Ver</button>` : "-"
              }</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.55rem;">Sem eventos registrados ainda.</div>`}
          </details>
          ${renderComandaDetailsBox()}
        </div>
        ${renderComandaRecordsCompact(openComandas.filter(c => !historyComandaSearch || matchesComandaSearch(c, historyComandaSearch)), {
          title: "Comandas abertas (caixa atual)",
          limit: 500,
          keyPrefix: "admin-history-comandas-open",
          tone: "azul",
          showKitchenNotice: true,
          headerHtml: `
            <div class="field" style="margin-top:0.75rem; margin-bottom:0.25rem;">
              <label>Buscar comanda nestas listas (numero, mesa ou referencia)</label>
              <input data-role="admin-history-comanda-search" value="${esc(uiState.adminHistoryComandaSearch)}" placeholder="Ex.: CMD-0005, mesa 7, joana..." />
            </div>
          `
        })}
      </div>
      <div style="margin-top:0.75rem;">
        ${renderComandaRecordsCompact(closedCurrentComandas, {
          title: "Comandas fechadas (caixa atual)",
          limit: 500,
          keyPrefix: "admin-history-comandas-closed-current",
          tone: "laranja"
        })}
      </div>
      <div class="card" style="margin-top:0.75rem;">
        <h3>Fechamentos de Caixa (90 dias)</h3>
        ${closures.length
        ? closures
          .map((h) => {
            const summary = h.summary || buildCashSummary(h.commandas || []);
            const closureDetailsKey = detailKey("admin-history", "cash-closure", h.id);
            return `<details class="compact-details" data-persist-key="${esc(closureDetailsKey)}" style="margin-top:0.65rem;"${detailOpenAttr(closureDetailsKey)}>
                  <summary><b>${esc(h.id)}</b> | Aberto: ${formatDateTimeWithDay(h.openedAt)} | Fechado: ${formatDateTimeWithDay(h.closedAt)} | ${summary.commandasCount} comandas | ${money(summary.total)}</summary>
                  <div class="actions" style="margin-top:0.6rem;">
                    <button class="btn secondary" data-action="print-cash-closure" data-id="${esc(h.id)}">Ver fechamento</button>
                  </div>
                  <div class="table-wrap" style="margin-top:0.6rem;">
                    <table>
                      <thead><tr><th>Comanda</th><th>Status</th><th>Total</th><th>Cliente</th><th>Abrir</th></tr></thead>
                      <tbody>${(h.commandas || [])
                .map(
                  (c) =>
                    `<tr><td>${esc(c.id)}</td><td>${esc(c.status)}</td><td>${money(comandaTotal(c))}</td><td>${esc(c.customer || "-")}</td><td><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`
                )
                .join("")}</tbody>
                    </table>
                  </div>
                </details>`;
          })
          .join("")
        : `<div class="empty" style="margin-top:0.75rem;">Nenhum fechamento realizado ainda.</div>`}
      </div>
    `;
  }

  function renderAdminCash() {
    const openInfo = `Caixa ${state.cash.id} aberto em ${formatDateTimeWithDay(state.cash.openedAt)}`;
    const pendingOpen = [...state.openComandas].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    const hasPendingOpen = pendingOpen.length > 0;
    const pendingPreview = pendingOpen
      .slice(0, 8)
      .map((comanda) => `${comanda.id} (${comanda.table || "-"})`)
      .join(" | ");
    return `
      <div class="grid">
        <div class="card">
          <h3>Fechar Caixa</h3>
          <p class="note">Solicita segunda autenticacao para evitar fechamento por engano.</p>
          <p class="note" style="margin-top:0.35rem;">${esc(openInfo)}</p>
          ${hasPendingOpen
        ? `<div class="note" style="margin-top:0.45rem;color:#8b2f3b;"><b>Bloqueado:</b> existe(m) ${pendingOpen.length} comanda(s) aberta(s). Feche todas antes de encerrar o caixa.${pendingPreview ? ` Ex.: ${esc(pendingPreview)}${pendingOpen.length > 8 ? " ..." : ""}` : ""}</div>`
        : `<div class="note" style="margin-top:0.45rem;color:#1e5f3a;">Todas as comandas estao fechadas. Caixa liberado para encerramento.</div>`
      }
          <form id="close-cash-form" class="form" style="margin-top:0.75rem;" autocomplete="off">
            <div class="field">
              <label>Login admin (2a confirmacao)</label>
              <input name="login" required placeholder="login do admin" />
            </div>
            <div class="field">
              <label>Senha admin</label>
              <input name="password" type="password" required placeholder="senha do admin" />
            </div>
            <button type="submit" class="btn danger" ${hasPendingOpen ? "disabled title=\"Feche todas as comandas abertas para continuar.\"" : ""}>Fechar Caixa Agora</button>
          </form>
          <div class="actions" style="margin-top:0.75rem;">
            <button type="button" class="btn secondary" data-action="print-cash-day-history">Ver historico do dia</button>
            <button type="button" class="btn secondary" data-action="print-cash-day-history-extended">Ver historico do dia estendido</button>
          </div>
          <p class="note" style="margin-top:0.35rem;">Relatorio simples: resumo do caixa, pagamentos e comandas do dia. No fechamento, o HTML do relatorio e arquivado automaticamente.</p>
        </div>
      </div>
    `;
  }

  function renderAdminCashHtmlArchive() {
    ensureLatestCashClosureHtmlReport();
    const reports = (state.cashHtmlReports || [])
      .map((entry, idx) => normalizeCashHtmlReportRecord(entry, idx))
      .sort((a, b) => new Date(b.closedAt || b.createdAt || 0) - new Date(a.closedAt || a.createdAt || 0));

    return `
      <div class="card">
        <h3>Arquivos HTML de Fechamento</h3>
        <p class="note">Cada fechamento de caixa gera um HTML igual ao relatorio que iria para impressao. Esses arquivos ficam salvos no sistema e sincronizados via Supabase.</p>
        ${reports.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="history-table"><thead><tr><th>Arquivo</th><th>Dia referencia</th><th>Caixa</th><th>Fechado em</th><th>Salvo em</th><th>Responsavel</th><th>Acoes</th></tr></thead><tbody>${reports
          .map(
            (report) =>
              `<tr><td>${esc(report.id)}</td><td>${esc(formatDateOnlySafe(report.referenceDay || report.openedAt || report.closedAt || report.createdAt || isoNow()))}</td><td>${esc(report.cashId || "-")}</td><td>${esc(formatDateTimeWithDay(report.closedAt || report.createdAt))}</td><td>${esc(formatDateTimeWithDay(report.createdAt || report.closedAt))}</td><td>${esc(report.createdByName || "-")} (${esc(roleLabel(report.createdByRole || "-"))})</td><td><div class="actions"><button class="btn secondary" data-action="open-cash-html-report" data-id="${esc(report.id)}">Abrir em nova aba</button></div></td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Nenhum HTML de fechamento salvo ainda.</div>`}
      </div>
    `;
  }

  function renderAdminMonitor() {
    const actor = getCurrentUser();
    const isDevView = actor?.role === "dev";
    const employees = state.users.filter((u) => u.role === "waiter" || u.role === "cook" || (isDevView && u.role === "admin"));
    const selected = uiState.monitorWaiterId;
    const kitchenRows = listActiveKitchenOrders()
      .filter((row) => matchesKitchenCollaborator(row, selected))
      .filter((row) => matchesKitchenRowSearch(row, uiState.adminKitchenSearch));
    const kitchenHistoryRows = [...(state.cookHistory || [])]
      .sort((a, b) => new Date(b.deliveredAt || b.updatedAt || 0) - new Date(a.deliveredAt || a.updatedAt || 0))
      .filter((row) => {
        if (selected === "all") return true;
        const selectedId = String(selected || "");
        if (!selectedId) return true;
        if (String(row?.cookId || "") === selectedId) return true;
        const comanda = findComandaForDetails(String(row?.comandaId || ""));
        if (!comanda) return false;
        if (String(comanda.createdBy || "") === selectedId) return true;
        return (comanda.events || []).some((event) => String(event.actorId || "") === selectedId);
      })
      .filter((row) => {
        const query = String(uiState.adminKitchenSearch || "").trim().toLowerCase();
        if (!query) return true;
        const comanda = findComandaForDetails(String(row?.comandaId || ""));
        const responsible = comanda ? resolveComandaResponsibleName(comanda) : "";
        return (
          String(row?.comandaId || "").toLowerCase().includes(query) ||
          String(row?.table || "").toLowerCase().includes(query) ||
          String(row?.itemName || "").toLowerCase().includes(query) ||
          String(row?.waiterNote || "").toLowerCase().includes(query) ||
          String(row?.cookName || "").toLowerCase().includes(query) ||
          String(kitchenStatusLabel(row?.status || "fila")).toLowerCase().includes(query) ||
          String(responsible || "").toLowerCase().includes(query) ||
          (comanda ? matchesComandaSearch(comanda, query) : false)
        );
      });
    const kitchenFila = kitchenRows.filter((row) => (row.item.kitchenStatus || "fila") === "fila").length;
    const kitchenCooking = kitchenRows.filter((row) => (row.item.kitchenStatus || "fila") === "cozinhando").length;
    const kitchenDelivered = kitchenHistoryRows.filter((row) => row.status === "entregue").length;
    const kitchenMissing = kitchenHistoryRows.filter((row) => row.status === "em_falta").length;
    const activeCardsHtml = kitchenRows
      .map((row) => {
        const responsible = resolveComandaResponsibleName(row.comanda);
        const status = row.item.kitchenStatus || "fila";
        const statusLabel = kitchenStatusLabel(status);
        const statusClass = status === "cozinhando" ? "cooking" : status === "em_falta" ? "missing" : status === "entregue" ? "done" : "queue";
        const priority = String(row.item.kitchenPriority || "normal");
        const priorityValue = priority === "normal" ? "comum" : priority;
        const priorityLabel = adminMonitorPriorityLabel(priorityValue);
        const priorityClass = priorityValue === "maxima" ? "max" : priorityValue === "alta" ? "high" : "normal";
        const statusActions = `
          <button class="btn secondary compact-action ${status === "cozinhando" ? "is-active" : ""}" data-action="cook-status" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-status="cozinhando" ${status === "cozinhando" ? "disabled" : ""}>Cozinhando</button>
          <button class="btn danger compact-action ${status === "em_falta" ? "is-active" : ""}" data-action="cook-status" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-status="em_falta" ${status === "em_falta" ? "disabled" : ""}>Em falta</button>
          <button class="btn ok compact-action ${status === "entregue" ? "is-active" : ""}" data-action="cook-status" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-status="entregue" ${status === "entregue" ? "disabled" : ""}>Entregue</button>
        `;
        const priorityActions = `
          <button class="btn secondary compact-action ${priorityValue === "comum" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-priority="comum" ${priorityValue === "comum" ? "disabled" : ""}>Media</button>
          <button class="btn warn compact-action ${priorityValue === "alta" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-priority="alta" ${priorityValue === "alta" ? "disabled" : ""}>Alta</button>
          <button class="btn danger compact-action ${priorityValue === "maxima" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${esc(row.comanda.id)}" data-item-id="${esc(row.item.id)}" data-priority="maxima" ${priorityValue === "maxima" ? "disabled" : ""}>Altissima</button>
        `;
        const deliveryInfo = row.item.deliveryRequested
          ? `${row.item.deliveryRecipient || "-"} | ${row.item.deliveryLocation || "-"}`
          : "Balcao/Mesa";
        return `
          <article class="monitor-order-card status-${statusClass}">
            <div class="monitor-order-head">
              <div>
                <h5>${esc(row.item.name || "-")} x${row.item.qty}</h5>
                <div class="monitor-order-pills">
                  <span class="monitor-order-pill">Comanda ${esc(row.comanda.id)}</span>
                  <span class="monitor-order-pill">Mesa/ref ${esc(row.comanda.table || "-")}</span>
                  <span class="monitor-order-pill">Responsavel ${esc(responsible)}</span>
                  <span class="monitor-order-pill priority ${priorityClass}">${esc(priorityLabel)}</span>
                  ${row.item.deliveryRequested ? `<span class="monitor-order-pill delivery">Entrega</span>` : ""}
                </div>
              </div>
              <span class="monitor-order-status ${statusClass}">${esc(statusLabel)}</span>
            </div>
            <details class="monitor-order-details">
              <summary>Expandir item</summary>
              <div class="monitor-order-meta">
                <div class="monitor-meta-box"><span>Atualizado em</span><b>${esc(formatDateTime(row.item.kitchenStatusAt || row.item.createdAt))}</b></div>
                <div class="monitor-meta-box"><span>Entrega</span><b>${esc(deliveryInfo)}</b></div>
                ${row.item.waiterNote
            ? `<div class="monitor-meta-box is-full"><span>Obs do pedido</span><b>${esc(row.item.waiterNote)}</b></div>`
            : ""
          }
              </div>
              <div class="monitor-order-actions">${statusActions}</div>
              <div class="monitor-order-priority">${priorityActions}</div>
            </details>
            <div class="monitor-order-collapsed-note">
              Item minimizado. Clique em "Expandir item" para editar status e prioridade.
            </div>
          </article>
        `;
      })
      .join("");
    const historyRowsHtml = kitchenHistoryRows
      .slice(0, 180)
      .map((row) => {
        const comanda = findComandaForDetails(String(row?.comandaId || ""));
        const responsible = comanda ? resolveComandaResponsibleName(comanda) : "-";
        return `<tr><td>${formatDateTime(row.deliveredAt || row.updatedAt)}</td><td>${esc(row.comandaId || "-")}</td><td>${esc(row.table || "-")}</td><td>${esc(responsible)}</td><td>${esc(row.itemName || "-")}</td><td>${row.qty}</td><td>${esc(kitchenStatusLabel(row.status || "fila"))}</td><td>${esc(row.cookName || "-")}</td></tr>`;
      })
      .join("");

    return `
      <div class="grid">
        <div class="card">
          <h3>Monitor Pedido x Cozinha</h3>
          <p class="note">Painel restrito ao relacionamento entre pedidos e respostas da cozinha, com leitura simples para computador e celular.</p>
          <div class="field" style="margin-top:0.75rem;">
            <label>Filtrar colaborador</label>
            <select data-action="monitor-filter" data-role="monitor-filter">
              <option value="all" ${selected === "all" ? "selected" : ""}>Todos</option>
              ${employees
        .map((w) => `<option value="${w.id}" ${String(w.id) === String(selected) ? "selected" : ""}>${esc(w.name)}</option>`)
        .join("")}
            </select>
          </div>
          <div class="field" style="margin-top:0.5rem;">
            <label>Buscar pedido/cozinha</label>
            <input data-role="admin-kitchen-search" value="${esc(uiState.adminKitchenSearch)}" placeholder="Comanda, mesa/ref, item, observacao, garcom ou cozinheiro" />
          </div>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Na fila</p><b>${kitchenFila}</b></div>
            <div class="kpi"><p>Em preparo</p><b>${kitchenCooking}</b></div>
            <div class="kpi"><p>Entregues (hist.)</p><b>${kitchenDelivered}</b></div>
            <div class="kpi"><p>Em falta (hist.)</p><b>${kitchenMissing}</b></div>
          </div>
          <div class="grid cols-2" style="margin-top:0.8rem;">
            <div class="card">
              <h4>Pedidos aguardando resposta da cozinha</h4>
              <p class="note">Mostra somente pedidos ativos com fluxo de cozinha. O administrador pode atualizar status e prioridade aqui.</p>
              ${kitchenRows.length
        ? `<div class="monitor-orders-grid">${activeCardsHtml}</div>`
        : `<div class="empty" style="margin-top:0.65rem;">Sem pedidos ativos para o filtro aplicado.</div>`}
            </div>
            <div class="card">
              <h4>Respostas recentes da cozinha</h4>
              <p class="note">Historico resumido de respostas ja registradas no caixa atual.</p>
              ${kitchenHistoryRows.length
        ? `<div class="table-wrap" style="margin-top:0.65rem;"><table class="history-table responsive-stack"><thead><tr><th>Quando</th><th>Comanda</th><th>Mesa/ref</th><th>Responsavel</th><th>Item</th><th>Qtd</th><th>Resposta cozinha</th><th>Cozinheiro</th></tr></thead><tbody>${historyRowsHtml}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.65rem;">Sem respostas da cozinha para o filtro aplicado.</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderAdminComandas() {
    const tabs = [
      { key: "abrir", label: "Abrir pedido/comanda" },
      { key: "abertas", label: "Comandas abertas" },
      { key: "cozinha", label: "Fila cozinha" },
      { key: "consulta", label: "Consulta precos" },
      { key: "historico", label: "Historico" }
    ];

    let content = "";
    switch (uiState.waiterTab) {
      case "abrir":
        content = renderWaiterCreateComanda();
        break;
      case "abertas":
        content = renderWaiterOpenComandas();
        break;
      case "cozinha":
        content = renderWaiterKitchen();
        break;
      case "consulta":
        content = renderWaiterCatalog();
        break;
      case "historico":
        content = renderWaiterHistory();
        break;
      default:
        content = renderWaiterCreateComanda();
    }

    return `
      <div class="card">
        <h3>Comandas (modo garcom)</h3>
        <p class="note">Administrador pode abrir e operar comandas com o mesmo fluxo do garcom.</p>
      </div>
      ${renderTabs("waiter", tabs, uiState.waiterTab)}
      ${content}
    `;
  }

  function renderAdmin(user) {
    if (uiState.adminTab === "avulsa") {
      uiState.adminTab = "dashboard";
    } else if (uiState.adminTab === "apagar") {
      uiState.adminTab = "financeiro";
    }
    const tabs = [
      { key: "dashboard", label: "Dashboard" },
      { key: "comandas", label: "Comandas" },
      { key: "produtos", label: "Produtos" },
      { key: "funcionarios", label: "Funcionarios" },
      { key: "monitor", label: "Monitor" },
      { key: "financeiro", label: "Financas" },
      { key: "caixa", label: "Fechar Caixa" }
    ];

    let content = "";
    switch (uiState.adminTab) {
      case "comandas":
        content = renderAdminComandas();
        break;
      case "produtos":
        content = renderAdminProducts();
        break;
      case "funcionarios":
        content = renderAdminEmployees();
        break;
      case "monitor":
        content = renderAdminMonitor();
        break;
      case "financeiro":
        content = renderAdminFinance();
        break;
      case "caixa":
        content = renderAdminCash();
        break;
      default:
        content = renderAdminDashboard();
    }

    app.innerHTML = `
      <div class="container app-shell role-admin">
        ${renderInstallBanner()}
        ${renderTopBar(user)}
        ${renderTabs("admin", tabs, uiState.adminTab)}
        ${content}
        ${renderComandaItemSelectorModal()}
      </div>
    `;
  }

  function renderDevDevices() {
    const rows = listDevicePresenceRows();
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Dispositivos online</h3>
          <p class="note">Atualizacao em tempo real de sessoes ativas no sistema (admin, garcom, cozinha e dev).</p>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Sessoes ativas</p><b>${rows.length}</b></div>
            <div class="kpi"><p>Ultimo ping local</p><b>${formatDateTime(isoNow())}</b></div>
          </div>
          ${rows.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="history-table"><thead><tr><th>Sessao</th><th>Usuario</th><th>Papel</th><th>Dispositivo</th><th>Navegador</th><th>Plataforma</th><th>Tela</th><th>Ultimo sinal</th></tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr><td>${esc(row.sessionId)}</td><td>${esc(row.userName || "-")}</td><td>${esc(roleLabel(row.role || "-"))}</td><td>${esc(row.deviceType || "-")}${row.isSelf ? " (este)" : ""}</td><td>${esc(row.browser || "-")}</td><td>${esc(row.platform || "-")}</td><td>${esc(row.viewport || "-")}</td><td>${esc(formatDateTime(row.seenAt))}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Sem dispositivos ativos no momento.</div>`}
        </div>
        <div class="card">
          <h3>Eventos recentes</h3>
          ${uiState.remoteMonitorEvents.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="history-table"><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${uiState.remoteMonitorEvents
          .slice(0, 120)
          .map(
            (event) =>
              `<tr><td>${formatDateTime(event.ts || event.broadcastAt)}</td><td>${esc(event.actorName || "-")}</td><td>${renderEventTypeTag(event.type || "-")}</td><td>${esc(event.comandaId || "-")}</td><td>${esc(event.detail || "-")}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Sem eventos remotos recebidos ainda.</div>`}
        </div>
      </div>
    `;
  }

  function renderDev(user) {
    if (uiState.devTab === "avulsa") {
      uiState.devTab = "dashboard";
    } else if (uiState.devTab === "apagar") {
      uiState.devTab = "financeiro";
    }
    const tabs = [
      { key: "dashboard", label: "Dashboard" },
      { key: "comandas", label: "Comandas" },
      { key: "produtos", label: "Produtos" },
      { key: "funcionarios", label: "Funcionarios" },
      { key: "monitor", label: "Monitor" },
      { key: "devices", label: "Dispositivos" },
      { key: "financeiro", label: "Financas" },
      { key: "caixa", label: "Fechar Caixa" },
      { key: "arquivos_html", label: "Arquivos HTML" }
    ];

    let content = "";
    switch (uiState.devTab) {
      case "comandas":
        content = renderAdminComandas();
        break;
      case "produtos":
        content = renderAdminProducts();
        break;
      case "funcionarios":
        content = renderAdminEmployees();
        break;
      case "monitor":
        content = renderAdminMonitor();
        break;
      case "devices":
        content = renderDevDevices();
        break;
      case "financeiro":
        content = renderAdminFinance();
        break;
      case "caixa":
        content = renderAdminCash();
        break;
      case "arquivos_html":
        content = renderAdminCashHtmlArchive();
        break;
      default:
        content = renderAdminDashboard();
    }

    app.innerHTML = `
      <div class="container app-shell role-dev">
        ${renderInstallBanner()}
        ${renderTopBar(user)}
        ${renderTabs("dev", tabs, uiState.devTab)}
        ${content}
        ${renderComandaItemSelectorModal()}
      </div>
    `;
  }

  function renderWaiterHome() {
    return `
      <div class="card">
        <h3>Inicio do Garcom</h3>
        <p class="note">Escolha uma acao:</p>
        <div class="actions" style="margin-top:0.75rem;">
          <button class="btn primary" data-action="set-tab" data-role="waiter" data-tab="abrir">Abrir pedido/comanda</button>
          <button class="btn secondary" data-action="set-tab" data-role="waiter" data-tab="abertas">Comandas abertas</button>
        </div>
      </div>
    `;
  }

  function renderWaiterCreateComanda() {
    const actor = currentActor();
    const visibleOpenComandas = listOpenComandasForActor(actor);
    const activeComanda = uiState.waiterActiveComandaId
      ? visibleOpenComandas.find((comanda) => String(comanda.id) === String(uiState.waiterActiveComandaId)) || null
      : null;
    if (uiState.waiterActiveComandaId && !activeComanda) {
      uiState.waiterActiveComandaId = null;
    }
    const visibleQueue = listPendingKitchenItems(actor);
    const visibleClosedToday = actor?.role === "waiter" ? state.closedComandas.filter((comanda) => canActorAccessComanda(actor, comanda)) : state.closedComandas;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Abrir Pedido/Comanda</h3>
          <p class="note">Depois de criar, a comanda continua aberta ate o fechamento pelo garcom.</p>
          <p class="note" style="margin-top:0.25rem;">A observacao para a cozinha deve ser informada ao adicionar cada item do pedido.</p>
          <form id="create-comanda-form" class="form" style="margin-top:0.75rem;">
            <div class="field">
              <label>Mesa ou referencia</label>
              <input name="table" placeholder="Mesa 07" />
            </div>
            <div class="field">
              <label>Nome do cliente (opcional)</label>
              <input name="customer" placeholder="Cliente" />
            </div>
            <div class="field">
              <label><input name="isAvulsa" type="checkbox" /> Marcar como venda avulsa</label>
              <div class="note">Ao marcar, a comanda e aberta como avulsa sem exigir mesa/referencia.</div>
            </div>
            <button class="btn primary" type="submit">Criar Comanda</button>
          </form>
        </div>
        ${activeComanda
        ? `<div class="card">
          <h3>Comanda ativa agora: ${esc(activeComanda.id)}</h3>
          <p class="note">Adicione pedidos, acompanhe a cozinha e finalize quando necessario.</p>
          <div class="actions" style="margin-top:0.55rem;">
            <button class="btn secondary compact-action" data-action="minimize-open-comanda" data-comanda-id="${activeComanda.id}">Minimizar pedido aberto</button>
          </div>
          <div style="margin-top:0.75rem;">${renderComandaCard(activeComanda, { forceExpanded: true })}</div>
        </div>`
        : `<div class="card">
          <h3>Resumo rapido</h3>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Abertas</p><b>${visibleOpenComandas.length}</b></div>
            <div class="kpi"><p>Fila Cozinha</p><b>${visibleQueue.length}</b></div>
            <div class="kpi"><p>Fechadas hoje</p><b>${visibleClosedToday.length}</b></div>
          </div>
        </div>`
      }
      </div>
    `;
  }

  function renderQuickSale(roleContext) {
    const title = roleContext === "admin" ? "Venda Avulsa (Admin)" : roleContext === "waiter" ? "Venda Avulsa (Garcom)" : "Venda Avulsa";
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>${title}</h3>
          <p class="note">Venda rapida. Itens com fluxo de cozinha (Cozinha e Ofertas dependentes) entram na fila da cozinha com as mesmas regras da comanda.</p>
          <form id="quick-sale-form" data-role="quick-sale-form" data-context="${roleContext}" class="form" style="margin-top:0.75rem;">
            <div class="grid cols-2">
              <div class="field">
                <label>Categoria</label>
                <select name="category" data-role="quick-category">
                  ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
                </select>
              </div>
              <div class="field">
                <label>Produto</label>
                <select name="productId" data-role="quick-product"></select>
              </div>
            </div>
            <div class="grid cols-2">
              <div class="field">
                <label>Quantidade</label>
                <input name="qty" type="number" min="1" value="1" required />
              </div>
              <div class="field">
                <label>Pagamento</label>
                <select name="paymentMethod" required>
                  ${PAYMENT_METHODS.filter((p) => p.value !== "fiado").map((m) => `<option value="${m.value}">${m.label}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="field">
              <label>Cliente/recebedor (opcional)</label>
              <input name="customer" placeholder="Nome do cliente" />
            </div>
            <div class="field">
              <label>Observacao do pedido (opcional)</label>
              <input name="note" placeholder="Ex: sem cebola, consumo no balcao" />
            </div>
            <div class="field" data-role="quick-delivery-box" style="display:none;">
              <label><input name="isDelivery" data-role="quick-delivery-check" type="checkbox" /> Pedido para entrega</label>
              <div class="grid cols-2" data-role="quick-delivery-fields" style="display:none;">
                <div class="field">
                  <label>Receber por</label>
                  <input name="deliveryRecipient" placeholder="Nome de quem recebe" />
                </div>
                <div class="field">
                  <label>Local da entrega</label>
                  <input name="deliveryLocation" placeholder="Endereco/local de entrega" />
                </div>
              </div>
            </div>
            <div class="field">
              <label><input name="paidConfirm" type="checkbox" ${uiState.quickSalePaidConfirm ? "checked" : ""} /> Venda paga e conferida</label>
            </div>
            <div class="note" data-role="quick-kitchen-note">Para categorias fora de cozinha, a venda fecha imediatamente.</div>
            <button class="btn primary" type="submit">Finalizar Venda Avulsa</button>
          </form>
        </div>
      </div>
    `;
  }

  function renderItemRow(comanda, item) {
    const flags = [];
    const isMissing = itemNeedsKitchen(item) && !item.canceled && (item.kitchenStatus || "fila") === "em_falta";
    const subtotal = parseNumber(item.qty || 0) * parseNumber(item.priceAtSale || 0);
    if (item.canceled) flags.push('<span class="tag">Cancelado</span>');
    if (item.delivered) flags.push('<span class="tag">Entregue</span>');
    if (item.deliveryRequested) flags.push('<span class="tag">Entrega</span>');
    const tone = waiterItemHighlightTone(item);
    if (tone === "missing") flags.unshift('<span class="tag item-flag-missing">Em falta (nao cobrar)</span>');
    if (tone === "new") flags.unshift('<span class="tag item-flag-new">Novo pedido</span>');
    if (tone === "ready") flags.unshift('<span class="tag item-flag-ready">Pronto para entrega</span>');
    if (!item.delivered && !item.canceled && itemNeedsKitchen(item)) {
      const remMin = Math.ceil(kitchenRemainingMs(item) / 60000);
      flags.push(`<span class="tag">Fila cozinha ~${remMin} min</span>`);
      flags.push(`<span class="tag">Status: ${esc(kitchenStatusLabel(item.kitchenStatus || "fila"))}</span>`);
      flags.push(`<span class="tag">Prioridade: ${esc(kitchenPriorityLabel(item.kitchenPriority || "normal"))}</span>`);
      if (item.kitchenStatusByName) {
        flags.push(`<span class="tag">${esc(item.kitchenStatusByName)}</span>`);
      }
    }

    return `
      <div class="item-row ${tone ? `item-row-${tone}` : ""}">
        <div><b>${esc(item.name)}</b> x${item.qty} | ${money(item.priceAtSale)} un | ${isMissing ? `<span class="item-subtotal-missing">Subtotal nao cobrado</span>` : `Subtotal ${money(subtotal)}`}</div>
        <div class="note">Categoria: ${esc(item.category)} | Criado em: ${formatDateTime(item.createdAt)}</div>
        ${item.waiterNote ? `<div class="note">Obs do pedido: ${esc(item.waiterNote)}</div>` : ""}
        ${item.deliveryRequested ? `<div class="note"><b>Entrega:</b> ${esc(item.deliveryRecipient || "-")} | ${esc(item.deliveryLocation || "-")}</div>` : ""}
        ${item.canceled ? `<div class="note">Cancelamento: ${esc(item.cancelReason || "-")} ${item.cancelNote ? `| ${esc(item.cancelNote)}` : ""}</div>` : ""}
        <div class="actions">
          ${flags.join(" ")}
        </div>
      </div>
    `;
  }

  function renderFinalizePanel(comanda) {
    const total = comandaTotal(comanda);
    const totalFixed = Number(total || 0).toFixed(2);
    const methodOptions = PAYMENT_METHODS.map((m) => `<option value="${m.value}">${m.label}</option>`).join("");
    return `
      <form class="card form" data-role="finalize-form" data-comanda-id="${comanda.id}">
        <h4>Finalizacao da comanda ${esc(comanda.id)}</h4>
        <div class="note">Confira dados e escolha uma ou mais formas de pagamento. A soma deve bater com o total da comanda.</div>
        <div class="grid cols-2">
          <div class="field">
            <label>Pagamento principal</label>
            <select name="paymentMethodPrimary" data-role="payment-method">
              ${methodOptions}
            </select>
          </div>
          <div class="field">
            <label>Valor principal</label>
            <input name="paymentAmountPrimary" data-role="payment-amount" value="${totalFixed}" />
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>Pagamento complementar 1 (opcional)</label>
            <select name="paymentMethodExtra1" data-role="payment-method">
              <option value="">Nao usar</option>
              ${methodOptions}
            </select>
          </div>
          <div class="field">
            <label>Valor complementar 1</label>
            <input name="paymentAmountExtra1" data-role="payment-amount" value="0" />
          </div>
        </div>
        <div class="grid cols-2">
          <div class="field">
            <label>Pagamento complementar 2 (opcional)</label>
            <select name="paymentMethodExtra2" data-role="payment-method">
              <option value="">Nao usar</option>
              ${methodOptions}
            </select>
          </div>
          <div class="field">
            <label>Valor complementar 2</label>
            <input name="paymentAmountExtra2" data-role="payment-amount" value="0" />
          </div>
        </div>
        <div class="note" data-role="payment-breakdown-note">Divisao ainda nao conferida.</div>
        <div class="field" data-role="fiado-box" style="display:none;">
          <label>Nome do cliente (obrigatorio no fiado)</label>
          <input name="fiadoCustomer" placeholder="Nome completo" />
        </div>
        <div class="field" data-role="pix-box" style="display:none;">
          <label>QR Pix (gerado automaticamente)</label>
          <div class="card" style="display:grid; place-items:center; gap:0.5rem;">
            <canvas data-role="pix-canvas"></canvas>
            <div class="note" data-role="pix-code"></div>
          </div>
        </div>
        <div class="field" data-role="manual-check-box">
          <label><input type="checkbox" name="manualCheck" data-role="manual-check" /> Pagamento conferido manualmente com cliente</label>
          <div class="note" data-role="manual-check-note" style="display:none;">No fiado, essa confirmacao e dispensada.</div>
        </div>
        <div class="note"><b>Valor total:</b> ${money(total)}</div>
        <button class="btn ok" type="submit">Confirmar finalizacao</button>
      </form>
    `;
  }

  function renderComandaCard(comanda, options = {}) {
    const forceExpanded = Boolean(options.forceExpanded);
    const forceCollapsed = Boolean(options.forceCollapsed);
    const total = comandaTotal(comanda);
    const isCollapsed = forceExpanded ? false : forceCollapsed ? true : isWaiterComandaCollapsed(comanda.id);
    const isFinalizeOpen = Boolean(uiState.finalizeOpenByComanda[comanda.id]);
    const kitchenIndicator = renderKitchenIndicatorBadge(comanda);
    const hasKitchenItems = (comanda.items || []).some((item) => itemNeedsKitchen(item) && !item.canceled);
    const validItemsCount = (comanda.items || []).filter((item) => !item.canceled).length;
    const actor = getCurrentUser();
    const canResolveIndicator = actor && actor.role === "waiter" && hasKitchenItems && kitchenIndicator;
    const canToggleCollapse = !forceExpanded && !forceCollapsed;
    const draftItems = getWaiterDraftItems(comanda.id);
    const tableRef = comanda.table || "-";
    const deliveryRequestedCount = (comanda.items || []).filter((item) => !item.canceled && item.deliveryRequested).length;
    const hasDeliveryRequested = deliveryRequestedCount > 0;

    return `
      <div class="comanda-card ${isCollapsed ? "is-collapsed" : ""} ${forceExpanded ? "is-focused" : ""}">
        <div class="comanda-header">
          <div>
            <div class="comanda-identity-box">
              <div class="comanda-identity-row">
                <span class="comanda-identity-label">Comanda</span>
                <span class="comanda-identity-id">${esc(comanda.id)}</span>
              </div>
              <div class="comanda-identity-row">
                <span class="comanda-identity-label">Mesa/Ref.</span>
                <span class="comanda-identity-table">${esc(tableRef)}</span>
              </div>
            </div>
            ${kitchenIndicator ? `<div style="margin-top:0.3rem;">${kitchenIndicator}</div>` : ""}
            <p class="note comanda-meta-note">Garcom: ${esc(resolveComandaResponsibleName(comanda))} | Cliente: ${esc(comanda.customer || "Nao informado")} | Aberta em ${formatDateTime(comanda.createdAt)}</p>
            <p class="note">Total atual: <b>${money(total)}</b></p>
          </div>
          ${canToggleCollapse ? `<button class="btn secondary" data-action="toggle-comanda-collapse" data-comanda-id="${comanda.id}">${isCollapsed ? "Expandir" : "Minimizar"}</button>` : ""}
        </div>

        ${!isCollapsed && comanda.notes?.length ? `<div class="note">Obs da comanda: ${comanda.notes.map((n) => esc(n)).join(" | ")}</div>` : ""}
        ${!isCollapsed && canResolveIndicator ? `<div class="actions indicator-actions"><button class="btn secondary" data-action="resolve-kitchen-indicator" data-comanda-id="${comanda.id}" data-mode="entendi">Entendi o alerta</button></div>` : ""}
        ${!isCollapsed && validItemsCount
        ? `<div class="actions comanda-item-icon-actions"><button class="btn icon-action-btn plus" data-action="open-item-selector" data-comanda-id="${comanda.id}" data-mode="increment" title="Adicionar quantidade em item" aria-label="Adicionar quantidade em item">+</button><button class="btn icon-action-btn cancel" data-action="open-item-selector" data-comanda-id="${comanda.id}" data-mode="cancel" title="Devolver/cancelar quantidade" aria-label="Devolver ou cancelar quantidade">x</button></div>`
        : ""
      }

        ${isCollapsed
        ? `<div class="note">Itens: <b>${validItemsCount}</b> | ${forceCollapsed ? "Modo leitura rapida ativado para comandas abertas." : 'Toque em "Expandir" para detalhes.'}${hasDeliveryRequested ? ` Pedido para entrega: <b>${deliveryRequestedCount}</b>.` : ""}</div>${kitchenIndicator ? `<div style="margin-top:0.35rem;">${renderKitchenIndicatorBadge(comanda, false)}</div>` : ""}${forceCollapsed
          ? `<div class="actions"><button class="btn secondary compact-action" data-action="open-comanda-on-create" data-comanda-id="${comanda.id}">Abrir no painel de pedido</button></div>`
          : ""
        }`
        : `
        <div class="item-list">
          ${(comanda.items || []).length ? (comanda.items || []).map((item) => renderItemRow(comanda, item)).join("") : `<div class="empty">Sem itens ainda.</div>`}
        </div>

        <form class="form compact" data-role="add-item-form" data-comanda-id="${comanda.id}">
          <h4>Adicionar item</h4>
          <div class="grid cols-2">
            <div class="field">
              <label>Categoria</label>
              <select name="category" data-role="item-category">
                ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label>Produto</label>
              <select name="productId" data-role="item-product"></select>
            </div>
          </div>
          <div class="grid cols-2">
            <div class="field">
              <label>Quantidade</label>
              <input name="qty" type="number" min="1" value="1" required />
            </div>
            <div class="field" data-role="kitchen-note-box" style="display:none;">
              <label>Observacao para cozinha</label>
              <input name="waiterNote" data-role="kitchen-note-input" placeholder="Ex: sem cebola, ponto da carne, alergia..." />
            </div>
          </div>
          <div class="field" data-role="delivery-box" style="display:none;">
            <label><input type="checkbox" name="isDelivery" data-role="delivery-check" /> Pedido para entrega</label>
            <div class="grid cols-2" data-role="delivery-fields" style="display:none;">
              <div class="field">
                <label>Receber por</label>
                <input name="deliveryRecipient" placeholder="Nome de quem recebe" />
              </div>
              <div class="field">
                <label>Local da entrega</label>
                <input name="deliveryLocation" placeholder="Endereco/local de entrega" />
              </div>
            </div>
          </div>
          <div class="note" data-role="kitchen-estimate">Tempo estimado cozinha: -</div>
          ${draftItems.length
          ? `<div class="card comanda-draft-box"><b>Itens selecionados (${draftItems.length})</b><div class="comanda-draft-list">${draftItems
            .map(
              (draft, index) =>
                `<div class="comanda-draft-row"><span>${esc(draft.category)} | ${esc(state.products.find((p) => p.id === draft.productId && p.category === draft.category)?.name || `Produto ${draft.productId}`)} x${draft.qty}${draft.waiterNote ? ` | Obs: ${esc(draft.waiterNote)}` : ""}${draft.isDelivery ? ` | Entrega: ${esc(draft.deliveryRecipient || "-")} @ ${esc(draft.deliveryLocation || "-")}` : ""}</span><button type="button" class="btn danger compact-action" data-action="remove-draft-item" data-comanda-id="${comanda.id}" data-index="${index}">Remover</button></div>`
            )
            .join("")}</div></div>`
          : `<div class="note">Nenhum item selecionado para envio em lote.</div>`
        }
          <div class="actions draft-actions">
            <button class="btn secondary compact-action" type="button" data-action="queue-draft-item" data-comanda-id="${comanda.id}">Selecionar</button>
            <button class="btn primary compact-action" type="submit">${draftItems.length ? "Adicionar lote" : "Adicionar"}</button>
          </div>
        </form>
        `
      }

        ${!isCollapsed
        ? `<div class="actions">
          <button class="btn secondary" data-action="add-comanda-note" data-comanda-id="${comanda.id}">Adicionar observacao</button>
          <button class="btn secondary" data-action="print-comanda" data-comanda-id="${comanda.id}">Ver cupom</button>
          <button class="btn primary" data-action="toggle-finalize" data-comanda-id="${comanda.id}">${isFinalizeOpen ? "Fechar painel" : "Finalizar comanda"}</button>
        </div>`
        : ""
      }

        ${!isCollapsed && isFinalizeOpen ? renderFinalizePanel(comanda) : ""}
      </div>
    `;
  }

  function renderWaiterOpenComandas() {
    const actor = currentActor();
    const isWaiterActor = actor?.role === "waiter";
    const visibleOpenComandas = listOpenComandasForActor(actor);
    if (!visibleOpenComandas.length) {
      return `<div class="empty">Nenhuma comanda aberta no momento.</div>`;
    }

    const sorted = [...visibleOpenComandas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const filtered = sorted.filter((c) => matchesComandaSearch(c, uiState.waiterComandaSearch));
    let newCount = 0;
    let readyCount = 0;
    for (const comanda of filtered) {
      for (const item of comanda.items || []) {
        const tone = waiterItemHighlightTone(item);
        if (tone === "new") newCount += 1;
        if (tone === "ready") readyCount += 1;
      }
    }

    return `
      <div class="card">
        <div class="field">
          <label>Busca por comanda (mesa/referencia/cliente/codigo)</label>
          <input data-role="waiter-search" value="${esc(uiState.waiterComandaSearch)}" placeholder="Ex: Mesa 7, CMD-0001, Joao" />
        </div>
        <p class="note" style="margin-top:0.5rem;">No menu de comandas abertas, ${isWaiterActor ? "ficam visiveis apenas as comandas sob responsabilidade do usuario logado." : "todas as comandas ficam disponiveis neste modo."} Destaques: amarelo (pedido novo) e verde (pronto para entrega).</p>
        <div class="kpis" style="margin-top:0.65rem;">
          <div class="kpi"><p>Comandas filtradas</p><b>${filtered.length}</b></div>
          <div class="kpi"><p>Pedidos novos</p><b>${newCount}</b></div>
          <div class="kpi"><p>Prontos para entrega</p><b>${readyCount}</b></div>
        </div>
      </div>
      ${filtered.length ? (() => {
        if (!isWaiterActor && actor?.role === "admin") {
          const grouped = {};
          for (const c of filtered) {
            const creator = resolveComandaResponsibleName(c);
            if (!grouped[creator]) grouped[creator] = [];
            grouped[creator].push(c);
          }
          return Object.keys(grouped).sort().map(creator => `
            <h4 style="margin-top:1.5rem; margin-bottom:0.5rem; border-bottom:1px solid var(--border); padding-bottom:0.25rem;">Garçom: ${esc(creator)} <span class="tag">${grouped[creator].length}</span></h4>
            <div class="comanda-grid" style="margin-top:0.5rem;">${grouped[creator].map(c => renderComandaCard(c, { forceCollapsed: true })).join("")}</div>
          `).join("");
        }
        return `<div class="comanda-grid" style="margin-top:1rem;">${filtered.map(c => renderComandaCard(c, { forceCollapsed: true })).join("")}</div>`;
      })() : `<div class="empty" style="margin-top:1rem;">Nenhuma comanda encontrada para a busca.</div>`}
    `;
  }

  function renderWaiterReadyModal() {
    const rows = uiState.waiterReadyModalItems || [];
    if (!rows.length) return "";
    const hasDanger = rows.some((row) => row.status === "em_falta");
    return `
      <div class="waiter-ready-modal-backdrop">
        <div class="card waiter-ready-modal ${hasDanger ? "has-danger" : ""}">
          <h3>${hasDanger ? "Alerta da cozinha" : "Atualizacao da cozinha"}</h3>
          <p class="note" style="margin-top:0.35rem;">Qualquer atualizacao da cozinha aparece aqui. Itens em falta ficam destacados em vermelho.</p>
          <div class="waiter-ready-list" style="margin-top:0.65rem;">
            ${rows
        .map(
          (row) =>
            `<div class="waiter-ready-item status-${esc(row.status || "fila")}"><div><b>${esc(row.itemName)}</b> x${row.qty} | Comanda <b>${esc(row.comandaId)}</b> | Referencia ${esc(row.table || "-")}</div><div class="kitchen-alert-meta"><span class="tag">Status: ${esc(row.statusLabel || kitchenStatusLabel("fila"))}</span><span class="note">Atualizado em: ${formatDateTime(row.updatedAt)}</span></div>${row.waiterNote ? `<div class="note">Obs do pedido: ${esc(row.waiterNote)}</div>` : ""}${row.deliveryRequested ? `<div class="note">Entrega: ${esc(row.deliveryRecipient || "-")} | ${esc(row.deliveryLocation || "-")}</div>` : ""}</div>`
        )
        .join("")}
          </div>
          <div class="actions" style="margin-top:0.75rem;">
            <button class="btn secondary" data-action="waiter-ready-go-open">Ir para comandas abertas</button>
            <button class="btn ok" data-action="close-waiter-ready-modal">Fechar aviso</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderWaiterKitchen() {
    const queue = listPendingKitchenItems(currentActor());
    const avg = queue.length ? Math.ceil(queue.reduce((s, r) => s + r.remainingMs, 0) / queue.length / 60000) : 0;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Fila de Espera - Cozinha</h3>
          <p class="note">Tempo medio atual: <b>${avg} min</b></p>
          ${queue.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="responsive-stack waiter-kitchen-table"><thead><tr><th>Comanda</th><th>Produto</th><th>Qtd</th><th>Obs cozinha</th><th>Prioridade</th><th>Status Cozinha</th><th>Tempo restante</th><th>Mesa/ref</th></tr></thead><tbody>${queue
          .map(
            (r) =>
              `<tr><td data-label="Comanda">${esc(r.comanda.id)}</td><td data-label="Produto">${esc(r.item.name)}</td><td data-label="Qtd">${r.item.qty}</td><td data-label="Obs cozinha">${esc(r.item.waiterNote || "-")}</td><td data-label="Prioridade"><span class="tag">${esc(kitchenPriorityLabel(r.item.kitchenPriority || "normal"))}</span></td><td data-label="Status Cozinha"><span class="tag">${esc(kitchenStatusLabel(r.item.kitchenStatus || "fila"))}</span></td><td data-label="Tempo restante">${Math.ceil(r.remainingMs / 60000)} min</td><td data-label="Mesa/ref">${esc(r.comanda.table)}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Sem pedidos pendentes da cozinha.</div>`}
        </div>
        <div class="card">
          <h3>Regra de calculo aplicada</h3>
          <p class="note">Tempo informado por produto (admin) + soma do restante dos pedidos de cozinha nao entregues, descontando o tempo que ja passou. Alertas de cozinha aparecem nas comandas abertas.</p>
        </div>
      </div>
    `;
  }

  function renderWaiterCatalog() {
    const search = String(uiState.waiterCatalogSearch || "").trim().toLowerCase();
    const categoryFilter = uiState.waiterCatalogCategory || "all";
    const rows = state.products
      .filter((product) => {
        if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
        if (!search) return true;
        return (
          String(product.name || "").toLowerCase().includes(search) ||
          String(product.category || "").toLowerCase().includes(search) ||
          String(product.subcategory || "").toLowerCase().includes(search)
        );
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

    const availableCount = rows.filter((p) => p.available !== false && Number(p.stock || 0) > 0).length;
    const unavailableCount = rows.length - availableCount;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Consulta de preco e disponibilidade</h3>
          <p class="note">Consulte valores do cardapio e disponibilidade antes de abrir/atualizar pedidos.</p>
          <div class="grid cols-2" style="margin-top:0.75rem;">
            <div class="field">
              <label>Buscar produto</label>
              <input data-role="waiter-catalog-search" value="${esc(uiState.waiterCatalogSearch)}" placeholder="Ex: cerveja, combo, pastel" />
            </div>
            <div class="field">
              <label>Categoria</label>
              <select data-role="waiter-catalog-category">
                <option value="all" ${categoryFilter === "all" ? "selected" : ""}>Todas</option>
                ${CATEGORIES.map((category) => `<option value="${category}" ${categoryFilter === category ? "selected" : ""}>${esc(category)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Itens listados</p><b>${rows.length}</b></div>
            <div class="kpi"><p>Disponiveis</p><b>${availableCount}</b></div>
            <div class="kpi"><p>Indisponiveis</p><b>${unavailableCount}</b></div>
          </div>
        </div>
        <div class="card">
          <h3>Cardapio Atual</h3>
          ${rows.length
        ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="responsive-stack waiter-catalog-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preco</th><th>Disponibilidade</th><th>Estoque</th><th>Fluxo</th></tr></thead><tbody>${rows
          .map((p) => {
            const status =
              p.available === false ? "Indisponivel (admin)" : Number(p.stock || 0) <= 0 ? "Sem estoque" : "Disponivel";
            const flow = productNeedsKitchen(p) ? "Cozinha" : "Pronta entrega";
            return `<tr><td data-label="Produto">${esc(p.name)}</td><td data-label="Categoria">${esc(categoryDisplay(p.category, p.subcategory || ""))}</td><td data-label="Preco">${money(p.price)}</td><td data-label="Disponibilidade">${esc(status)}</td><td data-label="Estoque">${Number(p.stock || 0)}</td><td data-label="Fluxo">${flow}</td></tr>`;
          })
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.75rem;">Nenhum item encontrado para o filtro informado.</div>`}
        </div>
      </div>
    `;
  }

  function renderWaiterHistory() {
    const actor = currentActor();
    const dayOpen = listOpenComandasForActor(actor);
    const dayClosed = listFinalizedComandasForActor(actor);
    const dayComandaIds = new Set([...dayOpen, ...dayClosed].map((comanda) => String(comanda?.id || "").trim()).filter(Boolean));
    const todayAudit = state.auditLog
      .filter((entry) => isAuditEventVisibleToActor(entry, actor))
      .filter((entry) => dayComandaIds.has(String(entry?.comandaId || "").trim()))
      .slice(0, 250);
    const closed = listFinalizedComandasForActor(actor)
      .sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0))
      .slice(0, 150);
    const waiterHistoryDetailsKey = detailKey("waiter-history", "audit");

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Historico de Alteracoes (imutavel)</h3>
          <p class="note" style="margin-top:0.35rem;">Mostra apenas alteracoes das comandas abertas/fechadas no caixa atual.</p>
          <details class="compact-details" data-persist-key="${esc(waiterHistoryDetailsKey)}" style="margin-top:0.75rem;"${detailOpenAttr(waiterHistoryDetailsKey)}>
            <summary>Ver alteracoes (${todayAudit.length})</summary>
            ${todayAudit.length
        ? `<div class="table-wrap" style="margin-top:0.55rem;"><table class="history-table"><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${todayAudit
          .map(
            (e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)}</td><td>${renderEventTypeTag(e.type)}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail)}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.55rem;">Sem eventos ainda.</div>`}
          </details>
        </div>
        ${renderComandaRecordsCompact(closed, {
          title: "Comandas Finalizadas do caixa atual (minimizadas)",
          limit: 150,
          keyPrefix: "waiter-history-comandas"
        })}
      </div>
      ${renderComandaDetailsBox()}
    `;
  }

  function listActiveKitchenOrders() {
    const rows = [];
    for (const comanda of state.openComandas) {
      for (const item of comanda.items || []) {
        if (isKitchenOrderActive(item)) {
          rows.push({ comanda, item });
        }
      }
    }
    rows.sort(kitchenSortRows);
    return rows;
  }

  function findUserNameById(userId) {
    if (userId === undefined || userId === null || userId === "") return "";
    const user = state.users.find((entry) => String(entry.id) === String(userId));
    return user?.name || "";
  }

  function resolveComandaResponsibleName(comanda) {
    const byId = findUserNameById(comanda?.createdBy);
    if (byId) return byId;
    const openEvent = (comanda?.events || []).find((event) => event.type === "comanda_aberta" && event.actorName);
    if (openEvent?.actorName) return openEvent.actorName;
    const firstKnownActor = (comanda?.events || []).find((event) => event.actorName);
    return firstKnownActor?.actorName || "-";
  }

  function matchesKitchenCollaborator(row, selectedActorId) {
    if (!row || selectedActorId === "all") return true;
    const selected = String(selectedActorId || "");
    if (!selected) return true;
    if (String(row.comanda?.createdBy || "") === selected) return true;
    if (String(row.item?.kitchenStatusById || "") === selected) return true;
    return (row.comanda?.events || []).some((event) => String(event.actorId || "") === selected);
  }

  function matchesKitchenRowSearch(row, searchTerm) {
    const query = String(searchTerm || "").trim().toLowerCase();
    if (!query) return true;
    const responsible = resolveComandaResponsibleName(row.comanda);
    return (
      matchesComandaSearch(row.comanda, query) ||
      String(row.item?.name || "").toLowerCase().includes(query) ||
      String(row.item?.waiterNote || "").toLowerCase().includes(query) ||
      String(row.item?.deliveryRecipient || "").toLowerCase().includes(query) ||
      String(row.item?.deliveryLocation || "").toLowerCase().includes(query) ||
      String(kitchenStatusLabel(row.item?.kitchenStatus || "fila")).toLowerCase().includes(query) ||
      String(kitchenPriorityLabel(row.item?.kitchenPriority || "normal")).toLowerCase().includes(query) ||
      String(responsible || "").toLowerCase().includes(query)
    );
  }

  function kitchenRemainingLabel(item) {
    const status = item?.kitchenStatus || "fila";
    if (status === "em_falta") return "Aguardando ajuste";
    const remainingMin = Math.ceil(kitchenRemainingMs(item) / 60000);
    if (remainingMin <= 0) return status === "cozinhando" ? "Pronto para finalizar" : "Prioridade alta";
    return `${remainingMin} min`;
  }

  function renderKitchenOpsBoard(rows, options = {}) {
    const actor = getCurrentUser();
    const canManagePriority = isAdminOrDev(actor);
    const canCollapseRows = isAdminOrDev(actor);
    const emptyMessage = options.emptyMessage || "Sem pedidos ativos na cozinha.";
    if (!rows.length) {
      return `<div class="empty" style="margin-top:0.75rem;">${esc(emptyMessage)}</div>`;
    }

    return `
      <div class="kitchen-board" style="margin-top:0.75rem;">
        ${rows
        .map((row) => {
          const status = row.item.kitchenStatus || "fila";
          const statusLabel = kitchenStatusLabel(status);
          const statusClass = status === "cozinhando" ? "cooking" : status === "em_falta" ? "missing" : status === "entregue" ? "done" : "queue";
          const responsible = resolveComandaResponsibleName(row.comanda);
          const deliveryInfo = row.item.deliveryRequested
            ? `${row.item.deliveryRecipient || "-"} | ${row.item.deliveryLocation || "-"}`
            : "Balcao/Mesa";
          const kitchenBy = row.item.kitchenStatusByName || "-";
          const priority = row.item.kitchenPriority || "normal";
          const priorityLabel = kitchenPriorityLabel(priority);
          const priorityClass = kitchenPriorityClass(priority);
          const priorityBy = row.item.kitchenPriorityByName || "-";
          const queueInfo = kitchenRemainingLabel(row.item);
          const rowDetailsKey = detailKey("kitchen-row", row.comanda.id, row.item.id);
          const isCollapsed = canCollapseRows ? isAdminKitchenRowCollapsed(row.comanda.id, row.item.id) : false;

          return `
              <div class="kitchen-order-card status-${statusClass} ${isCollapsed ? "is-collapsed" : ""}">
                <div class="kitchen-order-head">
                  <div>
                    <h4>${esc(row.item.name)} x${row.item.qty}</h4>
                    <div class="kitchen-order-pills">
                      <span class="kitchen-order-pill">Comanda ${esc(row.comanda.id)}</span>
                      <span class="kitchen-order-pill">Mesa/ref ${esc(row.comanda.table || "-")}</span>
                      <span class="kitchen-order-pill">Fila ${esc(queueInfo)}</span>
                      <span class="kitchen-order-pill priority ${priorityClass}">${esc(priorityLabel)}</span>
                      ${row.item.deliveryRequested ? `<span class="kitchen-order-pill delivery">Entrega</span>` : ""}
                    </div>
                    <p class="note">Cliente ${esc(row.comanda.customer || "-")}</p>
                  </div>
                  <div class="kitchen-order-head-actions">
                    <span class="kitchen-order-status ${statusClass}">${esc(statusLabel)}</span>
                    ${canCollapseRows
              ? `<button class="btn secondary compact-action kitchen-collapse-toggle" data-action="toggle-kitchen-row-collapse" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}">${isCollapsed ? "Expandir" : "Minimizar"}</button>`
              : ""
            }
                  </div>
                </div>
                <div class="kitchen-order-meta kitchen-order-meta-main">
                  <div class="kitchen-meta-box meta-responsible"><span>Responsavel</span><b>${esc(responsible)}</b></div>
                  <div class="kitchen-meta-box meta-updated-by"><span>Atualizado por</span><b>${esc(kitchenBy)}</b></div>
                  <div class="kitchen-meta-box meta-priority"><span>Prioridade</span><b>${esc(priorityLabel)}</b></div>
                  <div class="kitchen-meta-box meta-delivery"><span>Entrega</span><b>${esc(deliveryInfo)}</b></div>
                </div>
                ${canManagePriority
              ? `<div class="kitchen-priority-actions"><button class="btn secondary compact-action ${priority === "normal" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-priority="normal" ${priority === "normal" ? "disabled" : ""} title="Normal">Normal</button><button class="btn warn compact-action ${priority === "alta" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-priority="alta" ${priority === "alta" ? "disabled" : ""} title="Prioridade alta">Alta</button><button class="btn danger compact-action ${priority === "maxima" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-priority="maxima" ${priority === "maxima" ? "disabled" : ""} title="Prioridade maxima">Maxima</button><button class="btn secondary compact-action kitchen-priority-ignore ${priority === "comum" ? "is-active" : ""}" data-action="kitchen-priority" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-priority="comum" ${priority === "comum" ? "disabled" : ""} title="Ignorar prioridade e manter como comum">Ignorar</button></div>`
              : `<div class="note"><b>Prioridade:</b> ${esc(priorityLabel)}</div>`
            }
                <div class="kitchen-order-collapsed-note">Pedido minimizado no painel do administrador.</div>
                ${row.item.waiterNote ? `<div class="kitchen-order-note"><b>Obs do pedido:</b> ${esc(row.item.waiterNote)}</div>` : ""}
                <details class="kitchen-order-more" data-persist-key="${esc(rowDetailsKey)}"${detailOpenAttr(rowDetailsKey)}>
                  <summary>Mais detalhes</summary>
                  <div class="kitchen-order-meta kitchen-order-meta-extra">
                    <div class="kitchen-meta-box"><span>Criado</span><b>${esc(formatDateTime(row.item.createdAt))}</b></div>
                    <div class="kitchen-meta-box"><span>Ultima mudanca</span><b>${esc(formatDateTime(row.item.kitchenStatusAt))}</b></div>
                    <div class="kitchen-meta-box"><span>Status atual</span><b>${esc(statusLabel)}</b></div>
                    <div class="kitchen-meta-box"><span>Prioridade definida por</span><b>${esc(priorityBy)}</b></div>
                  </div>
                </details>
                <div class="kitchen-order-actions">
                  <button class="btn secondary compact-action ${status === "cozinhando" ? "is-active" : ""}" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="cozinhando" ${status === "cozinhando" ? "disabled" : ""}>Em preparo</button>
                  <button class="btn danger compact-action ${status === "em_falta" ? "is-active" : ""}" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="em_falta" ${status === "em_falta" ? "disabled" : ""}>Em falta</button>
                  <button class="btn ok compact-action" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="entregue">Entregue</button>
                </div>
              </div>
            `;
        })
        .join("")}
      </div>
    `;
  }

  function renderCookActive() {
    const rows = listActiveKitchenOrders().filter((row) => matchesKitchenRowSearch(row, uiState.cookSearch));
    const countFila = rows.filter((r) => (r.item.kitchenStatus || "fila") === "fila").length;
    const countCooking = rows.filter((r) => (r.item.kitchenStatus || "fila") === "cozinhando").length;
    const countMissing = (state.cookHistory || []).filter((row) => row.status === "em_falta").length;

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Na fila</p><b>${countFila}</b></div>
          <div class="kpi"><p>Cozinhando</p><b>${countCooking}</b></div>
          <div class="kpi"><p>Em falta (hist.)</p><b>${countMissing}</b></div>
        </div>
        <div class="card">
          <h3>Ambiente Cozinha</h3>
          <p class="note">Painel otimizado para celular, sem rolagem horizontal nos botoes de acao.</p>
          <p class="note" style="margin-top:0.25rem;">Mostra pedidos com fluxo de cozinha e informacoes do garcom. A prioridade (normal/alta/maxima) e definida pelo administrador, com opcao de ignorar como comum.</p>
          <div class="field" style="margin-top:0.75rem;">
            <label>Busca da cozinha</label>
            <input data-role="cook-search" value="${esc(uiState.cookSearch)}" placeholder="Comanda, mesa, cliente, item, observacao ou responsavel" />
          </div>
          ${renderKitchenOpsBoard(rows, { emptyMessage: "Sem pedidos ativos na cozinha para o filtro aplicado." })}
        </div>
      </div>
    `;
  }

  function renderCookHistory() {
    const rows = [...(state.cookHistory || [])].sort((a, b) => new Date(b.deliveredAt || b.updatedAt || 0) - new Date(a.deliveredAt || a.updatedAt || 0));
    const cookHistoryDetailsKey = detailKey("cook-history", "delivered");
    return `
      <div class="card">
        <h3>Historico da Cozinha</h3>
        <p class="note">Limpo automaticamente ao fechar o caixa.</p>
        <details class="compact-details" data-persist-key="${esc(cookHistoryDetailsKey)}" style="margin-top:0.75rem;"${detailOpenAttr(cookHistoryDetailsKey)}>
          <summary>Ver historico (${rows.length})</summary>
          ${rows.length
        ? `<div class="table-wrap" style="margin-top:0.55rem;"><table><thead><tr><th>Data</th><th>Comanda</th><th>Mesa/ref</th><th>Produto</th><th>Qtd</th><th>Obs cozinha</th><th>Prioridade</th><th>Status final</th><th>Entrega</th><th>Cozinheiro</th></tr></thead><tbody>${rows
          .map(
            (row) =>
              `<tr><td>${formatDateTime(row.deliveredAt || row.updatedAt)}</td><td>${esc(row.comandaId)}</td><td>${esc(row.table || "-")}</td><td>${esc(row.itemName)}</td><td>${row.qty}</td><td>${esc(row.waiterNote || "-")}</td><td>${esc(kitchenPriorityLabel(row.priority || "normal"))}</td><td>${esc(kitchenStatusLabel(row.status || "entregue"))}</td><td>${row.deliveryRequested ? `<div><b>${esc(row.deliveryRecipient || "-")}</b></div><div class="note">${esc(row.deliveryLocation || "-")}</div>` : "Balcao/Mesa"}</td><td>${esc(row.cookName || "-")}</td></tr>`
          )
          .join("")}</tbody></table></div>`
        : `<div class="empty" style="margin-top:0.55rem;">Sem registros da cozinha neste caixa.</div>`}
        </details>
      </div>
    `;
  }

  function renderWaiterKitchenReceiptNotice() {
    const notices = uiState.waiterKitchenReceiptNotices || [];
    if (!notices.length) return "";
    const latest = notices[0];
    const extra = Math.max(0, notices.length - 1);

    return `
      <div class="waiter-kitchen-receipt-banner">
        <div class="waiter-kitchen-receipt-main">
          <span class="status-dot ok"></span>
          <div>
            <p><b>Cozinha recebeu o pedido</b></p>
            <p class="note">${esc(latest.itemName)} x${latest.qty} | Comanda ${esc(latest.comandaId)} | Ref. ${esc(latest.table || "-")} | ${formatDateTime(latest.receivedAt)}${latest.cookName ? ` | ${esc(latest.cookName)}` : ""}${extra ? ` | +${extra} novo(s)` : ""}</p>
          </div>
        </div>
        <div class="actions waiter-kitchen-receipt-actions">
          ${extra ? `<button class="btn secondary compact-action" data-action="clear-kitchen-receipt-notices">Limpar</button>` : ""}
          <button class="btn secondary compact-action" data-action="dismiss-kitchen-receipt-notice">Entendi</button>
        </div>
      </div>
    `;
  }

  function renderCook(user) {
    const tabs = [
      { key: "ativos", label: "Pedidos Ativos" },
      { key: "historico", label: "Historico Cozinha" }
    ];
    const content = uiState.cookTab === "historico" ? renderCookHistory() : renderCookActive();

    app.innerHTML = `
      <div class="container app-shell role-cook">
        ${renderInstallBanner()}
        ${renderTopBar(user)}
        ${renderTabs("cook", tabs, uiState.cookTab)}
        ${content}
      </div>
    `;
  }

  function renderWaiter(user) {
    if (uiState.waiterTab === "avulsa") {
      uiState.waiterTab = "abrir";
    }
    const tabs = [
      { key: "abrir", label: "Abrir pedido/comanda" },
      { key: "abertas", label: "Comandas abertas" },
      { key: "cozinha", label: "Fila cozinha" },
      { key: "consulta", label: "Consulta precos" },
      { key: "historico", label: "Historico" }
    ];

    let content = "";
    switch (uiState.waiterTab) {
      case "abrir":
        content = renderWaiterCreateComanda();
        break;
      case "abertas":
        content = renderWaiterOpenComandas();
        break;
      case "cozinha":
        content = renderWaiterKitchen();
        break;
      case "consulta":
        content = renderWaiterCatalog();
        break;
      case "historico":
        content = renderWaiterHistory();
        break;
      default:
        content = renderWaiterCreateComanda();
    }

    app.innerHTML = `
      <div class="container app-shell role-waiter">
        ${renderInstallBanner()}
        ${renderTopBar(user)}
        ${renderWaiterKitchenReceiptNotice()}
        ${renderTabs("waiter", tabs, uiState.waiterTab)}
        ${content}
        ${renderWaiterReadyModal()}
        ${renderComandaItemSelectorModal()}
      </div>
    `;
  }

  function render() {
    const user = getCurrentUser();
    if (!user) {
      renderLogin();
      return;
    }

    if (user.role === "admin") {
      renderAdmin(user);
    } else if (user.role === "dev") {
      renderDev(user);
    } else if (user.role === "cook") {
      acknowledgeKitchenReceiptInCookPanel(user);
      renderCook(user);
    } else {
      pruneWaiterDraftItems();
      syncWaiterReadyModal();
      syncWaiterKitchenReceiptNotices();
      renderWaiter(user);
    }

    hydrateAfterRender();
  }

  function hydrateAfterRender() {
    document.querySelectorAll("details[data-persist-key]").forEach((detailsEl) => {
      const key = String(detailsEl.dataset.persistKey || "").trim();
      if (!key) return;
      const defaultOpen = String(detailsEl.dataset.persistDefaultOpen || "") === "true";
      const shouldOpen = isDetailOpen(key, defaultOpen);
      if (detailsEl.open !== shouldOpen) {
        detailsEl.open = shouldOpen;
      }
      if (detailsEl.dataset.persistBound === "1") return;
      detailsEl.dataset.persistBound = "1";
      detailsEl.addEventListener("toggle", () => {
        uiState.persistedDetailsOpen[key] = Boolean(detailsEl.open);
      });
    });

    document.querySelectorAll('form[data-role="add-item-form"]').forEach((form) => {
      const categorySel = form.querySelector('[data-role="item-category"]');
      const productSel = form.querySelector('[data-role="item-product"]');
      fillProductSelect(productSel, categorySel.value);
      updateKitchenEstimate(form);
      updateDeliveryFields(form);
    });

    document.querySelectorAll('[data-role="payment-method"]').forEach((select) => {
      toggleFinalizeView(select);
    });

    document.querySelectorAll('form[data-role="quick-sale-form"]').forEach((form) => {
      fillQuickSaleProductSelect(form);
      updateQuickSaleFlow(form);
    });

    const addProductForm = document.getElementById("add-product-form");
    if (addProductForm) {
      updateAdminProductSubmenu(addProductForm);
    }
  }

  function updateAdminProductSubmenu(form) {
    const category = form?.category?.value || "";
    const offerBox = form?.querySelector('[data-role="admin-offer-kitchen"]');
    const offerNeedsKitchen = form?.offerNeedsKitchen;
    const isOffer = category === "Ofertas";
    if (offerBox) offerBox.style.display = isOffer ? "grid" : "none";
    if (offerNeedsKitchen && !isOffer) {
      offerNeedsKitchen.checked = false;
    }
  }

  function updateDeliveryFields(form) {
    const category = form.querySelector('[data-role="item-category"]')?.value;
    const productId = Number(form.querySelector('[data-role="item-product"]')?.value || 0);
    const product = state.products.find((p) => p.id === productId && p.category === category);
    const box = form.querySelector('[data-role="delivery-box"]');
    const fields = form.querySelector('[data-role="delivery-fields"]');
    const check = form.querySelector('[data-role="delivery-check"]');
    const recipient = form.querySelector('input[name="deliveryRecipient"]');
    const location = form.querySelector('input[name="deliveryLocation"]');
    const noteBox = form.querySelector('[data-role="kitchen-note-box"]');
    const noteInput = form.querySelector('[data-role="kitchen-note-input"]');
    if (!box || !fields || !check || !recipient || !location || !noteBox || !noteInput) return;

    const isKitchen = productNeedsKitchen(product);
    if (!isKitchen) {
      box.style.display = "none";
      fields.style.display = "none";
      check.checked = false;
      recipient.value = "";
      location.value = "";
      recipient.required = false;
      location.required = false;
      noteBox.style.display = "none";
      noteInput.value = "";
      noteInput.required = false;
      return;
    }

    box.style.display = "grid";
    fields.style.display = check.checked ? "grid" : "none";
    recipient.required = check.checked;
    location.required = check.checked;
    noteBox.style.display = "grid";
    noteInput.required = false;
  }

  function fillProductSelect(selectElement, category) {
    if (!selectElement) return;
    const options = state.products.filter((p) => p.category === category);

    if (!options.length) {
      selectElement.innerHTML = `<option value="">Sem produtos</option>`;
      return;
    }

    selectElement.innerHTML = options
      .map(
        (p) =>
          `<option value="${p.id}" ${!productIsAvailable(p) ? "disabled" : ""}>${esc(p.name)}${p.category === "Ofertas" ? ` (${p.requiresKitchen ? "cozinha" : "pronta entrega"})` : ""} | ${money(p.price)} | estoque ${p.stock}${p.available === false ? " | indisponivel" : ""}</option>`
      )
      .join("");

    const firstAvailable = options.find((p) => productIsAvailable(p));
    if (firstAvailable) {
      selectElement.value = String(firstAvailable.id);
    } else {
      selectElement.selectedIndex = 0;
    }
  }

  function fillQuickSaleProductSelect(form) {
    const category = form.querySelector('[data-role="quick-category"]')?.value;
    const selectElement = form.querySelector('[data-role="quick-product"]');
    if (!selectElement) return;
    const options = state.products.filter((p) => p.category === category);
    if (!options.length) {
      selectElement.innerHTML = `<option value="">Sem produtos</option>`;
      return;
    }
    selectElement.innerHTML = options
      .map(
        (p) =>
          `<option value="${p.id}" ${!productIsAvailable(p) ? "disabled" : ""}>${esc(p.name)}${p.category === "Ofertas" ? ` (${p.requiresKitchen ? "cozinha" : "pronta entrega"})` : ""} | ${money(p.price)} | estoque ${p.stock}${p.available === false ? " | indisponivel" : ""}</option>`
      )
      .join("");
    const firstAvailable = options.find((p) => productIsAvailable(p));
    if (firstAvailable) {
      selectElement.value = String(firstAvailable.id);
    } else {
      selectElement.selectedIndex = 0;
    }
  }

  function updateQuickSaleFlow(form) {
    if (!form) return;
    const category = form.querySelector('[data-role="quick-category"]')?.value;
    const productId = Number(form.querySelector('[data-role="quick-product"]')?.value || 0);
    const selectedProduct = state.products.find((p) => p.id === productId && p.category === category);
    const deliveryBox = form.querySelector('[data-role="quick-delivery-box"]');
    const deliveryFields = form.querySelector('[data-role="quick-delivery-fields"]');
    const deliveryCheck = form.querySelector('[data-role="quick-delivery-check"]');
    const recipient = form.querySelector('input[name="deliveryRecipient"]');
    const location = form.querySelector('input[name="deliveryLocation"]');
    const note = form.querySelector('[data-role="quick-kitchen-note"]');
    const isKitchen = selectedProduct ? productNeedsKitchen(selectedProduct) : category === "Cozinha";

    if (note) {
      note.textContent = isKitchen
        ? "Item com fluxo de cozinha: sera criada uma comanda avulsa e o pedido entrara na fila da cozinha."
        : "Item sem fluxo de cozinha: a venda fecha imediatamente.";
    }
    if (!deliveryBox || !deliveryFields || !deliveryCheck || !recipient || !location) return;

    if (!isKitchen) {
      deliveryBox.style.display = "none";
      deliveryFields.style.display = "none";
      deliveryCheck.checked = false;
      recipient.required = false;
      location.required = false;
      recipient.value = "";
      location.value = "";
      return;
    }

    deliveryBox.style.display = "grid";
    deliveryFields.style.display = deliveryCheck.checked ? "grid" : "none";
    recipient.required = deliveryCheck.checked;
    location.required = deliveryCheck.checked;
  }

  function updateKitchenEstimate(form) {
    const info = form.querySelector('[data-role="kitchen-estimate"]');
    if (!info) return;

    const category = form.querySelector('[data-role="item-category"]')?.value;
    const productId = Number(form.querySelector('[data-role="item-product"]')?.value || 0);
    const qty = Math.max(1, Number(form.querySelector('input[name="qty"]')?.value || 1));

    const product = state.products.find((p) => p.id === productId && p.category === category);
    if (!product) {
      info.textContent = "Tempo estimado cozinha: selecione um produto.";
      return;
    }
    if (!productNeedsKitchen(product)) {
      info.textContent = "Tempo estimado cozinha: nao aplicavel para esta categoria.";
      return;
    }

    const waitingMs = totalKitchenQueueMs();
    const prepMs = Number(product.prepTime || 0) * qty * 60 * 1000;
    const totalMs = waitingMs + prepMs;
    info.textContent = `Tempo estimado cozinha: ${Math.ceil(totalMs / 60000)} min (inclui fila atual).`;
  }

  function findOpenComanda(id) {
    return state.openComandas.find((c) => c.id === id) || null;
  }

  function findAnyComanda(id) {
    return state.openComandas.find((c) => c.id === id) || state.closedComandas.find((c) => c.id === id) || null;
  }

  function kitchenAlertCount(comanda) {
    return (comanda.items || []).filter((item) => itemNeedsKitchen(item) && item.kitchenAlertUnread).length;
  }

  function clearComandaKitchenAlerts(comandaId, options = {}) {
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    for (const item of comanda.items || []) {
      if (itemNeedsKitchen(item)) {
        item.kitchenAlertUnread = false;
      }
    }
    comanda.kitchenAlertUnread = false;
    if (!options.skipPersist) {
      saveState();
    }
    if (!options.skipRender) {
      render();
    }
  }

  function resolveComandaKitchenIndicator(comandaId, mode = "entendi") {
    const actor = currentActor();
    if (!actor || (actor.role !== "waiter" && !isAdminOrDev(actor))) {
      alert("Somente garcom ou administrador podem resolver alertas.");
      return;
    }
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;

    let resolvedCount = 0;
    for (const item of comanda.items || []) {
      if (!itemNeedsKitchen(item)) continue;
      const canResolveAlert = Boolean(item.kitchenAlertUnread);
      const canResolveReadyVisual = mode === "entendi" && item.waiterVisualState === "ready";
      if (!canResolveAlert && !canResolveReadyVisual) continue;

      item.kitchenAlertUnread = false;
      if (mode === "entregue" && item.kitchenStatus === "entregue") {
        item.waiterDeliveredAt = isoNow();
        item.waiterDeliveredById = actor.id;
        item.waiterDeliveredByName = actor.name;
        item.waiterVisualState = "";
        item.waiterVisualUpdatedAt = isoNow();
      } else if (mode === "entendi") {
        item.waiterVisualState = "seen";
        item.waiterVisualUpdatedAt = isoNow();
      }
      resolvedCount += 1;
    }

    comanda.kitchenAlertUnread = kitchenAlertCount(comanda) > 0;
    if (resolvedCount) {
      appendComandaEvent(comanda, {
        actor,
        type: mode === "entregue" ? "garcom_entregou_pedido" : "garcom_ciente_alerta",
        detail:
          mode === "entregue"
            ? `Garcom marcou ${resolvedCount} alerta(s) da cozinha como entregue ao cliente.`
            : `Garcom confirmou leitura de ${resolvedCount} alerta(s) da cozinha.`
      });
    }

    saveState();
    render();
  }

  function matchesComandaSearch(comanda, searchTerm) {
    const s = String(searchTerm || "").trim().toLowerCase();
    if (!s) return true;
    return (
      String(comanda.id || "").toLowerCase().includes(s) ||
      String(comanda.table || "").toLowerCase().includes(s) ||
      String(comanda.customer || "").toLowerCase().includes(s)
    );
  }

  function isWaiterComandaCollapsed(comandaId) {
    const key = String(comandaId || "");
    const value = uiState.waiterCollapsedByComanda[key];
    return value === undefined ? true : Boolean(value);
  }

  function toggleWaiterComandaCollapse(comandaId) {
    const key = String(comandaId || "");
    const nextCollapsed = !isWaiterComandaCollapsed(key);
    uiState.waiterCollapsedByComanda[key] = nextCollapsed;
    if (nextCollapsed) {
      delete uiState.finalizeOpenByComanda[key];
      if (uiState.waiterActiveComandaId === key) {
        uiState.waiterActiveComandaId = null;
      }
    } else {
      uiState.waiterActiveComandaId = key;
    }
    render();
  }

  function minimizeOpenComanda(comandaId) {
    const key = String(comandaId || "");
    if (!key) return;
    uiState.waiterCollapsedByComanda[key] = true;
    delete uiState.finalizeOpenByComanda[key];
    if (uiState.waiterActiveComandaId === key) {
      uiState.waiterActiveComandaId = null;
    }
    uiState.waiterTab = "abertas";
    render();
  }

  function toggleAdminKitchenRowCollapse(comandaId, itemId) {
    const keyComanda = String(comandaId || "");
    const keyItem = String(itemId || "");
    if (!keyComanda || !keyItem) return;
    const nextCollapsed = !isAdminKitchenRowCollapsed(keyComanda, keyItem);
    setAdminKitchenRowCollapsed(keyComanda, keyItem, nextCollapsed);
    if (nextCollapsed) {
      const rowDetailsKey = detailKey("kitchen-row", keyComanda, keyItem);
      uiState.persistedDetailsOpen[rowDetailsKey] = false;
    }
    render();
  }

  function waiterDraftKey(comandaId) {
    return String(comandaId || "");
  }

  function getWaiterDraftItems(comandaId) {
    const key = waiterDraftKey(comandaId);
    uiState.waiterDraftByComanda = uiState.waiterDraftByComanda || {};
    if (!Array.isArray(uiState.waiterDraftByComanda[key])) {
      uiState.waiterDraftByComanda[key] = [];
    }
    return uiState.waiterDraftByComanda[key];
  }

  function clearWaiterDraftItems(comandaId) {
    const key = waiterDraftKey(comandaId);
    if (uiState.waiterDraftByComanda?.[key]) {
      delete uiState.waiterDraftByComanda[key];
    }
  }

  function pruneWaiterDraftItems() {
    const openIds = new Set(state.openComandas.map((comanda) => waiterDraftKey(comanda.id)));
    for (const key of Object.keys(uiState.waiterDraftByComanda || {})) {
      if (!openIds.has(key)) {
        delete uiState.waiterDraftByComanda[key];
      }
    }
  }

  function parseItemDraftFromForm(form) {
    const category = form.category.value;
    const productId = Number(form.productId.value || 0);
    const qty = Math.max(1, Number(form.qty.value || 1));
    const waiterNoteRaw = String(form.waiterNote?.value || "").trim();
    const isDeliveryRaw = Boolean(form.isDelivery?.checked);
    const deliveryRecipient = String(form.deliveryRecipient?.value || "").trim();
    const deliveryLocation = String(form.deliveryLocation?.value || "").trim();

    const product = state.products.find((p) => p.id === productId && p.category === category);
    if (!product) {
      return { error: "Produto invalido." };
    }
    if (product.available === false) {
      return { error: `Produto ${product.name} esta indisponivel no cardapio.` };
    }

    const needsKitchen = productNeedsKitchen(product);
    const isDelivery = needsKitchen && isDeliveryRaw;
    if (needsKitchen && isDelivery && (!deliveryRecipient || !deliveryLocation)) {
      return { error: "Para entrega, informe quem recebe e o local de entrega." };
    }

    return {
      value: {
        category,
        productId: product.id,
        qty,
        waiterNote: needsKitchen ? waiterNoteRaw : "",
        needsKitchen,
        isDelivery,
        deliveryRecipient: isDelivery ? deliveryRecipient : "",
        deliveryLocation: isDelivery ? deliveryLocation : ""
      }
    };
  }

  function validateDraftBatch(drafts) {
    const qtyByProduct = {};
    for (const draft of drafts) {
      const key = `${draft.category}::${draft.productId}`;
      qtyByProduct[key] = (qtyByProduct[key] || 0) + Number(draft.qty || 0);
    }

    const errors = [];
    for (const key of Object.keys(qtyByProduct)) {
      const [category, productIdRaw] = key.split("::");
      const productId = Number(productIdRaw);
      const requestedQty = qtyByProduct[key];
      const product = state.products.find((p) => p.id === productId && p.category === category);
      if (!product) {
        errors.push(`Produto ${productId} da categoria ${category} nao foi encontrado.`);
        continue;
      }
      if (product.available === false) {
        errors.push(`Produto ${product.name} esta indisponivel no cardapio.`);
        continue;
      }
      if (Number(product.stock || 0) < requestedQty) {
        errors.push(`Estoque insuficiente para ${product.name}. Solicitado: ${requestedQty}, disponivel: ${product.stock}.`);
      }
    }
    return errors;
  }

  function appendDraftItemToComanda(comanda, actor, draft, options = {}) {
    const product = state.products.find((p) => p.id === draft.productId && p.category === draft.category);
    if (!product) return null;
    const adjustStock = options.adjustStock !== false;
    const qty = Number(draft.qty || 0);
    if (adjustStock) {
      product.stock -= qty;
    }

    const waitingBefore = totalKitchenQueueMs();

    const item = {
      id: `IT-${String(state.seq.item++).padStart(5, "0")}`,
      productId: product.id,
      name: product.name,
      category: product.category,
      qty,
      priceAtSale: parseNumber(product.price),
      costAtSale: parseNumber(product.cost || 0),
      prepTimeAtSale: Number(product.prepTime || 0),
      requiresKitchen: Boolean(product.requiresKitchen),
      needsKitchen: Boolean(draft.needsKitchen),
      waiterNote: draft.waiterNote || "",
      noteType: "",
      createdAt: isoNow(),
      delivered: false,
      deliveredAt: null,
      kitchenStatus: draft.needsKitchen ? "fila" : "",
      kitchenStatusAt: draft.needsKitchen ? isoNow() : null,
      kitchenStatusById: null,
      kitchenStatusByName: "",
      kitchenPriority: draft.needsKitchen ? "normal" : "",
      kitchenPriorityById: null,
      kitchenPriorityByName: "",
      kitchenPriorityAt: draft.needsKitchen ? isoNow() : null,
      kitchenReceivedAt: null,
      kitchenReceivedById: null,
      kitchenReceivedByName: "",
      kitchenAlertUnread: Boolean(draft.needsKitchen),
      waiterVisualState: "new",
      waiterVisualUpdatedAt: isoNow(),
      deliveryRequested: Boolean(draft.isDelivery),
      deliveryRecipient: draft.isDelivery ? draft.deliveryRecipient || "" : "",
      deliveryLocation: draft.isDelivery ? draft.deliveryLocation || "" : "",
      canceled: false,
      canceledAt: null,
      cancelReason: "",
      cancelNote: ""
    };

    if (itemNeedsKitchen(item)) {
      const prepMs = item.prepTimeAtSale * qty * 60 * 1000;
      item.etaAt = new Date(Date.now() + waitingBefore + prepMs).toISOString();
      comanda.kitchenAlertUnread = true;
    }

    comanda.items.push(item);
    const kitchenInfo = itemNeedsKitchen(item) ? ` Tempo estimado: ${Math.ceil((waitingBefore + item.prepTimeAtSale * qty * 60000) / 60000)} min.` : "";
    const deliveryInfo = item.deliveryRequested ? ` Entrega para ${item.deliveryRecipient} em ${item.deliveryLocation}.` : "";
    const eventType = String(options.eventType || "item_add");
    const eventDetail =
      typeof options.eventDetail === "string" && options.eventDetail.trim()
        ? options.eventDetail.trim()
        : `Item ${item.name} x${qty} adicionado.${kitchenInfo}${deliveryInfo}`;
    appendComandaEvent(comanda, {
      actor,
      type: eventType,
      detail: eventDetail,
      reason: "",
      itemId: item.id
    });
    return item;
  }

  function queueComandaDraftItem(form) {
    const actor = currentActor();
    const comandaId = form.dataset.comandaId;
    const comanda = findOpenComandaForActor(comandaId, actor, { silent: true });
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return;
    }

    const parsed = parseItemDraftFromForm(form);
    if (parsed.error) {
      alert(parsed.error);
      return;
    }

    const draftItems = getWaiterDraftItems(comandaId);
    draftItems.push(parsed.value);

    form.qty.value = "1";
    form.waiterNote.value = "";
    if (form.isDelivery) form.isDelivery.checked = false;
    if (form.deliveryRecipient) form.deliveryRecipient.value = "";
    if (form.deliveryLocation) form.deliveryLocation.value = "";

    updateDeliveryFields(form);
    updateKitchenEstimate(form);
    render();
  }

  function removeComandaDraftItem(comandaId, index) {
    const comanda = findOpenComandaForActor(comandaId, currentActor(), { silent: true });
    if (!comanda) {
      clearWaiterDraftItems(comandaId);
      render();
      return;
    }
    const items = getWaiterDraftItems(comandaId);
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= items.length) return;
    items.splice(idx, 1);
    if (!items.length) {
      clearWaiterDraftItems(comandaId);
    }
    render();
  }

  function listComandaSelectableItems(comandaId, actor = currentActor()) {
    const comanda = findOpenComandaForActor(comandaId, actor, { silent: true });
    if (!comanda) return [];
    return (comanda.items || []).filter((item) => !item.canceled && parseNumber(item.qty || 0) > 0);
  }

  function openComandaItemSelector(comandaId, mode = "increment") {
    const actor = currentActor();
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;
    const allowedMode = mode === "cancel" ? "cancel" : "increment";
    const candidates = listComandaSelectableItems(comandaId, actor);
    if (!candidates.length) {
      alert("Nao ha itens validos nessa comanda.");
      return;
    }
    uiState.itemSelector = {
      open: true,
      comandaId: String(comandaId),
      mode: allowedMode
    };
    render();
  }

  function closeComandaItemSelector() {
    uiState.itemSelector = {
      open: false,
      comandaId: "",
      mode: "increment"
    };
    render();
  }

  function renderComandaItemSelectorModal() {
    const selector = uiState.itemSelector || {};
    if (!selector.open || !selector.comandaId) return "";
    const comanda = findOpenComandaForActor(selector.comandaId, currentActor(), { silent: true });
    if (!comanda) return "";

    const mode = selector.mode === "cancel" ? "cancel" : "increment";
    const candidates = listComandaSelectableItems(comanda.id, currentActor());
    if (!candidates.length) return "";

    return `
      <div class="item-selector-modal-backdrop">
        <div class="card item-selector-modal">
          <h3>${mode === "increment" ? "Adicionar quantidade no item" : "Devolver/cancelar quantidade"}</h3>
          <p class="note" style="margin-top:0.3rem;">Comanda ${esc(comanda.id)} | Referencia: ${esc(comanda.table || "-")}.</p>
          <form class="form" data-role="item-selector-form" data-comanda-id="${comanda.id}" data-mode="${mode}" style="margin-top:0.7rem;">
            <div class="field">
              <label>Item</label>
              <select name="itemId" required>
                ${candidates
        .map(
          (item) =>
            `<option value="${item.id}">${esc(item.name)} | qtd atual ${item.qty}${itemNeedsKitchen(item)
              ? ` | ${esc(kitchenStatusLabel(item.kitchenStatus || "fila"))} | ${esc(kitchenPriorityLabel(item.kitchenPriority || "normal"))}`
              : ""
            }</option>`
        )
        .join("")}
              </select>
            </div>
            <div class="field">
              <label>Quantidade</label>
              <input name="qty" type="number" min="1" value="1" required />
            </div>
            ${mode === "cancel"
        ? `<div class="field"><label>Motivo</label><select name="reason">${CANCEL_REASONS.map((reason) => `<option value="${esc(reason)}">${esc(reason)}</option>`).join("")}</select></div><div class="field"><label>Observacao (opcional)</label><input name="note" placeholder="Ex: cliente desistiu" /></div>`
        : ""
      }
            <div class="actions">
              <button class="btn secondary" type="button" data-action="close-item-selector">Fechar</button>
              <button class="btn ${mode === "increment" ? "ok" : "danger"}" type="submit">${mode === "increment" ? "Aplicar +" : "Aplicar cancelamento"}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function submitComandaItemSelector(form) {
    const comandaId = form.dataset.comandaId;
    const mode = form.dataset.mode === "cancel" ? "cancel" : "increment";
    const itemId = form.itemId.value;
    const qty = Math.max(1, Number(form.qty.value || 1));
    if (!itemId || !Number.isFinite(qty) || qty <= 0) {
      alert("Informe item e quantidade valida.");
      return;
    }

    uiState.itemSelector = {
      open: false,
      comandaId: "",
      mode: "increment"
    };

    if (mode === "increment") {
      incrementItem(comandaId, itemId, qty);
      return;
    }

    const reason = String(form.reason?.value || "Desistencia de pedido").trim() || "Desistencia de pedido";
    const note = String(form.note?.value || "").trim();
    cancelItem(comandaId, itemId, { qty, reason, note, skipPrompt: true });
  }

  function login(login, password, rememberLogin = false) {
    const user = findUserByLoginPassword(login, password);
    if (!user) {
      alert("Login/senha invalidos.");
      return;
    }

    sessionUserId = user.id;
    persistSessionUserId(sessionUserId, rememberLogin);
    saveState({ skipCloud: true, touchMeta: false });
    broadcastPresencePing();
    render();
  }

  function logout() {
    sessionUserId = null;
    persistSessionUserId(null);
    uiState.waiterActiveComandaId = null;
    uiState.waiterReadyModalItems = [];
    uiState.waiterReadySeenMap = {};
    uiState.waiterKitchenReceiptNotices = [];
    uiState.waiterKitchenReceiptSeenMap = {};
    uiState.waiterDraftByComanda = {};
    uiState.itemSelector = { open: false, comandaId: "", mode: "increment" };
    saveState({ skipCloud: true, touchMeta: false });
    broadcastPresencePing();
    render();
  }

  function createProduct(form) {
    const actor = currentActor();
    const name = form.name.value.trim();
    const category = form.category.value;
    const subcategory = category === "Bar" ? "Geral" : "";
    const available = Boolean(form.available?.checked);
    const requiresKitchen = category === "Cozinha" ? true : category === "Ofertas" ? Boolean(form.offerNeedsKitchen?.checked) : false;
    const price = parseNumber(form.price.value);
    const stock = Math.max(0, Number(form.stock.value || 0));
    const prepTime = Math.max(0, Number(form.prepTime.value || 0));
    const cost = Math.max(0, parseNumber(form.cost.value));

    if (!name || !CATEGORIES.includes(category) || price <= 0) {
      alert("Preencha nome, categoria e preco valido.");
      return;
    }

    state.products.push({ id: state.seq.product++, name, category, subcategory, price, stock, prepTime, cost, available, requiresKitchen });
    appendAudit({ actor, type: "produto_add", detail: `Produto ${name} criado em ${categoryDisplay(category, subcategory)}.` });
    saveState();
    render();
  }

  function editProduct(productId) {
    const actor = currentActor();
    const p = state.products.find((prod) => prod.id === productId);
    if (!p) return;

    const name = prompt("Nome do produto:", p.name);
    if (name === null) return;
    const price = prompt("Preco:", String(p.price));
    if (price === null) return;
    const stock = prompt("Estoque:", String(p.stock));
    if (stock === null) return;
    const prepTime = prompt("Tempo de preparo (min):", String(p.prepTime || 0));
    if (prepTime === null) return;
    const cost = prompt("Custo unitario:", String(p.cost || 0));
    if (cost === null) return;
    const availablePrompt = prompt("Disponivel no cardapio? (sim/nao):", p.available === false ? "nao" : "sim");
    if (availablePrompt === null) return;
    const available = !["nao", "n", "0", "false"].includes(availablePrompt.trim().toLowerCase());
    p.subcategory = p.category === "Bar" ? "Geral" : "";
    if (p.category === "Cozinha") {
      p.requiresKitchen = true;
    } else if (p.category === "Ofertas") {
      const offerKitchenPrompt = prompt("Oferta depende da cozinha? (sim/nao):", p.requiresKitchen ? "sim" : "nao");
      if (offerKitchenPrompt === null) return;
      p.requiresKitchen = ["sim", "s", "1", "true"].includes(offerKitchenPrompt.trim().toLowerCase());
    } else {
      p.requiresKitchen = false;
    }

    p.name = name.trim() || p.name;
    p.price = Math.max(0, parseNumber(price));
    p.stock = Math.max(0, Number(stock));
    p.prepTime = Math.max(0, Number(prepTime));
    p.cost = Math.max(0, parseNumber(cost));
    p.available = available;

    appendAudit({ actor, type: "produto_edit", detail: `Produto ${p.name} alterado.` });
    saveState();
    render();
  }

  function toggleProductAvailability(productId) {
    const actor = currentActor();
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    product.available = product.available === false;
    appendAudit({
      actor,
      type: "produto_disponibilidade",
      detail: `Produto ${product.name} ${product.available ? "disponibilizado" : "indisponibilizado"} no cardapio.`
    });
    saveState();
    render();
  }

  function deleteProduct(productId) {
    const actor = currentActor();
    const p = state.products.find((prod) => prod.id === productId);
    if (!p) return;
    if (!confirm(`Apagar produto ${p.name}?`)) return;

    state.products = state.products.filter((prod) => prod.id !== productId);
    trackDeletedEntity("deletedProductIds", productId);
    appendAudit({ actor, type: "produto_delete", detail: `Produto ${p.name} removido.` });
    saveState();
    render();
  }

  function saveStock(form) {
    const actor = currentActor();
    for (const p of state.products) {
      const value = form[`stock-${p.id}`]?.value;
      if (value !== undefined) {
        p.stock = Math.max(0, Number(value || 0));
      }
    }
    appendAudit({ actor, type: "estoque_update", detail: "Estoque atualizado manualmente pelo administrador." });
    saveState();
    render();
  }

  function createEmployee(form) {
    const actor = currentActor();
    const name = form.name.value.trim();
    const role = form.role.value;
    const functionName = roleLabel(role);
    const loginValue = form.login.value.trim();
    const password = form.password.value;

    if (!name || !loginValue || !password) {
      alert("Preencha nome, login e senha.");
      return;
    }
    if (role !== "waiter" && role !== "cook") {
      alert("Selecione um tipo valido de funcionario.");
      return;
    }

    if (state.users.some((u) => u.login === loginValue)) {
      alert("Login ja existe.");
      return;
    }

    state.users.push({
      id: state.seq.user++,
      role,
      name,
      functionName,
      login: loginValue,
      password,
      active: true
    });

    appendAudit({ actor, type: "funcionario_add", detail: `${roleLabel(role)} ${name} criado.` });
    saveState();
    render();
  }

  function editEmployee(userId) {
    const actor = currentActor();
    const user = state.users.find((u) => u.id === userId && (u.role === "waiter" || u.role === "cook"));
    if (!user) return;

    const rolePrompt = prompt("Tipo (waiter ou cook):", user.role);
    if (rolePrompt === null) return;
    const role = rolePrompt.trim().toLowerCase();
    if (role !== "waiter" && role !== "cook") {
      alert("Tipo invalido. Use waiter ou cook.");
      return;
    }
    const name = prompt("Nome:", user.name);
    if (name === null) return;
    const functionName = prompt("Funcao:", user.functionName || roleLabel(role));
    if (functionName === null) return;
    const loginValue = prompt("Login:", user.login);
    if (loginValue === null) return;
    const password = prompt("Senha:", user.password);
    if (password === null) return;

    const conflict = state.users.find((u) => u.login === loginValue && u.id !== user.id);
    if (conflict) {
      alert("Esse login ja esta em uso.");
      return;
    }

    user.role = role;
    user.name = name.trim() || user.name;
    user.functionName = functionName.trim() || user.functionName;
    user.login = loginValue.trim();
    user.password = password;

    appendAudit({ actor, type: "funcionario_edit", detail: `${roleLabel(user.role)} ${user.name} alterado.` });
    saveState();
    render();
  }

  function updateOwnAdminCredentials(form) {
    const actor = currentActor();
    if (actor.role !== "admin") {
      alert("Apenas administrador pode alterar este acesso.");
      return;
    }

    const adminUser = state.users.find((u) => u.id === actor.id && u.role === "admin");
    if (!adminUser || adminUser.active === false) {
      alert("Administrador logado nao encontrado.");
      return;
    }

    const currentPassword = String(form.currentPassword.value || "");
    const newLogin = String(form.newLogin.value || "").trim();
    const newPassword = String(form.newPassword.value || "");
    const confirmPassword = String(form.confirmPassword.value || "");

    if (!currentPassword || !newLogin || !newPassword || !confirmPassword) {
      alert("Preencha login, senha atual e nova senha.");
      return;
    }
    if (currentPassword !== adminUser.password) {
      alert("Senha atual incorreta.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Confirmacao da nova senha nao confere.");
      return;
    }

    const conflict = state.users.find((u) => u.login === newLogin && u.id !== adminUser.id);
    if (conflict) {
      alert("Esse login ja esta em uso.");
      return;
    }

    const loginChanged = newLogin !== adminUser.login;
    const passwordChanged = newPassword !== adminUser.password;
    if (!loginChanged && !passwordChanged) {
      alert("Nenhuma alteracao detectada.");
      return;
    }

    const oldLogin = adminUser.login;
    adminUser.login = newLogin;
    adminUser.password = newPassword;

    const details = [];
    if (loginChanged) details.push(`login: ${oldLogin} -> ${adminUser.login}`);
    if (passwordChanged) details.push("senha atualizada");
    appendAudit({
      actor,
      type: "admin_credenciais_update",
      detail: `Admin ${adminUser.name} alterou o proprio acesso (${details.join(" | ")}).`
    });

    saveState();
    alert("Login e senha do administrador atualizados.");
    render();
  }

  function deleteEmployee(userId) {
    const actor = currentActor();
    const employee = state.users.find((u) => u.id === userId && (u.role === "waiter" || u.role === "cook"));
    if (!employee) return;
    if (!confirm(`Apagar acesso de ${roleLabel(employee.role)} ${employee.name}?`)) return;

    state.users = state.users.filter((u) => u.id !== userId);
    trackDeletedEntity("deletedUserIds", userId);
    appendAudit({ actor, type: "funcionario_delete", detail: `${roleLabel(employee.role)} ${employee.name} removido.` });

    if (sessionUserId === userId) {
      sessionUserId = null;
      persistSessionUserId(null);
    }

    saveState();
    render();
  }

  function receivePayable(id) {
    const actor = currentActor();
    const payable = state.payables.find((p) => p.id === id);
    if (!payable || payable.status === "pago") return;

    const msg = "Metodo de pagamento (dinheiro, maquineta_debito, maquineta_credito, pix):";
    const method = prompt(msg, "dinheiro");
    if (method === null) return;

    payable.status = "pago";
    payable.paidAt = isoNow();
    payable.paidMethod = method;
    appendAudit({ actor, type: "fiado_pago", detail: `Fiado da comanda ${payable.comandaId} marcado como pago.` });
    saveState();
    render();
  }

  function createComanda(form) {
    const actor = currentActor();
    const isAvulsa = formCheckboxChecked(form, "isAvulsa", false);
    const tableInput = form.table.value.trim();
    const table = isAvulsa ? "Venda Avulsa" : tableInput;
    const customer = form.customer.value.trim();

    if (!table) {
      alert("Informe mesa ou referencia.");
      return;
    }

    const comanda = {
      id: `CMD-${String(state.seq.comanda++).padStart(4, "0")}`,
      table,
      customer,
      createdAt: isoNow(),
      createdBy: actor.id,
      status: "aberta",
      notes: isAvulsa ? ["Comanda marcada como venda avulsa na abertura."] : [],
      items: [],
      events: [],
      payment: null,
      pixCodeDraft: null,
      kitchenAlertUnread: false,
      isAvulsa: Boolean(isAvulsa)
    };

    state.openComandas.push(comanda);
    appendComandaEvent(comanda, {
      actor,
      type: "comanda_aberta",
      detail: `Comanda aberta na ${table}${customer ? ` para ${customer}` : ""}${isAvulsa ? " | marcada como avulsa" : ""}.`
    });

    uiState.waiterTab = "abrir";
    uiState.waiterActiveComandaId = comanda.id;
    uiState.waiterCollapsedByComanda[comanda.id] = true;
    saveState();
    render();
  }

  function createQuickSale(form) {
    const actor = currentActor();
    const category = form.category.value;
    const productId = Number(form.productId.value || 0);
    const qty = Math.max(1, Number(form.qty.value || 1));
    const paymentMethod = form.paymentMethod.value;
    const customer = form.customer.value.trim();
    const note = form.note.value.trim();
    const isDeliveryRaw = Boolean(form.isDelivery?.checked);
    const deliveryRecipient = String(form.deliveryRecipient?.value || "").trim();
    const deliveryLocation = String(form.deliveryLocation?.value || "").trim();
    const paidConfirm = formCheckboxChecked(form, "paidConfirm", uiState.quickSalePaidConfirm);
    uiState.quickSalePaidConfirm = paidConfirm;
    const requiresPaidConfirm = paymentMethod !== "fiado";

    if (requiresPaidConfirm && !paidConfirm) {
      alert("Confirme que a venda foi paga para finalizar.");
      return;
    }

    const product = state.products.find((p) => p.id === productId && p.category === category);
    if (!product) {
      alert("Produto invalido para venda avulsa.");
      return;
    }
    if (product.available === false) {
      alert(`Produto ${product.name} esta indisponivel no cardapio.`);
      return;
    }
    if (product.stock < qty) {
      alert(`Estoque insuficiente para ${product.name}. Disponivel: ${product.stock}`);
      return;
    }
    const needsKitchen = productNeedsKitchen(product);
    const isDelivery = needsKitchen && isDeliveryRaw;
    if (needsKitchen && isDelivery && (!deliveryRecipient || !deliveryLocation)) {
      alert("Para entrega na cozinha, informe quem recebe e o local.");
      return;
    }

    product.stock -= qty;

    if (needsKitchen) {
      const waitingBefore = totalKitchenQueueMs();
      const item = {
        id: `IT-${String(state.seq.item++).padStart(5, "0")}`,
        productId: product.id,
        name: product.name,
        category: product.category,
        qty,
        priceAtSale: parseNumber(product.price),
        costAtSale: parseNumber(product.cost || 0),
        prepTimeAtSale: Number(product.prepTime || 0),
        requiresKitchen: Boolean(product.requiresKitchen),
        needsKitchen: true,
        waiterNote: note,
        noteType: "",
        createdAt: isoNow(),
        delivered: false,
        deliveredAt: null,
        kitchenStatus: "fila",
        kitchenStatusAt: isoNow(),
        kitchenStatusById: null,
        kitchenStatusByName: "",
        kitchenPriority: "normal",
        kitchenPriorityById: null,
        kitchenPriorityByName: "",
        kitchenPriorityAt: isoNow(),
        kitchenReceivedAt: null,
        kitchenReceivedById: null,
        kitchenReceivedByName: "",
        kitchenAlertUnread: true,
        waiterVisualState: "new",
        waiterVisualUpdatedAt: isoNow(),
        deliveryRequested: isDelivery,
        deliveryRecipient: isDelivery ? deliveryRecipient : "",
        deliveryLocation: isDelivery ? deliveryLocation : "",
        canceled: false,
        canceledAt: null,
        cancelReason: "",
        cancelNote: ""
      };
      const prepMs = item.prepTimeAtSale * qty * 60 * 1000;
      item.etaAt = new Date(Date.now() + waitingBefore + prepMs).toISOString();

      const saleComanda = {
        id: `AVK-${String(state.seq.sale++).padStart(5, "0")}`,
        table: product.category === "Ofertas" ? "Avulsa Oferta (Cozinha)" : "Avulsa Cozinha",
        customer: customer || (isDelivery ? deliveryRecipient : ""),
        createdAt: isoNow(),
        createdBy: actor.id,
        status: "aberta",
        notes: [product.category === "Ofertas" ? "Venda avulsa de oferta (cozinha)" : "Venda avulsa de cozinha", ...(note ? [note] : [])],
        items: [item],
        events: [],
        payment: {
          method: paymentMethod,
          methodLabel: paymentLabel(paymentMethod),
          verifiedAt: isoNow(),
          customerName: customer || (isDelivery ? deliveryRecipient : ""),
          pixCode: ""
        },
        pixCodeDraft: null,
        kitchenAlertUnread: true,
        isQuickKitchenSale: true,
        quickSalePrepaid: true
      };

      appendComandaEvent(saleComanda, {
        actor,
        type: "venda_avulsa_cozinha",
        detail: `Pedido avulso com fluxo de cozinha ${item.name} x${qty} criado. Pagamento ${paymentLabel(paymentMethod)}.${isDelivery ? ` Entrega para ${deliveryRecipient} em ${deliveryLocation}.` : ""}`,
        itemId: item.id
      });

      state.openComandas.push(saleComanda);
      appendAudit({
        actor,
        type: "venda_avulsa_cozinha",
        detail: `Comanda ${saleComanda.id} enviada para cozinha (${item.name} x${qty}).`,
        comandaId: saleComanda.id
      });
      if (actor.role === "waiter") {
        uiState.waiterTab = "abertas";
        uiState.waiterCollapsedByComanda[saleComanda.id] = true;
        uiState.waiterActiveComandaId = saleComanda.id;
      }
      saveState();
      if (AUTO_OPEN_KITCHEN_PREVIEW_ON_ADD) {
        printKitchenTicket(saleComanda, [item], actor, { reason: "Venda avulsa cozinha" });
      }
      render();
      return;
    }

    const saleComanda = {
      id: `AV-${String(state.seq.sale++).padStart(5, "0")}`,
      table: "Venda Avulsa",
      customer: customer || "",
      createdAt: isoNow(),
      closedAt: isoNow(),
      createdBy: actor.id,
      status: "finalizada",
      notes: note ? [note] : ["Venda avulsa"],
      items: [
        {
          id: `IT-${String(state.seq.item++).padStart(5, "0")}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          qty,
          priceAtSale: parseNumber(product.price),
          costAtSale: parseNumber(product.cost || 0),
          prepTimeAtSale: Number(product.prepTime || 0),
          requiresKitchen: false,
          needsKitchen: false,
          waiterNote: note,
          noteType: "",
          createdAt: isoNow(),
          delivered: true,
          deliveredAt: isoNow(),
          kitchenStatus: "",
          kitchenStatusAt: null,
          kitchenStatusById: null,
          kitchenStatusByName: "",
          kitchenPriority: "",
          kitchenPriorityById: null,
          kitchenPriorityByName: "",
          kitchenPriorityAt: null,
          kitchenReceivedAt: null,
          kitchenReceivedById: null,
          kitchenReceivedByName: "",
          kitchenAlertUnread: false,
          canceled: false,
          canceledAt: null,
          cancelReason: "",
          cancelNote: ""
        }
      ],
      events: [
        {
          ts: isoNow(),
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          type: "venda_avulsa",
          detail: `Venda avulsa de ${product.name} x${qty} finalizada.`,
          reason: "",
          itemId: null
        }
      ],
      payment: {
        method: paymentMethod,
        methodLabel: paymentLabel(paymentMethod),
        verifiedAt: isoNow(),
        customerName: customer || "",
        pixCode: ""
      },
      pixCodeDraft: null,
      kitchenAlertUnread: false
    };

    state.closedComandas.unshift(saleComanda);
    appendAudit({
      actor,
      type: "venda_avulsa",
      detail: `Venda avulsa ${saleComanda.id}: ${product.name} x${qty} (${paymentLabel(paymentMethod)}).`,
      comandaId: saleComanda.id
    });
    saveState();
    render();
  }

  function addItemToComanda(form) {
    const actor = currentActor();
    const comandaId = form.dataset.comandaId;
    const comanda = findOpenComandaForActor(comandaId, actor, { silent: true });
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return;
    }

    const queued = getWaiterDraftItems(comandaId);
    let draftsToAdd = [];
    if (queued.length) {
      draftsToAdd = queued.map((draft) => ({ ...draft }));
    } else {
      const parsed = parseItemDraftFromForm(form);
      if (parsed.error) {
        alert(parsed.error);
        return;
      }
      draftsToAdd = [parsed.value];
    }

    const validationErrors = validateDraftBatch(draftsToAdd);
    if (validationErrors.length) {
      alert(`Nao foi possivel adicionar os itens:\n- ${validationErrors.slice(0, 5).join("\n- ")}`);
      return;
    }

    for (const draft of draftsToAdd) {
      appendDraftItemToComanda(comanda, actor, draft);
    }

    clearWaiterDraftItems(comandaId);
    form.qty.value = "1";
    form.waiterNote.value = "";
    if (form.isDelivery) form.isDelivery.checked = false;
    if (form.deliveryRecipient) form.deliveryRecipient.value = "";
    if (form.deliveryLocation) form.deliveryLocation.value = "";

    saveState();
    if (AUTO_OPEN_KITCHEN_PREVIEW_ON_ADD) {
      const kitchenItemsToPreview = draftsToAdd
        .map((draft, index) => comanda.items?.[comanda.items.length - draftsToAdd.length + index])
        .filter((item) => item && itemNeedsKitchen(item));
      if (kitchenItemsToPreview.length) {
        printKitchenTicket(comanda, kitchenItemsToPreview, actor, { reason: "Novo pedido" });
      }
    }
    render();
  }

  function incrementItem(comandaId, itemId, amount = 1) {
    const actor = currentActor();
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.canceled) return;
    const delta = Math.max(1, Math.floor(Number(amount || 1)));

    const product = state.products.find((p) => p.id === item.productId);
    if (product && product.available === false) {
      alert(`Produto ${product.name} esta indisponivel no cardapio.`);
      return;
    }
    if (!product || Number(product.stock || 0) < delta) {
      alert(`Sem estoque para adicionar essa quantidade. Disponivel: ${product?.stock ?? 0}.`);
      return;
    }

    product.stock -= delta;
    item.qty = parseNumber(item.qty || 0) + delta;
    item.lastIncrementAt = isoNow();
    item.waiterVisualState = "new";
    item.waiterVisualUpdatedAt = isoNow();

    appendComandaEvent(comanda, {
      actor,
      type: "item_incrementado",
      detail: `Item ${item.name} incrementado (+${delta}). Nova quantidade: ${item.qty}.`,
      itemId: item.id
    });

    saveState();
    if (AUTO_OPEN_KITCHEN_PREVIEW_ON_ADD && itemNeedsKitchen(item) && !item.delivered && !item.canceled) {
      const extraItem = {
        ...item,
        qty: delta,
        waiterNote: item.waiterNote ? `${item.waiterNote} | Acrescimo +${delta}` : `Acrescimo +${delta}`
      };
      printKitchenTicket(comanda, [extraItem], actor, { reason: "Acrescimo de item" });
    }
    render();
  }

  function setKitchenItemPriority(comandaId, itemId, priority) {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) {
      alert("Somente administrador pode alterar prioridade de pedido.");
      return;
    }
    const rawPriority = String(priority || "").trim().toLowerCase();
    const mappedPriority = rawPriority === "media" ? "comum" : rawPriority === "altissima" ? "maxima" : rawPriority;
    if (!["normal", "comum", "alta", "maxima"].includes(mappedPriority)) return;

    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    const item = (comanda.items || []).find((entry) => entry.id === itemId);
    if (!item || !itemNeedsKitchen(item) || item.canceled || item.delivered) return;
    const currentPriority = item.kitchenPriority || "normal";
    const rowDetailsKey = detailKey("kitchen-row", comanda.id, item.id);
    if (currentPriority === mappedPriority) {
      if (mappedPriority === "comum") {
        setAdminKitchenRowCollapsed(comanda.id, item.id, true);
        uiState.persistedDetailsOpen[rowDetailsKey] = false;
        render();
      }
      return;
    }

    item.kitchenPriority = mappedPriority;
    item.kitchenPriorityById = actor.id;
    item.kitchenPriorityByName = actor.name;
    item.kitchenPriorityAt = isoNow();

    if (mappedPriority === "comum") {
      setAdminKitchenRowCollapsed(comanda.id, item.id, true);
      uiState.persistedDetailsOpen[rowDetailsKey] = false;
    } else {
      setAdminKitchenRowCollapsed(comanda.id, item.id, false);
    }

    appendComandaEvent(comanda, {
      actor,
      type: "cozinha_prioridade",
      detail: `Prioridade do pedido ${item.name} alterada para ${adminMonitorPriorityLabel(mappedPriority)}.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function appendCookHistoryEntry(comanda, item, actor, status) {
    state.cookHistory = state.cookHistory || [];
    state.cookHistory.unshift({
      id: `KHS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      deliveredAt: status === "entregue" ? item.deliveredAt : null,
      updatedAt: item.kitchenStatusAt,
      comandaId: comanda.id,
      table: comanda.table,
      customer: comanda.customer || "",
      itemId: item.id,
      itemName: item.name,
      qty: item.qty,
      waiterNote: item.waiterNote || "",
      status,
      priority: item.kitchenPriority || "normal",
      cookId: actor.id,
      cookName: actor.name,
      deliveryRequested: Boolean(item.deliveryRequested),
      deliveryRecipient: item.deliveryRecipient || "",
      deliveryLocation: item.deliveryLocation || ""
    });
  }

  function setKitchenItemStatus(comandaId, itemId, status) {
    const actor = currentActor();
    if (actor.role !== "cook" && !isAdminOrDev(actor)) {
      alert("Apenas cozinheiro ou administrador podem alterar status da cozinha.");
      return;
    }
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || !itemNeedsKitchen(item) || item.canceled) return;

    if (!["cozinhando", "em_falta", "entregue"].includes(status)) return;
    if (status === "entregue" && item.delivered) return;

    item.kitchenStatus = status;
    item.kitchenStatusAt = isoNow();
    item.kitchenStatusById = actor.id;
    item.kitchenStatusByName = actor.name;
    item.kitchenAlertUnread = true;
    comanda.kitchenAlertUnread = true;

    if (status === "entregue") {
      item.delivered = true;
      item.deliveredAt = isoNow();
      item.waiterVisualState = "ready";
      item.waiterVisualUpdatedAt = isoNow();
      appendCookHistoryEntry(comanda, item, actor, status);
    } else if (status === "em_falta") {
      item.waiterVisualState = "";
      item.waiterVisualUpdatedAt = isoNow();
      appendCookHistoryEntry(comanda, item, actor, status);
    } else if (item.waiterVisualState === "new" || item.waiterVisualState === "ready" || item.waiterVisualState === "seen") {
      item.waiterVisualState = "";
      item.waiterVisualUpdatedAt = isoNow();
    }

    appendComandaEvent(comanda, {
      actor,
      type: "cozinha_status",
      detail: `Pedido ${item.name} da comanda ${comanda.id} atualizado para ${kitchenStatusLabel(status)}.`,
      itemId: item.id
    });

    if ((status === "entregue" || status === "em_falta") && comanda.isQuickKitchenSale) {
      const hasPendingKitchenItems = (comanda.items || []).some((i) => isKitchenOrderActive(i));
      if (!hasPendingKitchenItems) {
        comanda.status = "finalizada";
        comanda.closedAt = isoNow();
        comanda.kitchenAlertUnread = false;
        appendComandaEvent(comanda, {
          actor,
          type: "comanda_finalizada_auto",
          detail: `Comanda avulsa ${comanda.id} finalizada automaticamente apos conclusao da cozinha.`
        });
        state.openComandas = state.openComandas.filter((c) => c.id !== comanda.id);
        state.closedComandas.unshift(comanda);
        clearWaiterDraftItems(comanda.id);
        delete uiState.finalizeOpenByComanda[comanda.id];
        if (uiState.waiterActiveComandaId === comanda.id) {
          uiState.waiterActiveComandaId = null;
        }
      }
    }

    saveState();
    render();
  }

  function deliverItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.delivered || item.canceled) return;
    if (itemNeedsKitchen(item)) {
      setKitchenItemStatus(comandaId, itemId, "entregue");
      return;
    }

    item.delivered = true;
    item.deliveredAt = isoNow();
    item.waiterVisualState = "";
    item.waiterVisualUpdatedAt = isoNow();

    appendComandaEvent(comanda, {
      actor,
      type: "item_entregue",
      detail: `Item ${item.name} marcado como entregue.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function cancelItem(comandaId, itemId, options = {}) {
    const actor = currentActor();
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.canceled) return;

    const currentQty = Math.max(1, parseNumber(item.qty || 1));
    const requestedQtyRaw = options.qty !== undefined ? parseNumber(options.qty) : currentQty;
    if (!Number.isFinite(requestedQtyRaw) || requestedQtyRaw <= 0) {
      alert("Quantidade invalida para devolucao/cancelamento.");
      return;
    }
    const qtyToCancel = Math.min(currentQty, Math.max(1, Math.floor(requestedQtyRaw)));

    let reason = "";
    let note = "";
    if (options.skipPrompt) {
      reason = String(options.reason || "Desistencia de pedido").trim() || "Desistencia de pedido";
      note = String(options.note || "").trim();
    } else {
      const reasonPrompt = `Motivo da devolucao/cancelamento:\n${CANCEL_REASONS.join(" | ")}`;
      const chosenReason = prompt(reasonPrompt, "Desistencia de pedido");
      if (chosenReason === null) return;
      reason = chosenReason;
      note = prompt("Observacao adicional (opcional):", "") || "";
    }

    const product = state.products.find((p) => p.id === item.productId);
    if (product) {
      product.stock += qtyToCancel;
    }

    if (qtyToCancel >= currentQty) {
      item.canceled = true;
      item.canceledAt = isoNow();
      item.cancelReason = reason;
      item.cancelNote = note;
      item.kitchenAlertUnread = false;
      item.waiterVisualState = "";
      item.waiterVisualUpdatedAt = isoNow();
      appendComandaEvent(comanda, {
        actor,
        type: "item_cancelado",
        detail: `Item ${item.name} cancelado/devolvido e estoque ajustado.`,
        reason,
        itemId: item.id
      });
    } else {
      item.qty = currentQty - qtyToCancel;
      item.lastIncrementAt = isoNow();
      item.waiterVisualState = "";
      item.waiterVisualUpdatedAt = isoNow();
      appendComandaEvent(comanda, {
        actor,
        type: "item_reduzido",
        detail: `Item ${item.name} reduzido em ${qtyToCancel}. Quantidade restante: ${item.qty}. Estoque ajustado.`,
        reason,
        itemId: item.id
      });
    }

    comanda.kitchenAlertUnread = kitchenAlertCount(comanda) > 0;

    saveState();
    render();
  }

  function addComandaNote(comandaId) {
    const actor = currentActor();
    const comanda = findOpenComandaForActor(comandaId, actor);
    if (!comanda) return;

    const note = prompt("Digite a observacao da comanda:", "");
    if (!note) return;

    comanda.notes = comanda.notes || [];
    comanda.notes.push(note.trim());

    appendComandaEvent(comanda, {
      actor,
      type: "comanda_obs",
      detail: `Observacao adicionada: ${note.trim()}`
    });

    saveState();
    render();
  }

  function findComandaForAdminEdition(comandaId) {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) {
      alert("Somente administrador pode editar comandas por este painel.");
      return null;
    }
    const comanda = findComandaForDetails(String(comandaId || ""));
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return null;
    }
    if (!isComandaInOpenList(comanda.id)) {
      alert("Comandas fechadas/historicas nao podem ser editadas. Apenas visualizacao.");
      return null;
    }
    return comanda;
  }

  function isComandaInOpenList(comandaId) {
    return state.openComandas.some((entry) => String(entry?.id || "") === String(comandaId || ""));
  }

  function openComandaEditFlow(comandaId) {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) return false;
    const comanda = findOpenComanda(String(comandaId || ""));
    if (!comanda) return false;
    const key = String(comanda.id || "").trim();
    if (!key) return false;
    uiState.waiterActiveComandaId = key;
    uiState.waiterCollapsedByComanda[key] = false;
    uiState.waiterTab = "abrir";
    uiState.adminInlineEditComandaId = key;
    uiState.comandaDetailsId = key;
    return true;
  }

  function resolveProductForAdminInput(rawInput) {
    const input = String(rawInput || "").trim();
    if (!input) return null;
    const byId = Number(input);
    if (Number.isFinite(byId) && byId > 0) {
      const exactById = state.products.find((product) => Number(product.id) === byId);
      if (exactById) return exactById;
    }
    const query = input.toLowerCase();
    const exactByName = state.products.find((product) => String(product.name || "").trim().toLowerCase() === query);
    if (exactByName) return exactByName;
    const matches = state.products.filter((product) => String(product.name || "").toLowerCase().includes(query));
    if (!matches.length) return null;
    if (matches.length === 1) return matches[0];
    const options = matches.slice(0, 8).map((product) => `${product.id} - ${product.name}`).join(" | ");
    alert(`Foram encontrados varios produtos. Seja mais especifico.\n${options}`);
    return null;
  }

  function adminEditComanda(comandaId) {
    const actor = currentActor();
    const comanda = findComandaForAdminEdition(comandaId);
    if (!comanda) return;

    const nextTableRaw = prompt("Mesa/referencia:", String(comanda.table || ""));
    if (nextTableRaw === null) return;
    const nextCustomerRaw = prompt("Cliente:", String(comanda.customer || ""));
    if (nextCustomerRaw === null) return;
    const extraNoteRaw = prompt("Observacao da edicao (opcional):", "");
    if (extraNoteRaw === null) return;

    const nextTable = String(nextTableRaw || "").trim() || String(comanda.table || "-");
    const nextCustomer = String(nextCustomerRaw || "").trim();
    const extraNote = String(extraNoteRaw || "").trim();

    const changes = [];
    if (String(comanda.table || "") !== nextTable) {
      changes.push(`mesa/ref ${comanda.table || "-"} -> ${nextTable}`);
      comanda.table = nextTable;
    }
    if (String(comanda.customer || "") !== nextCustomer) {
      changes.push(`cliente ${comanda.customer || "-"} -> ${nextCustomer || "-"}`);
      comanda.customer = nextCustomer;
    }
    if (extraNote) {
      comanda.notes = Array.isArray(comanda.notes) ? comanda.notes : [];
      comanda.notes.push(`Edicao do administrador: ${extraNote}`);
      changes.push(`obs: ${extraNote}`);
    }

    if (!changes.length) {
      alert("Nenhuma alteracao informada.");
      return;
    }

    appendComandaEvent(comanda, {
      actor,
      type: "admin_comanda_edit",
      detail: `Comanda alterada pelo administrador. ${changes.join(" | ")}.`
    });

    saveState();
    render();
  }

  function adminAddComandaItem(comandaId) {
    const actor = currentActor();
    const comanda = findComandaForAdminEdition(comandaId);
    if (!comanda) return;
    if (!state.products.length) {
      alert("Nao ha produtos cadastrados para adicionar.");
      return;
    }

    const productHint = state.products
      .slice(0, 8)
      .map((product) => `${product.id}-${product.name}`)
      .join(" | ");
    const productInput = prompt(`Produto por codigo ou nome.\nEx.: ${productHint}`);
    if (productInput === null) return;
    const product = resolveProductForAdminInput(productInput);
    if (!product) {
      alert("Produto nao encontrado.");
      return;
    }

    const qtyInput = prompt("Quantidade:", "1");
    if (qtyInput === null) return;
    const qty = Math.max(1, Math.floor(Number(qtyInput || 1)));
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Quantidade invalida.");
      return;
    }

    const noteInput = prompt("Observacao do item (opcional):", "");
    if (noteInput === null) return;
    const waiterNote = String(noteInput || "").trim();

    const isOpenComanda = isComandaInOpenList(comanda.id);
    if (isOpenComanda && Number(product.stock || 0) < qty) {
      alert(`Estoque insuficiente para ${product.name}. Disponivel: ${product.stock}.`);
      return;
    }

    const draft = {
      category: product.category,
      productId: product.id,
      qty,
      waiterNote,
      needsKitchen: productNeedsKitchen(product),
      isDelivery: false,
      deliveryRecipient: "",
      deliveryLocation: ""
    };

    const stockInfo = isOpenComanda ? "" : " Estoque nao foi alterado (comanda fechada/historica).";
    const createdItem = appendDraftItemToComanda(comanda, actor, draft, {
      adjustStock: isOpenComanda,
      eventType: "admin_item_add",
      eventDetail: `Item ${product.name} x${qty} adicionado pelo administrador.${stockInfo}`
    });

    if (!createdItem) {
      alert("Nao foi possivel adicionar o item.");
      return;
    }

    if (!isOpenComanda) {
      createdItem.kitchenAlertUnread = false;
      if (itemNeedsKitchen(createdItem)) {
        createdItem.kitchenStatus = "entregue";
        createdItem.kitchenStatusAt = isoNow();
      }
      createdItem.delivered = true;
      createdItem.deliveredAt = isoNow();
      comanda.kitchenAlertUnread = false;
    }

    saveState();
    render();
  }

  function adminEditComandaItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findComandaForAdminEdition(comandaId);
    if (!comanda) return;
    const item = (comanda.items || []).find((entry) => String(entry.id || "") === String(itemId || ""));
    if (!item) {
      alert("Item nao encontrado.");
      return;
    }

    const nextNameRaw = prompt("Nome do item:", String(item.name || ""));
    if (nextNameRaw === null) return;
    const nextQtyRaw = prompt("Quantidade:", String(item.qty || 1));
    if (nextQtyRaw === null) return;
    const nextPriceRaw = prompt("Preco unitario:", String(item.priceAtSale || 0));
    if (nextPriceRaw === null) return;
    const nextNoteRaw = prompt("Observacao:", String(item.waiterNote || ""));
    if (nextNoteRaw === null) return;

    const nextName = String(nextNameRaw || "").trim() || String(item.name || "");
    const nextQty = Math.max(1, Math.floor(parseNumber(nextQtyRaw || 1)));
    const nextPrice = Math.max(0, parseNumber(nextPriceRaw));
    const nextNote = String(nextNoteRaw || "").trim();
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      alert("Quantidade invalida.");
      return;
    }

    const prevName = String(item.name || "");
    const prevQty = parseNumber(item.qty || 0);
    const prevPrice = parseNumber(item.priceAtSale || 0);
    const prevNote = String(item.waiterNote || "");
    const isOpenComanda = isComandaInOpenList(comanda.id);
    const stockChanges = [];
    const product = state.products.find((entry) => Number(entry.id) === Number(item.productId));
    const qtyDelta = nextQty - prevQty;

    if (isOpenComanda && product && qtyDelta !== 0) {
      if (qtyDelta > 0) {
        if (Number(product.stock || 0) < qtyDelta) {
          alert(`Estoque insuficiente para aumentar ${qtyDelta} unidade(s) de ${product.name}. Disponivel: ${product.stock}.`);
          return;
        }
        product.stock -= qtyDelta;
        stockChanges.push(`estoque -${qtyDelta}`);
      } else {
        const restore = Math.abs(qtyDelta);
        product.stock += restore;
        stockChanges.push(`estoque +${restore}`);
      }
    }

    item.name = nextName;
    item.qty = nextQty;
    item.priceAtSale = nextPrice;
    item.waiterNote = nextNote;
    item.lastIncrementAt = isoNow();

    const changes = [];
    if (prevName !== nextName) changes.push(`nome ${prevName || "-"} -> ${nextName || "-"}`);
    if (prevQty !== nextQty) changes.push(`qtd ${prevQty} -> ${nextQty}`);
    if (prevPrice !== nextPrice) changes.push(`preco ${money(prevPrice)} -> ${money(nextPrice)}`);
    if (prevNote !== nextNote) changes.push(`obs ${prevNote || "-"} -> ${nextNote || "-"}`);
    if (stockChanges.length) changes.push(stockChanges.join(", "));

    if (!changes.length) {
      alert("Nenhuma alteracao informada.");
      return;
    }

    appendComandaEvent(comanda, {
      actor,
      type: "admin_item_edit",
      detail: `Item ${item.name} alterado pelo administrador. ${changes.join(" | ")}.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function adminRemoveComandaItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findComandaForAdminEdition(comandaId);
    if (!comanda) return;
    const item = (comanda.items || []).find((entry) => String(entry.id || "") === String(itemId || ""));
    if (!item) {
      alert("Item nao encontrado.");
      return;
    }
    if (!confirm(`Remover item ${item.name} da comanda ${comanda.id}?`)) return;

    const isOpenComanda = isComandaInOpenList(comanda.id);
    const qty = Math.max(0, parseNumber(item.qty || 0));
    const product = state.products.find((entry) => Number(entry.id) === Number(item.productId));
    let stockInfo = "";
    if (isOpenComanda && product && qty > 0) {
      product.stock += qty;
      stockInfo = ` Estoque devolvido: +${qty}.`;
    } else if (!isOpenComanda) {
      stockInfo = " Estoque nao foi alterado (comanda fechada/historica).";
    }

    comanda.items = (comanda.items || []).filter((entry) => String(entry.id || "") !== String(itemId || ""));
    comanda.kitchenAlertUnread = kitchenAlertCount(comanda) > 0;

    appendComandaEvent(comanda, {
      actor,
      type: "admin_item_remove",
      detail: `Item ${item.name} x${qty} removido pelo administrador.${stockInfo}`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function toggleFinalize(comandaId) {
    uiState.finalizeOpenByComanda[comandaId] = !uiState.finalizeOpenByComanda[comandaId];
    const comanda = findOpenComandaForActor(comandaId, currentActor(), { silent: true });
    if (!comanda) {
      delete uiState.finalizeOpenByComanda[comandaId];
      render();
      return;
    }
    if (uiState.finalizeOpenByComanda[comandaId] && comanda && !comanda.pixCodeDraft) {
      comanda.pixCodeDraft = generatePixCode();
      saveState();
    }
    render();
  }

  function parseFinalizePaymentSplits(form, total) {
    const validMethods = new Set(PAYMENT_METHODS.map((entry) => entry.value));
    const rawRows = [
      {
        method: String(form.paymentMethodPrimary?.value || "").trim(),
        amountRaw: String(form.paymentAmountPrimary?.value || "0").trim(),
        rowName: "pagamento principal"
      },
      {
        method: String(form.paymentMethodExtra1?.value || "").trim(),
        amountRaw: String(form.paymentAmountExtra1?.value || "0").trim(),
        rowName: "pagamento complementar 1"
      },
      {
        method: String(form.paymentMethodExtra2?.value || "").trim(),
        amountRaw: String(form.paymentAmountExtra2?.value || "0").trim(),
        rowName: "pagamento complementar 2"
      }
    ];

    const chosenRows = [];
    for (const row of rawRows) {
      const amount = Math.max(0, parseNumber(row.amountRaw));
      if (!row.method && !(amount > 0)) continue;
      if (!row.method && amount > 0) {
        return { error: `Informe a forma do ${row.rowName}.` };
      }
      if (!validMethods.has(row.method)) {
        return { error: `Forma de pagamento invalida no ${row.rowName}.` };
      }
      if (!(amount > 0)) {
        return { error: `Informe valor maior que zero para ${paymentLabel(row.method)}.` };
      }
      chosenRows.push({ method: row.method, amount });
    }

    if (!chosenRows.length) {
      return { error: "Informe ao menos uma forma de pagamento." };
    }

    const splits = normalizePaymentSplits(chosenRows);
    const totalPaid = splits.reduce((sum, row) => sum + parseNumber(row.amount || 0), 0);
    if (Math.abs(totalPaid - parseNumber(total || 0)) > 0.01) {
      return {
        error: `A soma dos pagamentos (${money(totalPaid)}) precisa ser igual ao total da comanda (${money(total)}).`
      };
    }
    return { value: splits };
  }

  function updateFinalizePaymentUi(form) {
    if (!form) return;
    const fiadoBox = form.querySelector('[data-role="fiado-box"]');
    const pixBox = form.querySelector('[data-role="pix-box"]');
    const manualCheck = form.querySelector('[data-role="manual-check"]');
    const manualCheckNote = form.querySelector('[data-role="manual-check-note"]');
    const breakdownNote = form.querySelector('[data-role="payment-breakdown-note"]');
    const comandaId = String(form.dataset.comandaId || "");
    const comanda = findOpenComanda(comandaId);
    const total = comanda ? comandaTotal(comanda) : 0;
    const selectedMethods = [
      String(form.paymentMethodPrimary?.value || "").trim(),
      String(form.paymentMethodExtra1?.value || "").trim(),
      String(form.paymentMethodExtra2?.value || "").trim()
    ].filter(Boolean);

    const parsed = parseFinalizePaymentSplits(form, total);
    const splits = parsed.value || [];
    const hasFiado = selectedMethods.includes("fiado");
    const hasPix = selectedMethods.includes("pix");
    const hasNonFiado = selectedMethods.some((method) => method !== "fiado");

    if (fiadoBox) fiadoBox.style.display = hasFiado ? "grid" : "none";
    if (pixBox) pixBox.style.display = hasPix ? "grid" : "none";
    if (manualCheck) {
      manualCheck.disabled = !hasNonFiado;
      if (!hasNonFiado) manualCheck.checked = false;
    }
    if (manualCheckNote) {
      manualCheckNote.style.display = hasNonFiado ? "none" : "block";
      manualCheckNote.textContent = hasNonFiado ? "" : "Quando a comanda e totalmente no fiado, essa confirmacao e dispensada.";
    }

    if (breakdownNote) {
      if (parsed.error) {
        breakdownNote.textContent = parsed.error;
      } else {
        const paid = splits.reduce((sum, row) => sum + parseNumber(row.amount || 0), 0);
        breakdownNote.textContent = `Pagamento informado: ${paymentSplitsText(splits, { includeAmount: true })} | Total conferido: ${money(paid)}.`;
      }
    }

    if (hasPix && comanda) {
      if (!comanda.pixCodeDraft) {
        comanda.pixCodeDraft = generatePixCode();
      }
      const codeEl = form.querySelector('[data-role="pix-code"]');
      const canvas = form.querySelector('[data-role="pix-canvas"]');
      if (codeEl) codeEl.textContent = comanda.pixCodeDraft;
      if (canvas) drawPseudoQr(canvas, comanda.pixCodeDraft);
    }
  }

  function finalizeComanda(form) {
    const actor = currentActor();
    const comandaId = form.dataset.comandaId;
    const comanda = findOpenComandaForActor(comandaId, actor, { silent: true });
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return;
    }

    const manualCheck = formCheckboxChecked(form, "manualCheck", false);
    const fiadoCustomer = form.fiadoCustomer.value.trim();
    const total = comandaTotal(comanda);
    const parsedSplits = parseFinalizePaymentSplits(form, total);
    if (parsedSplits.error) {
      alert(parsedSplits.error);
      return;
    }
    const paymentSplits = parsedSplits.value || [];
    const hasFiado = paymentSplits.some((row) => row.method === "fiado");
    const hasPix = paymentSplits.some((row) => row.method === "pix");
    const requiresManualCheck = paymentSplits.some((row) => row.method !== "fiado");

    if (requiresManualCheck && !manualCheck) {
      alert("Confirme manualmente o pagamento antes de finalizar.");
      return;
    }

    if (hasFiado && !fiadoCustomer) {
      alert("No fiado, o nome do cliente e obrigatorio.");
      return;
    }

    if (!comanda.items.some((item) => itemCountsForTotal(item))) {
      if (!confirm("Comanda sem itens validos. Finalizar mesmo assim?")) return;
    }

    if (hasPix && !comanda.pixCodeDraft) {
      comanda.pixCodeDraft = generatePixCode();
    }

    const normalizedSplits = normalizePaymentSplits(paymentSplits);
    const paymentMethod = normalizedSplits.length === 1 ? normalizedSplits[0].method : "multiplo";
    const fiadoAmount = normalizedSplits
      .filter((entry) => entry.method === "fiado")
      .reduce((sum, entry) => sum + parseNumber(entry.amount || 0), 0);

    comanda.status = "finalizada";
    comanda.closedAt = isoNow();
    comanda.payment = {
      method: paymentMethod,
      methodLabel: paymentSplitsText(normalizedSplits, { includeAmount: true }),
      methods: normalizedSplits,
      verifiedAt: isoNow(),
      customerName: hasFiado ? fiadoCustomer : comanda.customer || "",
      pixCode: hasPix ? comanda.pixCodeDraft : ""
    };

    if (fiadoAmount > 0) {
      state.payables.push({
        id: `PG-${String(state.seq.payable++).padStart(5, "0")}`,
        comandaId: comanda.id,
        customerName: fiadoCustomer,
        total: fiadoAmount,
        status: "pendente",
        createdAt: isoNow(),
        paidAt: null,
        paidMethod: null
      });
    }

    appendComandaEvent(comanda, {
      actor,
      type: "comanda_finalizada",
      detail: `Comanda finalizada com ${paymentSplitsText(normalizedSplits, { includeAmount: true })} no valor ${money(total)}.`
    });

    state.openComandas = state.openComandas.filter((c) => c.id !== comanda.id);
    state.closedComandas.unshift(comanda);
    clearWaiterDraftItems(comanda.id);

    if (uiState.waiterActiveComandaId === comanda.id) {
      uiState.waiterActiveComandaId = null;
    }
    delete uiState.finalizeOpenByComanda[comanda.id];

    saveState();
    render();
  }

  function toggleFinalizeView(select) {
    const form = select.closest('form[data-role="finalize-form"]');
    if (!form) return;
    updateFinalizePaymentUi(form);
  }

  function extractBodyFromHtml(html) {
    const raw = String(html || "");
    const match = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : raw;
  }

  function buildSimplePreviewPage(html, options = {}) {
    const title = String(options.previewTitle || "Visualizacao de cupom");
    const subtitle = String(options.previewSubtitle || "Impressao fisica desativada temporariamente.");
    const bodyContent = extractBodyFromHtml(html);
    return `
      <html>
        <head>
          <title>${esc(title)}</title>
          <style>
            :root { color-scheme: light; }
            body { margin: 0; font-family: Arial, sans-serif; background: #f3f5f8; color: #102033; }
            .preview-shell { max-width: 980px; margin: 0 auto; padding: 16px; }
            .preview-header { margin-bottom: 12px; border: 1px solid #c7d4e7; border-radius: 10px; background: #ffffff; padding: 12px; }
            .preview-header h1 { margin: 0; font-size: 18px; }
            .preview-header p { margin: 6px 0 0; color: #4a5f7d; font-size: 13px; }
            .preview-content { border: 1px solid #c7d4e7; border-radius: 10px; background: #ffffff; padding: 12px; overflow: auto; }
            .preview-content table { width: 100%; border-collapse: collapse; margin-top: 6px; }
            .preview-content th, .preview-content td { border: 1px solid #d6deeb; padding: 6px 7px; font-size: 12px; vertical-align: top; }
            .preview-content th { background: #f4f7fb; }
            .preview-content p { font-size: 12px; line-height: 1.35; }
            .preview-content h1, .preview-content h2, .preview-content h3, .preview-content h4 { margin: 8px 0 6px; }
            .preview-footer { margin-top: 10px; color: #4a5f7d; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="preview-shell">
            <div class="preview-header">
              <h1>${esc(title)}</h1>
              <p>${esc(subtitle)}</p>
            </div>
            <div class="preview-content">${bodyContent}</div>
            <div class="preview-footer">Documento aberto somente para visualizacao no navegador/PWA.</div>
          </div>
        </body>
      </html>
    `;
  }

  function openReceiptPopup(
    html,
    blockedMessage = "Permita pop-up para abrir a visualizacao do cupom.",
    popupFeatures = "width=420,height=760",
    options = {}
  ) {
    const popup = window.open("", "_blank", popupFeatures);
    if (!popup) {
      alert(blockedMessage);
      return null;
    }
    const htmlToRender = buildSimplePreviewPage(html, options);

    popup.document.open();
    popup.document.write(htmlToRender);
    popup.document.close();
    setTimeout(() => {
      try {
        popup.focus();
      } catch (_err) { }
    }, 220);
    return popup;
  }

  function qzLibraryAvailable() {
    return Boolean(window.qz && window.qz.websocket && window.qz.configs && window.qz.printers && window.qz.print);
  }

  function ensureQzSecurityConfig() {
    if (!qzLibraryAvailable() || uiState.qzSecurityConfigured) return;
    try {
      // Modo simples para ambiente local. Em producao o ideal e assinatura valida.
      window.qz.security.setCertificatePromise((resolve) => resolve());
      window.qz.security.setSignaturePromise(() => (resolve) => resolve());
      uiState.qzSecurityConfigured = true;
    } catch (_err) { }
  }

  async function ensureQzConnected() {
    if (!qzLibraryAvailable()) {
      throw new Error("QZ Tray nao detectado no navegador.");
    }
    ensureQzSecurityConfig();
    if (window.qz.websocket.isActive()) return;
    await window.qz.websocket.connect({ retries: 2, delay: 1 });
  }

  async function resolveKitchenPrinterName() {
    const preferred = String(uiState.printerPrefs?.kitchenPrinterName || "").trim();
    if (preferred) return preferred;
    return (await window.qz.printers.getDefault()) || "";
  }

  async function printKitchenTicketViaQz(html, comandaId = "") {
    await ensureQzConnected();
    const printerName = await resolveKitchenPrinterName();
    if (!printerName) {
      throw new Error("Nenhuma impressora de cozinha configurada/padrao.");
    }
    const config = window.qz.configs.create(printerName, {
      copies: 1,
      jobName: `cozinha-${String(comandaId || "pedido")}`
    });
    const data = [{ type: "pixel", format: "html", flavor: "plain", data: html }];
    await window.qz.print(config, data);
  }

  function setKitchenDirectPrintEnabled(enabled) {
    uiState.printerPrefs = normalizePrinterPrefs({
      ...uiState.printerPrefs,
      kitchenDirectEnabled: Boolean(enabled)
    });
    persistPrinterPrefs();
    render();
  }

  function saveKitchenPrinterConfigFromUi() {
    const actor = currentActor();
    if (!isAdminOrDev(actor)) {
      alert("Somente administrador pode configurar a impressora da cozinha.");
      return;
    }
    const input = document.querySelector('[data-role="kitchen-printer-name"]');
    const kitchenPrinterName = String(input?.value || "").trim();
    uiState.printerPrefs = normalizePrinterPrefs({
      ...uiState.printerPrefs,
      kitchenPrinterName
    });
    persistPrinterPrefs();
    alert(
      kitchenPrinterName
        ? `Impressora da cozinha salva: ${kitchenPrinterName}`
        : "Impressora da cozinha limpa. Sera usada a impressora padrao do computador."
    );
    render();
  }

  function printKitchenTicket(comanda, items, actor, options = {}) {
    if (!comanda || !Array.isArray(items) || !items.length) return;
    if (!actor || (actor.role !== "waiter" && !isAdminOrDev(actor))) return;

    const kitchenItems = items.filter((item) => item && itemNeedsKitchen(item) && !item.canceled);
    if (!kitchenItems.length) return;

    const reason = String(options.reason || "Novo pedido");
    const generatedAt = isoNow();
    const printableItems = kitchenItems
      .map((item) => {
        const note = item.waiterNote ? `<p class="line note">Obs do pedido: ${esc(item.waiterNote)}</p>` : "";
        const delivery = item.deliveryRequested
          ? `<p class="line note">Entrega: ${esc(item.deliveryRecipient || "-")} | ${esc(item.deliveryLocation || "-")}</p>`
          : "";
        return `
          <div class="item">
            <p class="line"><b>${esc(item.name)}</b></p>
            <p class="line">Qtd: <b>${parseNumber(item.qty || 0)}</b> | Prioridade: ${esc(kitchenPriorityLabel(item.kitchenPriority || "normal"))}</p>
            ${note}
            ${delivery}
          </div>
        `;
      })
      .join("");

    const html = `
      <html>
        <head>
          <title>Cozinha ${esc(comanda.id)}</title>
          <style>
            body { font-family: monospace; margin: 0; padding: 10px; }
            .ticket { width: 80mm; margin: 0 auto; color: #000; }
            h2 { margin: 0 0 6px; font-size: 18px; text-align: center; }
            p { margin: 2px 0; font-size: 12px; line-height: 1.25; }
            hr { border: none; border-top: 1px dashed #000; margin: 7px 0; }
            .meta { font-size: 11px; }
            .item { margin: 0 0 6px; }
            .line.note { font-size: 11px; }
            .strong { font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h2>${esc(ESTABLISHMENT_NAME)} | COZINHA</h2>
            <p class="strong">Pedido: ${esc(reason)}</p>
            <p class="meta">Comanda: ${esc(comanda.id)} | Mesa/ref: ${esc(comanda.table || "-")}</p>
            <p class="meta">Cliente: ${esc(comanda.customer || "-")}</p>
            <p class="meta">Solicitante: ${esc(actor.name || "-")} (${esc(roleLabel(actor.role || ""))})</p>
            <p class="meta">Gerado em: ${esc(formatDateTime(generatedAt))}</p>
            <hr>
            ${printableItems}
            <hr>
            <p class="meta">${PRINT_PIPELINE_ENABLED ? "Cupom de cozinha - impressao automatica" : "Cupom de cozinha - visualizacao simples no navegador/PWA"}</p>
          </div>
        </body>
      </html>
    `;

    openReceiptPopup(html, "Permita pop-up para abrir a visualizacao do cupom da cozinha.", "width=420,height=760", {
      previewTitle: `Cupom da cozinha ${comanda.id}`,
      previewSubtitle: "Modo visualizacao simples (impressao desativada)"
    });
  }

  function printComanda(comandaId) {
    const comanda = findAnyComandaForActor(comandaId, currentActor());
    if (!comanda) return;

    const lines = (comanda.items || [])
      .map((i) => `${i.name} x${i.qty}  ${money(parseNumber(i.priceAtSale || 0))}${i.canceled ? " (cancelado)" : ""}`)
      .join("<br>");

    const html = `
      <html>
        <head>
          <title>Cupom ${esc(comanda.id)}</title>
          <style>
            body { font-family: monospace; margin: 0; padding: 12px; }
            .receipt { width: 80mm; margin: 0 auto; }
            h3 { margin: 0 0 8px; }
            p { margin: 4px 0; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <p class="center"><b>${esc(ESTABLISHMENT_NAME)}</b></p>
            <h3>Comanda ${esc(comanda.id)}</h3>
            <p>Mesa: ${esc(comanda.table)}</p>
            <p>Cliente: ${esc(comanda.customer || "-")}</p>
            <p>Aberta: ${esc(formatDateTime(comanda.createdAt))}</p>
            <hr>
            <p>${lines || "Sem itens"}</p>
            <hr>
            <p>Total: <b>${money(comandaTotal(comanda))}</b></p>
            <p>Pagamento: ${esc(comandaPaymentText(comanda, { includeAmount: true, totalFallback: comandaTotal(comanda) }))}</p>
            <p>Observacoes: ${(comanda.notes || []).map((n) => esc(n)).join(" | ") || "-"}</p>
            <hr>
            <p>${PRINT_PIPELINE_ENABLED ? "Pronto para impressora de cupom." : "Visualizacao simples no navegador/PWA."}</p>
          </div>
        </body>
      </html>
    `;

    openReceiptPopup(html, "Permita pop-up para abrir a visualizacao do cupom.", "width=420,height=760", {
      previewTitle: `Cupom da comanda ${comanda.id}`,
      previewSubtitle: "Modo visualizacao simples (impressao desativada)"
    });
  }

  function closeCash(form) {
    const actor = currentActor();
    const loginValue = form.login.value.trim();
    const password = form.password.value;
    const secondAuth = validateAdminCredentials(loginValue, password);

    if (!secondAuth) {
      alert("Segunda autenticacao invalida.");
      return;
    }

    const pendingOpen = [...state.openComandas].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    if (pendingOpen.length) {
      const preview = pendingOpen
        .slice(0, 8)
        .map((comanda) => `${comanda.id} (${comanda.table || "-"})`)
        .join(" | ");
      alert(
        `Nao e possivel fechar o caixa com comandas abertas.\n\n` +
        `Comandas pendentes: ${pendingOpen.length}\n` +
        `${preview ? `Ex.: ${preview}${pendingOpen.length > 8 ? " ..." : ""}\n\n` : ""}` +
        "Finalize todas as comandas e tente novamente."
      );
      return;
    }

    const openedAt = state.cash.openedAt;
    const closedAt = isoNow();
    const confirmText =
      `Confirmar fechamento do caixa ${state.cash.id}?\n` +
      `Aberto em: ${formatDateTimeWithDay(openedAt)}\n` +
      `Fechamento em: ${formatDateTimeWithDay(closedAt)}\n\n` +
      "Comandas do dia serao movidas para historico e dados operacionais limpos.";
    if (!confirm(confirmText)) {
      return;
    }
    const closureDraft = buildCashClosureDraft(closedAt);
    const allDayComandas = closureDraft.commandas;
    const closure = {
      id: `HIST-${Date.now()}`,
      cashId: state.cash.id,
      openedAt,
      closedAt,
      commandas: allDayComandas,
      auditLog: [
        {
          id: `EV-${state.seq.event++}`,
          ts: closedAt,
          actorId: actor.id,
          actorRole: actor.role,
          actorName: actor.name,
          type: "caixa_fechado",
          detail: `Caixa ${state.cash.id} fechado com segunda autenticacao. Aberto em ${formatDateTimeWithDay(openedAt)} e fechado em ${formatDateTimeWithDay(closedAt)}.`,
          comandaId: null,
          itemId: null,
          reason: ""
        },
        ...state.auditLog
      ],
      summary: closureDraft.summary
    };
    const reportOptions = {
      printedBy: actor,
      title: `Fechamento do caixa ${closure.cashId} | Dia ${formatDateOnlySafe(String(closure.openedAt || closedAt).slice(0, 10))}`,
      subtitle: "Historico do dia apos fechamento"
    };
    const closureHtml = buildCashHistoryPrintHtml(closure, reportOptions);
    const archivedHtmlReport = createCashHtmlReportRecord(closure, actor, closureHtml, reportOptions);

    state.history90.unshift(closure);
    pruneHistory(state);
    state.cashHtmlReports = [archivedHtmlReport, ...(state.cashHtmlReports || [])];
    pruneCashHtmlReports(state);

    state.openComandas = [];
    state.closedComandas = [];
    state.cookHistory = [];
    state.auditLog = [];
    state.cash = {
      id: `CX-${state.seq.cash++}`,
      openedAt: isoNow(),
      date: todayISO()
    };

    appendAudit({ actor, type: "caixa_novo", detail: `Novo caixa ${state.cash.id} iniciado.` });

    saveState();
    openCashHtmlReportRecord(archivedHtmlReport, {
      previewTitle: reportOptions.title,
      previewSubtitle: `${reportOptions.subtitle} | Arquivo ${archivedHtmlReport.id}`
    });
    alert(`Caixa fechado com sucesso.\nAbertura: ${formatDateTimeWithDay(openedAt)}\nFechamento: ${formatDateTimeWithDay(closedAt)}\nHistorico mantido por 90 dias.`);
    render();
  }

  function validateAdminCredentials(loginValue, password) {
    const user = findUserByLoginPassword(loginValue, password);
    if (!user || !user.active || !isAdminOrDev(user)) return null;
    return user;
  }

  function saveFinanceInventory(form) {
    const actor = currentActor();
    const loginValue = form.adminLogin.value.trim();
    const password = form.adminPassword.value;
    if (!validateAdminCredentials(loginValue, password)) {
      alert("Validacao do administrador invalida. Alteracoes nao salvas.");
      return;
    }

    const errors = [];
    for (const p of state.products) {
      const newPrice = parseNumber(form[`price-${p.id}`]?.value);
      const newStock = Number(form[`stock-${p.id}`]?.value);
      const newCost = parseNumber(form[`cost-${p.id}`]?.value);

      if (!(newPrice > 0)) errors.push(`${p.name}: preco deve ser maior que zero.`);
      if (!Number.isInteger(newStock) || newStock < 0) errors.push(`${p.name}: estoque deve ser inteiro >= 0.`);
      if (newCost < 0) errors.push(`${p.name}: custo deve ser >= 0.`);
    }

    if (errors.length) {
      alert(`Corrija os campos antes de salvar:\n- ${errors.slice(0, 10).join("\n- ")}`);
      return;
    }

    for (const p of state.products) {
      p.price = parseNumber(form[`price-${p.id}`]?.value);
      p.stock = Number(form[`stock-${p.id}`]?.value);
      p.cost = parseNumber(form[`cost-${p.id}`]?.value);
    }

    appendAudit({ actor, type: "finance_inventory_update", detail: "Preco, estoque e custo atualizados na area de financas." });
    saveState();
    render();
  }

  function reportUiRuntimeError(context, err) {
    console.error(`[ui:${context}]`, err);
    alert("Ocorreu um erro ao processar a acao. A tela foi recarregada.");
  }

  app.addEventListener("click", async (event) => {
    try {
      const button = event.target.closest("[data-action]");
      if (!button) return;

      const action = button.dataset.action;

      if (action === "logout") {
        logout();
        return;
      }

      if (action === "install-pwa") {
        if (uiState.deferredPrompt) {
          uiState.deferredPrompt.prompt();
          await uiState.deferredPrompt.userChoice;
          uiState.deferredPrompt = null;
          render();
        }
        return;
      }

      if (action === "set-tab") {
        const role = button.dataset.role;
        const tab = button.dataset.tab;
        if (role === "admin") uiState.adminTab = tab;
        if (role === "dev") uiState.devTab = tab;
        if (role === "waiter") uiState.waiterTab = tab;
        if (role === "cook") uiState.cookTab = tab;
        render();
        return;
      }

      if (action === "close-waiter-ready-modal") {
        uiState.waiterReadyModalItems = [];
        render();
        return;
      }

      if (action === "waiter-ready-go-open") {
        uiState.waiterTab = "abertas";
        uiState.waiterReadyModalItems = [];
        render();
        return;
      }

      if (action === "dismiss-kitchen-receipt-notice") {
        uiState.waiterKitchenReceiptNotices = (uiState.waiterKitchenReceiptNotices || []).slice(1);
        render();
        return;
      }

      if (action === "clear-kitchen-receipt-notices") {
        uiState.waiterKitchenReceiptNotices = [];
        render();
        return;
      }

      if (action === "open-comanda-on-create") {
        const comandaId = button.dataset.comandaId;
        if (comandaId) {
          uiState.waiterActiveComandaId = comandaId;
          uiState.waiterTab = "abrir";
        }
        render();
        return;
      }

      if (action === "minimize-open-comanda") {
        minimizeOpenComanda(button.dataset.comandaId);
        return;
      }

      if (action === "open-item-selector") {
        openComandaItemSelector(button.dataset.comandaId, button.dataset.mode || "increment");
        return;
      }

      if (action === "close-item-selector") {
        closeComandaItemSelector();
        return;
      }

      if (action === "edit-product") {
        editProduct(Number(button.dataset.id));
        return;
      }

      if (action === "toggle-product-availability") {
        toggleProductAvailability(Number(button.dataset.id));
        return;
      }

      if (action === "delete-product") {
        deleteProduct(Number(button.dataset.id));
        return;
      }

      if (action === "edit-employee") {
        editEmployee(Number(button.dataset.id));
        return;
      }

      if (action === "delete-employee") {
        deleteEmployee(Number(button.dataset.id));
        return;
      }

      if (action === "print-cash-day-history") {
        printCurrentCashHistoryReport();
        return;
      }

      if (action === "print-cash-day-history-extended") {
        printCurrentCashHistoryReportExtended();
        return;
      }

      if (action === "print-cash-closure") {
        printStoredCashClosure(button.dataset.id);
        return;
      }

      if (action === "open-cash-html-report") {
        openStoredCashHtmlReport(button.dataset.id);
        return;
      }

      if (action === "receive-payable") {
        receivePayable(button.dataset.id);
        return;
      }

      if (action === "save-kitchen-printer-config") {
        saveKitchenPrinterConfigFromUi();
        return;
      }

      if (action === "deliver-item") {
        deliverItem(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "cook-status") {
        setKitchenItemStatus(button.dataset.comandaId, button.dataset.itemId, button.dataset.status);
        return;
      }

      if (action === "toggle-kitchen-row-collapse") {
        toggleAdminKitchenRowCollapse(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "kitchen-priority") {
        setKitchenItemPriority(button.dataset.comandaId, button.dataset.itemId, button.dataset.priority);
        return;
      }

      if (action === "increment-item") {
        incrementItem(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "cancel-item") {
        cancelItem(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "queue-draft-item") {
        const form = button.closest('form[data-role="add-item-form"]');
        if (!form) return;
        queueComandaDraftItem(form);
        return;
      }

      if (action === "remove-draft-item") {
        removeComandaDraftItem(button.dataset.comandaId, Number(button.dataset.index));
        return;
      }

      if (action === "add-comanda-note") {
        addComandaNote(button.dataset.comandaId);
        return;
      }

      if (action === "toggle-comanda-collapse") {
        toggleWaiterComandaCollapse(button.dataset.comandaId);
        return;
      }

      if (action === "resolve-kitchen-indicator") {
        resolveComandaKitchenIndicator(button.dataset.comandaId, button.dataset.mode || "entendi");
        return;
      }

      if (action === "toggle-finalize") {
        toggleFinalize(button.dataset.comandaId);
        return;
      }

      if (action === "print-comanda") {
        printComanda(button.dataset.comandaId);
        return;
      }

      if (action === "admin-edit-comanda") {
        adminEditComanda(button.dataset.comandaId);
        return;
      }

      if (action === "admin-add-comanda-item") {
        adminAddComandaItem(button.dataset.comandaId);
        return;
      }

      if (action === "admin-edit-comanda-item") {
        adminEditComandaItem(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "admin-remove-comanda-item") {
        adminRemoveComandaItem(button.dataset.comandaId, button.dataset.itemId);
        return;
      }

      if (action === "open-comanda-edit-flow") {
        if (openComandaEditFlow(button.dataset.comandaId)) {
          render();
        }
        return;
      }

      if (action === "open-comanda-details") {
        uiState.adminInlineEditComandaId = null;
        uiState.comandaDetailsId = button.dataset.comandaId;
        render();
        return;
      }

      if (action === "close-comanda-inline-edit") {
        uiState.adminInlineEditComandaId = null;
        render();
        return;
      }

      if (action === "close-comanda-details") {
        uiState.adminInlineEditComandaId = null;
        uiState.comandaDetailsId = null;
        render();
        return;
      }
    } catch (err) {
      reportUiRuntimeError("click", err);
      render();
    }
  });

  app.addEventListener("submit", (event) => {
    try {
      event.preventDefault();

      const form = event.target;

      if (form.id === "login-form") {
        const rememberLogin = event.submitter?.dataset?.rememberLogin === "true";
        login(form.login.value.trim(), form.password.value, rememberLogin);
        return;
      }

      if (form.id === "add-product-form") {
        createProduct(form);
        return;
      }

      if (form.id === "add-employee-form") {
        createEmployee(form);
        return;
      }

      if (form.id === "admin-self-credentials-form") {
        updateOwnAdminCredentials(form);
        return;
      }

      if (form.id === "finance-inventory-form") {
        saveFinanceInventory(form);
        return;
      }

      if (form.id === "create-comanda-form") {
        createComanda(form);
        return;
      }

      if (form.id === "quick-sale-form") {
        createQuickSale(form);
        return;
      }

      if (form.matches('form[data-role="item-selector-form"]')) {
        submitComandaItemSelector(form);
        return;
      }

      if (form.matches('form[data-role="add-item-form"]')) {
        addItemToComanda(form);
        return;
      }

      if (form.matches('form[data-role="finalize-form"]')) {
        finalizeComanda(form);
        return;
      }

      if (form.id === "close-cash-form") {
        closeCash(form);
      }
    } catch (err) {
      reportUiRuntimeError("submit", err);
      render();
    }
  });

  app.addEventListener("change", (event) => {
    try {
      const target = event.target;

      if (target.matches('[data-role="item-category"]')) {
        const form = target.closest('form[data-role="add-item-form"]');
        if (!form) return;
        const productSel = form.querySelector('[data-role="item-product"]');
        fillProductSelect(productSel, target.value);
        updateKitchenEstimate(form);
        updateDeliveryFields(form);
        return;
      }

      if (target.matches('[data-role="item-product"]') || target.name === "qty") {
        const form = target.closest('form[data-role="add-item-form"]');
        if (form) {
          updateKitchenEstimate(form);
          if (target.matches('[data-role="item-product"]')) {
            updateDeliveryFields(form);
          }
        }
        return;
      }

      if (target.matches('[data-role="delivery-check"]')) {
        const form = target.closest('form[data-role="add-item-form"]');
        if (form) updateDeliveryFields(form);
        return;
      }

      if (target.matches('[data-role="quick-category"]')) {
        const form = target.closest('form[data-role="quick-sale-form"]');
        if (form) {
          fillQuickSaleProductSelect(form);
          updateQuickSaleFlow(form);
        }
        return;
      }

      if (target.matches('[data-role="quick-product"]')) {
        const form = target.closest('form[data-role="quick-sale-form"]');
        if (form) updateQuickSaleFlow(form);
        return;
      }

      if (target.matches('[data-role="quick-delivery-check"]')) {
        const form = target.closest('form[data-role="quick-sale-form"]');
        if (form) updateQuickSaleFlow(form);
        return;
      }

      if (target.name === "paidConfirm" && target.closest('form[data-role="quick-sale-form"]')) {
        uiState.quickSalePaidConfirm = Boolean(target.checked);
        return;
      }

      if (target.matches('[data-role="payment-method"]')) {
        toggleFinalizeView(target);
        return;
      }

      if (target.name === "category" && target.closest("#add-product-form")) {
        updateAdminProductSubmenu(target.closest("#add-product-form"));
        return;
      }

      if (target.matches('[data-role="monitor-filter"]')) {
        uiState.monitorWaiterId = target.value || "all";
        render();
        return;
      }

      if (target.matches('[data-role="kitchen-direct-enabled"]')) {
        setKitchenDirectPrintEnabled(Boolean(target.checked));
        return;
      }

      if (target.matches('[data-role="waiter-search"]')) {
        uiState.waiterComandaSearch = target.value || "";
        render();
        return;
      }

      if (target.matches('[data-role="waiter-catalog-search"]')) {
        uiState.waiterCatalogSearch = target.value || "";
        render();
        return;
      }

      if (target.matches('[data-role="waiter-catalog-category"]')) {
        uiState.waiterCatalogCategory = target.value || "all";
        render();
        return;
      }

      if (target.matches('[data-role="admin-search"]')) {
        uiState.adminComandaSearch = target.value || "";
        render();
        return;
      }

      if (target.matches('[data-role="admin-history-comanda-search"]')) {
        uiState.adminHistoryComandaSearch = target.value || "";
        render();
        return;
      }

      if (target.matches('[data-role="admin-kitchen-search"]')) {
        uiState.adminKitchenSearch = target.value || "";
        render();
        return;
      }

      if (target.matches('[data-role="cook-search"]')) {
        uiState.cookSearch = target.value || "";
        render();
        return;
      }
    } catch (err) {
      reportUiRuntimeError("change", err);
      render();
    }
  });

  app.addEventListener("input", (event) => {
    try {
      const target = event.target;
      if (target.matches('[data-role="payment-amount"]')) {
        const form = target.closest('form[data-role="finalize-form"]');
        if (form) updateFinalizePaymentUi(form);
        return;
      }
      if (target.matches('[data-role="waiter-catalog-search"]')) {
        uiState.waiterCatalogSearch = target.value || "";
        render();
        return;
      }
      if (target.matches('[data-role="admin-kitchen-search"]')) {
        uiState.adminKitchenSearch = target.value || "";
        render();
        return;
      }
      if (target.matches('[data-role="admin-history-comanda-search"]')) {
        uiState.adminHistoryComandaSearch = target.value || "";
        render();
        return;
      }
      if (target.matches('[data-role="cook-search"]')) {
        uiState.cookSearch = target.value || "";
        render();
      }
    } catch (err) {
      reportUiRuntimeError("input", err);
      render();
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === PRINTER_PREFS_KEY) {
      uiState.printerPrefs = loadPrinterPrefs();
      render();
      return;
    }
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
        return;
      }
      const localUpdated = parseUpdatedAtTimestamp(state.meta?.updatedAt);
      const incomingUpdated = parseUpdatedAtTimestamp(incoming?.meta?.updatedAt);
      if (localUpdated > 0 && incomingUpdated <= 0) {
        return;
      }
      if (incomingUpdated && localUpdated && incomingUpdated < localUpdated) {
        return;
      }
      adoptIncomingState(incoming);
      render();
    } catch (_err) { }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    uiState.deferredPrompt = event;
    render();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => { });
    });
  }

  setInterval(() => {
    const user = getCurrentUser();
    if (user?.role === "waiter" && uiState.waiterTab === "cozinha") {
      render();
    }
    if (user?.role === "cook" && uiState.cookTab === "ativos") {
      render();
    }
    if (
      user?.role === "admin" &&
      (uiState.adminTab === "monitor" ||
        uiState.adminTab === "dashboard" ||
        uiState.adminTab === "arquivos_html" ||
        (uiState.adminTab === "comandas" && uiState.waiterTab === "cozinha"))
    ) {
      render();
    }
    if (user?.role === "dev" && (uiState.devTab === "monitor" || uiState.devTab === "devices" || uiState.devTab === "dashboard")) {
      render();
    }
  }, 5000);

  setInterval(() => {
    broadcastPresencePing();
  }, DEVICE_PRESENCE_PING_MS);

  setInterval(() => {
    void pullStateFromSupabase();
  }, 12000);

  broadcastPresencePing();
  void connectSupabase();
  render();
})();
