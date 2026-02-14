
"use strict";

(() => {
  const STORAGE_KEY = "restobar_control_v1";
  const SESSION_KEY = "restobar_local_session_user";
  const ESTABLISHMENT_NAME = "Brancao";
  const CATEGORIES = ["Bar", "Cozinha", "Espetinhos", "Avulso", "Ofertas"];
  const BAR_SUBCATEGORIES = ["Doses/Copo", "Geral"];
  const KITCHEN_STATUSES = [
    { value: "fila", label: "Fila de espera" },
    { value: "cozinhando", label: "Cozinhando" },
    { value: "em_falta", label: "Em falta" },
    { value: "entregue", label: "Entregue" }
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

  const app = document.getElementById("app");
  const uiState = {
    adminTab: "monitor",
    waiterTab: "abrir",
    cookTab: "ativos",
    finalizeOpenByComanda: {},
    waiterCollapsedByComanda: {},
    waiterActiveComandaId: null,
    deferredPrompt: null,
    monitorWaiterId: "all",
    comandaDetailsId: null,
    comandaDetailsSource: "closed",
    waiterComandaSearch: "",
    waiterCatalogSearch: "",
    waiterCatalogCategory: "all",
    adminComandaSearch: "",
    cookSearch: "",
    supabaseStatus: "desconectado",
    supabaseLastError: "",
    remoteMonitorEvents: []
  };

  function isoNow() {
    return new Date().toISOString();
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  }

  function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseNumber(input) {
    if (typeof input === "number") return input;
    const raw = String(input || "").trim().replace(/[^0-9,.-]/g, "");
    const hasComma = raw.includes(",");
    const normalized = hasComma ? raw.replaceAll(".", "").replaceAll(",", ".") : raw;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomPrice(min, max) {
    const raw = Math.random() * (max - min) + min;
    return Number(raw.toFixed(2));
  }

  function createSeedProducts() {
    const seed = [
      { name: "Agua Mineral", category: "Bar", subcategory: "Geral", price: randomPrice(3, 7), stock: randomInt(30, 120), prepTime: 0, cost: randomPrice(1.4, 3), available: true, requiresKitchen: false },
      { name: "Cachaca Dose", category: "Bar", subcategory: "Doses/Copo", price: randomPrice(6, 12), stock: randomInt(30, 100), prepTime: 0, cost: randomPrice(2.2, 5.2), available: true, requiresKitchen: false },
      { name: "Cerveja Long Neck", category: "Bar", subcategory: "Geral", price: randomPrice(9, 15), stock: randomInt(20, 80), prepTime: 0, cost: randomPrice(5, 8), available: true, requiresKitchen: false },
      { name: "Refrigerante Lata", category: "Bar", subcategory: "Geral", price: randomPrice(5, 8), stock: randomInt(40, 120), prepTime: 0, cost: randomPrice(2.8, 4.5), available: true, requiresKitchen: false },
      { name: "Gelo (Balde)", category: "Bar", subcategory: "Geral", price: randomPrice(4, 9), stock: randomInt(30, 120), prepTime: 0, cost: randomPrice(1.3, 3.2), available: true, requiresKitchen: false },
      { name: "Pastel da Casa", category: "Cozinha", price: randomPrice(16, 26), stock: randomInt(20, 70), prepTime: randomInt(10, 16), cost: randomPrice(6, 11), available: true, requiresKitchen: true },
      { name: "Baiao", category: "Cozinha", price: randomPrice(24, 38), stock: randomInt(10, 35), prepTime: randomInt(18, 26), cost: randomPrice(11, 19), available: true, requiresKitchen: true },
      { name: "Hamburguer Artesanal", category: "Cozinha", price: randomPrice(22, 36), stock: randomInt(12, 40), prepTime: randomInt(14, 24), cost: randomPrice(9, 16), available: true, requiresKitchen: true },
      { name: "Espetinho de Frango", category: "Espetinhos", price: randomPrice(9, 14), stock: randomInt(30, 120), prepTime: randomInt(7, 12), cost: randomPrice(4.2, 6.7), available: true, requiresKitchen: false },
      { name: "Espetinho de Carne", category: "Espetinhos", price: randomPrice(11, 17), stock: randomInt(30, 100), prepTime: randomInt(7, 12), cost: randomPrice(5.8, 8.8), available: true, requiresKitchen: false },
      { name: "Queijo Coalho no Espeto", category: "Espetinhos", price: randomPrice(8, 12), stock: randomInt(35, 110), prepTime: randomInt(4, 8), cost: randomPrice(3, 5), available: true, requiresKitchen: false },
      { name: "Cigarro", category: "Avulso", price: randomPrice(10, 20), stock: randomInt(20, 80), prepTime: 0, cost: randomPrice(7, 14), available: true, requiresKitchen: false },
      { name: "Trident", category: "Avulso", price: randomPrice(3, 6), stock: randomInt(60, 180), prepTime: 0, cost: randomPrice(1.2, 2.8), available: true, requiresKitchen: false },
      { name: "Bombom", category: "Avulso", price: randomPrice(2.5, 6), stock: randomInt(50, 160), prepTime: 0, cost: randomPrice(0.8, 2.5), available: true, requiresKitchen: false },
      { name: "Salgadinho", category: "Avulso", price: randomPrice(4, 9), stock: randomInt(50, 160), prepTime: 0, cost: randomPrice(1.6, 4.2), available: true, requiresKitchen: false },
      { name: "Combo Executivo", category: "Ofertas", price: randomPrice(34, 54), stock: randomInt(8, 30), prepTime: randomInt(16, 26), cost: randomPrice(15, 24), available: true, requiresKitchen: true },
      { name: "Oferta Balde + Gelo", category: "Ofertas", price: randomPrice(24, 38), stock: randomInt(10, 36), prepTime: 0, cost: randomPrice(12, 20), available: true, requiresKitchen: false }
    ];

    return seed.map((p, idx) => ({ id: idx + 1, ...p }));
  }

  function initialState() {
    const seedProducts = createSeedProducts();
    return {
      users: [
        { id: 1, role: "admin", name: "Administrador", functionName: "Administrador", login: "admin", password: "admin", active: true },
        { id: 2, role: "waiter", name: "Garcom Teste", functionName: "Garcom", login: "user", password: "user", active: true },
        { id: 3, role: "cook", name: "Cozinheiro Teste", functionName: "Cozinheiro", login: "cook", password: "cook", active: true }
      ],
      products: seedProducts,
      openComandas: [],
      closedComandas: [],
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
        user: 4,
        product: seedProducts.length + 1,
        comanda: 1,
        item: 1,
        sale: 1,
        payable: 1,
        cash: 2,
        event: 1
      },
      meta: {
        updatedAt: isoNow(),
        lastCloudSyncAt: null
      },
      session: {
        userId: null
      }
    };
  }

  function pruneHistory(state) {
    const threshold = Date.now() - 90 * 24 * 60 * 60 * 1000;
    state.history90 = (state.history90 || []).filter((entry) => {
      const at = new Date(entry.closedAt || entry.createdAt || 0).getTime();
      return Number.isFinite(at) && at >= threshold;
    });
  }

  function ensureSystemUsers(targetState) {
    if (!targetState.users.find((u) => u.role === "admin" && u.login === "admin")) {
      targetState.users.push({ id: targetState.seq.user++, role: "admin", name: "Administrador", functionName: "Administrador", login: "admin", password: "admin", active: true });
    }
    if (!targetState.users.find((u) => u.role === "waiter" && u.login === "user")) {
      targetState.users.push({ id: targetState.seq.user++, role: "waiter", name: "Garcom Teste", functionName: "Garcom", login: "user", password: "user", active: true });
    }
    if (!targetState.users.find((u) => u.role === "cook" && u.login === "cook")) {
      targetState.users.push({ id: targetState.seq.user++, role: "cook", name: "Cozinheiro Teste", functionName: "Cozinheiro", login: "cook", password: "cook", active: true });
    }
  }

  function normalizeCategoryName(category) {
    const raw = String(category || "").trim();
    if (!raw) return "Avulso";
    const flat = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
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
    const flat = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (flat === "doses" || flat === "dose" || flat === "doses/copo" || flat === "dose/copo" || flat === "copo") return "Doses/Copo";
    return BAR_SUBCATEGORIES.includes(raw) ? raw : "Geral";
  }

  function normalizeComandaItem(item, fallbackId = 0) {
    const category = normalizeCategoryName(item.category);
    const requiresKitchen = category === "Cozinha" ? true : category === "Ofertas" ? Boolean(item.requiresKitchen) : false;
    return {
      ...item,
      id: item.id || `IT-NORM-${fallbackId}`,
      category,
      requiresKitchen,
      needsKitchen: item.needsKitchen !== undefined ? Boolean(item.needsKitchen) : requiresKitchen,
      kitchenAlertUnread: Boolean(item.kitchenAlertUnread)
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
    const normalized = {
      ...product,
      id: Number(product.id || fallbackId),
      category: normalizedCategory
    };
    normalized.subcategory = normalizeProductSubcategory(normalized);
    normalized.available = product.available !== false;
    normalized.requiresKitchen =
      normalizedCategory === "Cozinha" ? true : normalizedCategory === "Ofertas" ? Boolean(product.requiresKitchen) : false;
    return normalized;
  }

  function normalizeStateShape(source) {
    const parsed = source && typeof source === "object" ? source : {};
    const fallback = initialState();
    const normalized = {
      ...fallback,
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : fallback.users,
      products: Array.isArray(parsed.products)
        ? parsed.products.map((p, idx) => normalizeProductRecord(p || {}, idx + 1))
        : fallback.products.map((p) => normalizeProductRecord(p || {}, p.id)),
      openComandas: Array.isArray(parsed.openComandas) ? parsed.openComandas.map((c, idx) => normalizeComandaRecord(c || {}, idx)) : [],
      closedComandas: Array.isArray(parsed.closedComandas) ? parsed.closedComandas.map((c, idx) => normalizeComandaRecord(c || {}, idx)) : [],
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
      meta: { ...fallback.meta, ...(parsed.meta || {}) },
      cash: { ...fallback.cash, ...(parsed.cash || {}) },
      session: { userId: parsed.session?.userId || null }
    };

    ensureSystemUsers(normalized);
    pruneHistory(normalized);
    return normalized;
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

  function loadSessionUserId(fallbackUserId = null) {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    if (fallbackUserId && Number.isInteger(fallbackUserId) && fallbackUserId > 0) {
      localStorage.setItem(SESSION_KEY, String(fallbackUserId));
      return fallbackUserId;
    }
    return null;
  }

  function persistSessionUserId(userId) {
    if (userId && Number.isInteger(userId) && userId > 0) {
      localStorage.setItem(SESSION_KEY, String(userId));
      return;
    }
    localStorage.removeItem(SESSION_KEY);
  }

  function sanitizeStateForCloud(source) {
    const cloned = JSON.parse(JSON.stringify(source));
    cloned.session = { userId: null };
    return cloned;
  }

  let state = loadState();
  let sessionUserId = loadSessionUserId(state.session?.userId || null);
  state.session = { userId: null };
  const supabaseCtx = {
    client: null,
    channel: null,
    connected: false,
    syncTimer: null,
    syncInFlight: false
  };

  function adoptIncomingState(source) {
    const currentSession = sessionUserId;
    state = normalizeStateShape(source);
    state.session = { userId: null };
    sessionUserId = currentSession;
    persistSessionUserId(sessionUserId);
  }

  function saveState(options = {}) {
    const touchMeta = options.touchMeta !== false;
    state.meta = state.meta || {};
    if (touchMeta) {
      state.meta.updatedAt = isoNow();
    }
    state.session = { userId: null };
    pruneHistory(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    if (supabaseCtx.syncTimer) {
      clearTimeout(supabaseCtx.syncTimer);
    }
    supabaseCtx.syncTimer = setTimeout(() => {
      void syncStateToSupabase();
    }, 400);
  }

  async function syncStateToSupabase() {
    const client = getSupabaseClient();
    if (!client || supabaseCtx.syncInFlight) return;

    supabaseCtx.syncInFlight = true;
    try {
      const payload = {
        id: "main",
        updated_at: isoNow(),
        payload: sanitizeStateForCloud(state)
      };
      const { error } = await client.from("restobar_state").upsert(payload);
      if (error) {
        throw error;
      }
      state.meta.lastCloudSyncAt = isoNow();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSupabaseStatus("conectado");
    } catch (err) {
      setSupabaseStatus("aviso", String(err?.message || err || "Falha ao sincronizar."));
    } finally {
      supabaseCtx.syncInFlight = false;
    }
  }

  async function pullStateFromSupabase() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data, error } = await client.from("restobar_state").select("payload,updated_at").eq("id", "main").maybeSingle();
      if (error || !data?.payload) return;

      const localUpdated = new Date(state.meta?.updatedAt || 0).getTime();
      const remoteUpdated = new Date(data.payload?.meta?.updatedAt || data.updated_at || 0).getTime();
      if (Number.isFinite(remoteUpdated) && remoteUpdated > localUpdated) {
        adoptIncomingState(data.payload);
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

  function publishSupabaseEvent(entry) {
    if (!supabaseCtx.channel) return;
    const payload = {
      ...entry,
      broadcastAt: isoNow()
    };
    supabaseCtx.channel.send({ type: "broadcast", event: "audit_event", payload }).catch(() => {});
    supabaseCtx.channel.send({
      type: "broadcast",
      event: "state_changed",
      payload: { updatedAt: state.meta?.updatedAt || isoNow(), actorName: entry.actorName }
    }).catch(() => {});
  }

  async function connectSupabase() {
    const client = getSupabaseClient();
    if (!client) return;

    setSupabaseStatus("conectando");
    if (supabaseCtx.channel) {
      try {
        await supabaseCtx.channel.unsubscribe();
      } catch (_err) {}
    }

    const channel = client.channel("restobar-live", { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "audit_event" }, (message) => {
        if (message?.payload) {
          pushRemoteMonitorEvent(message.payload);
          const user = getCurrentUser();
          if (user?.role === "admin" && uiState.adminTab === "monitor") {
            render();
          }
        }
      })
      .on("broadcast", { event: "state_changed" }, () => {
        void pullStateFromSupabase();
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        supabaseCtx.connected = true;
        setSupabaseStatus("conectado");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        supabaseCtx.connected = false;
        setSupabaseStatus("aviso", `Realtime: ${status}`);
      }
    });

    supabaseCtx.channel = channel;
    await pullStateFromSupabase();
    scheduleSupabaseSync();
  }

  function getCurrentUser() {
    return state.users.find((u) => u.id === sessionUserId) || null;
  }

  function findUserByLoginPassword(login, password) {
    return state.users.find((u) => u.active && u.login === login && u.password === password) || null;
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

  function appendComandaEvent(comanda, { actor, type, detail, reason = "", itemId = null }) {
    comanda.events = comanda.events || [];
    comanda.events.push({
      ts: isoNow(),
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      type,
      detail,
      reason,
      itemId
    });
    appendAudit({ actor, type, detail, comandaId: comanda.id, itemId, reason });
  }

  function comandaTotal(comanda) {
    return (comanda.items || []).reduce((sum, item) => {
      if (item.canceled) return sum;
      return sum + Number(item.qty) * Number(item.priceAtSale || 0);
    }, 0);
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

  function listPendingKitchenItems() {
    const rows = [];
    for (const comanda of state.openComandas) {
      for (const item of comanda.items || []) {
        if (itemNeedsKitchen(item) && !item.canceled && !item.delivered) {
          rows.push({ comanda, item, remainingMs: kitchenRemainingMs(item) });
        }
      }
    }
    rows.sort((a, b) => new Date(a.item.createdAt) - new Date(b.item.createdAt));
    return rows;
  }

  function kitchenRemainingMs(item) {
    const totalMs = Number(item.prepTimeAtSale || 0) * Number(item.qty || 1) * 60 * 1000;
    const elapsed = Date.now() - new Date(item.createdAt).getTime();
    return Math.max(0, totalMs - elapsed);
  }

  function totalKitchenQueueMs() {
    return listPendingKitchenItems().reduce((sum, row) => sum + row.remainingMs, 0);
  }

  function paymentLabel(method) {
    return PAYMENT_METHODS.find((p) => p.value === method)?.label || method;
  }

  function roleLabel(role) {
    if (role === "admin") return "Administrador";
    if (role === "waiter") return "Garcom";
    if (role === "cook") return "Cozinheiro";
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
          <div>
          <h2>${esc(ESTABLISHMENT_NAME)}</h2>
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
            <h2>${esc(ESTABLISHMENT_NAME)}</h2>
          </div>
          <p class="note">Acesso inicial: admin/admin, user/user e cook/cook.</p>
          <form id="login-form" class="form" autocomplete="off">
            <div class="field">
              <label>Login</label>
              <input name="login" required placeholder="admin ou user" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input name="password" type="password" required placeholder="admin ou user" />
            </div>
            <button class="btn primary" type="submit">Entrar</button>
          </form>
        </div>
      </div>
    `;
  }
  function renderAdminDashboard() {
    const open = state.openComandas.length;
    const closed = state.closedComandas.length;
    const pendingFiado = state.payables.filter((p) => p.status === "pendente");
    const grossToday = state.closedComandas.reduce((sum, c) => sum + comandaTotal(c), 0);

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Comandas Abertas</p><b>${open}</b></div>
          <div class="kpi"><p>Comandas Finalizadas Hoje</p><b>${closed}</b></div>
          <div class="kpi"><p>Total Vendido Hoje</p><b>${money(grossToday)}</b></div>
          <div class="kpi"><p>Fiado Pendente</p><b>${pendingFiado.length} (${money(pendingFiado.reduce((a, b) => a + b.total, 0))})</b></div>
        </div>
        <div class="card">
          <h3>Atalhos</h3>
          <div class="actions" style="margin-top:0.75rem;">
            <button class="btn secondary" data-action="set-tab" data-role="admin" data-tab="produtos">Gerenciar Produtos</button>
            <button class="btn secondary" data-action="set-tab" data-role="admin" data-tab="funcionarios">Funcionarios</button>
            <button class="btn secondary" data-action="set-tab" data-role="admin" data-tab="avulsa">Venda Avulsa</button>
            <button class="btn secondary" data-action="set-tab" data-role="admin" data-tab="financeiro">Estoque e Financas</button>
            <button class="btn secondary" data-action="set-tab" data-role="admin" data-tab="monitor">Monitor em Tempo Real</button>
          </div>
        </div>
      </div>
    `;
  }

  function categoryDisplay(category, subcategory = "") {
    if (category === "Bar") {
      return subcategory ? `Bar (Bebidas) / ${subcategory}` : "Bar (Bebidas)";
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
              <div class="actions">
                <button class="btn secondary" data-action="edit-product" data-id="${p.id}">Editar</button>
                <button class="btn secondary" data-action="toggle-product-availability" data-id="${p.id}">${p.available === false ? "Disponibilizar" : "Indisponibilizar"}</button>
                <button class="btn danger" data-action="delete-product" data-id="${p.id}">Apagar</button>
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

    if (category === "Bar") {
      const doses = products.filter((p) => (p.subcategory || "Geral") === "Doses/Copo");
      const gerais = products.filter((p) => (p.subcategory || "Geral") !== "Doses/Copo");
      return `
        <details class="compact-details" open>
          <summary><b>Bar (Bebidas)</b> | Subcategoria: Doses/Copo</summary>
          <div style="margin-top:0.55rem;">
            <h4 style="margin:0;">Doses/Copo</h4>
            ${
              doses.length
                ? `<div class="table-wrap" style="margin-top:0.45rem;"><table class="responsive-stack products-table"><thead><tr><th>Produto</th><th>Preco</th><th>Estoque</th><th>Preparo (min)</th><th>Custo</th><th>Acoes</th></tr></thead><tbody>${renderProductsTableRows(
                    doses
                  )}</tbody></table></div>`
                : `<div class="empty" style="margin-top:0.45rem;">Nenhum item em Doses/Copo.</div>`
            }
          </div>
          <div style="margin-top:0.7rem;">
            <h4 style="margin:0;">Outros itens de bar</h4>
            ${
              gerais.length
                ? `<div class="table-wrap" style="margin-top:0.45rem;"><table class="responsive-stack products-table"><thead><tr><th>Produto</th><th>Preco</th><th>Estoque</th><th>Preparo (min)</th><th>Custo</th><th>Acoes</th></tr></thead><tbody>${renderProductsTableRows(
                    gerais
                  )}</tbody></table></div>`
                : `<div class="empty" style="margin-top:0.45rem;">Nenhum item fora de Doses/Copo.</div>`
            }
          </div>
        </details>
      `;
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
            <div class="field" data-role="admin-bar-submenu">
              <label>Subcategoria de Bebidas (Bar)</label>
              <select name="subcategory">
                ${BAR_SUBCATEGORIES.map((s) => `<option value="${s}">${s}</option>`).join("")}
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
          <div class="actions" style="margin-top:0.75rem;">
            <button class="btn danger" data-action="clear-products">Remover Todos os Produtos</button>
          </div>
        </div>
        <div class="card">
          <h3>Categorias</h3>
          <p class="note">Classificacao sugerida: Bar, Cozinha, Espetinhos, Avulso e Ofertas (combos e promocionais).</p>
          <div class="actions" style="margin-top:0.75rem;">
            ${CATEGORIES.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}
            <span class="tag">Bar / Doses/Copo</span>
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
            <div class="field">
              <label>Funcao</label>
              <input name="functionName" required placeholder="Garcom ou Cozinheiro" />
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
    `;
  }

  function renderAdminPayables() {
    const pending = state.payables.filter((p) => p.status === "pendente");
    const paid = state.payables.filter((p) => p.status === "pago");

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Menu A Pagar (Fiado)</h3>
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
        if (item.canceled) continue;
        const qty = Number(item.qty || 0);
        const price = Number(item.priceAtSale || 0);
        const cost = Number(item.costAtSale || 0);
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

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Receita Bruta</p><b>${money(finance.grossRevenue)}</b></div>
          <div class="kpi"><p>Custo Total</p><b>${money(finance.totalCost)}</b></div>
          <div class="kpi"><p>Lucro Liquido Total</p><b>${money(finance.netProfit)}</b></div>
          <div class="kpi"><p>Base de Historico</p><b>90 dias</b></div>
        </div>
        <div class="card">
          <h3>Estoque e Financas Integrados</h3>
          <p class="note">Valide com credencial de admin para salvar preco, estoque e custo.</p>
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
                <input name="adminLogin" required placeholder="admin" />
              </div>
              <div class="field">
                <label>Validacao admin (senha)</label>
                <input name="adminPassword" type="password" required placeholder="admin" />
              </div>
            </div>
            <button class="btn primary" type="submit">Salvar Preco, Estoque e Custo</button>
          </form>
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
      </div>
    `;
  }

  function buildCashSummary(commandas) {
    const total = commandas.reduce((sum, c) => sum + comandaTotal(c), 0);
    const byPayment = {};
    for (const c of commandas) {
      const method = c.payment?.method || "nao_finalizada";
      byPayment[method] = (byPayment[method] || 0) + comandaTotal(c);
    }
    return {
      commandasCount: commandas.length,
      total,
      byPayment
    };
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
    if (!comanda) return "";

    const rows = (comanda.items || [])
      .map(
        (item) =>
          `<tr><td>${esc(item.name)}</td><td>${item.qty}</td><td>${money(item.priceAtSale)}</td><td>${
            itemNeedsKitchen(item) && !item.canceled ? esc(kitchenStatusLabel(item.kitchenStatus || "fila")) : item.canceled ? "Cancelado" : item.delivered ? "Entregue" : "Pendente"
          }</td><td>${esc(item.waiterNote || "-")}${item.deliveryRequested ? ` | Entrega: ${esc(item.deliveryRecipient || "-")} @ ${esc(item.deliveryLocation || "-")}` : ""}</td></tr>`
      )
      .join("");
    const events = (comanda.events || [])
      .slice(-20)
      .reverse()
      .map((e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)}</td><td>${esc(e.type)}</td><td>${esc(e.detail)}</td></tr>`)
      .join("");

    return `
      <div class="detail-box" style="margin-top:0.75rem;">
        <div class="detail-header">
          <h4>Detalhes da comanda ${esc(comanda.id)}</h4>
          <button class="btn secondary" data-action="close-comanda-details">Fechar</button>
        </div>
        <p class="note">Mesa: ${esc(comanda.table)} | Cliente: ${esc(comanda.customer || "-")} | Status: ${esc(comanda.status || "aberta")}</p>
        <p class="note">Criada em ${formatDateTime(comanda.createdAt)} ${comanda.closedAt ? `| Fechada em ${formatDateTime(comanda.closedAt)}` : ""}</p>
        <p class="note">Pagamento: ${esc(paymentLabel(comanda.payment?.method || "-"))} | Total: <b>${money(comandaTotal(comanda))}</b></p>
        <div class="table-wrap" style="margin-top:0.5rem;">
          <table>
            <thead><tr><th>Produto</th><th>Qtd</th><th>Unit.</th><th>Status</th><th>Obs</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">Sem itens.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="table-wrap" style="margin-top:0.5rem;">
          <table>
            <thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Detalhe</th></tr></thead>
            <tbody>${events || `<tr><td colspan="4">Sem eventos.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function comandaUpdatedAt(comanda) {
    const lastEventAt = (comanda.events || []).length ? (comanda.events || []).slice(-1)[0]?.ts : null;
    return comanda.closedAt || lastEventAt || comanda.createdAt;
  }

  function renderComandaRecordsCompact(commandas, options = {}) {
    const limit = Number(options.limit || 60);
    const title = options.title || "Registros por Comanda";
    if (!commandas.length) {
      return `
        <div class="card">
          <h3>${esc(title)}</h3>
          <div class="empty" style="margin-top:0.75rem;">Sem registros de comandas para o filtro atual.</div>
        </div>
      `;
    }

    const ordered = [...commandas]
      .sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0))
      .slice(0, limit);
    return `
      <div class="card">
        <h3>${esc(title)}</h3>
        <p class="note">Cada comanda fica minimizada para evitar poluicao visual.</p>
        ${ordered
          .map((comanda) => {
            const validItems = (comanda.items || []).filter((i) => !i.canceled).length;
            const events = (comanda.events || []).slice(-20).reverse();
            return `
              <details class="compact-details" style="margin-top:0.65rem;">
                <summary>
                  <b>${esc(comanda.id)}</b> | ${esc(comanda.status || "aberta")} | Mesa: ${esc(comanda.table || "-")} | Cliente: ${esc(comanda.customer || "-")} | Itens: ${validItems} | Total: ${money(comandaTotal(comanda))}
                </summary>
                <div class="note" style="margin-top:0.45rem;">Atualizada em: ${formatDateTime(comandaUpdatedAt(comanda))}</div>
                <div class="table-wrap" style="margin-top:0.5rem;">
                  <table>
                    <thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Detalhe</th></tr></thead>
                    <tbody>
                      ${events.length
                        ? events.map((e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName || "-")}</td><td>${esc(e.type || "-")}</td><td>${esc(e.detail || "-")}</td></tr>`).join("")
                        : `<tr><td colspan="4">Sem eventos registrados.</td></tr>`}
                    </tbody>
                  </table>
                </div>
                <div class="actions" style="margin-top:0.5rem;">
                  <button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${comanda.id}">Abrir detalhe completo</button>
                </div>
              </details>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAdminHistory() {
    const currentAudit = state.auditLog.slice(0, 250);
    const closures = state.history90;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Historico Imutavel (Dia Atual)</h3>
          <p class="note">Alteracoes de funcionarios e admin registradas para conferencia.</p>
          <details class="compact-details" style="margin-top:0.75rem;">
            <summary>Ver alteracoes do dia (${currentAudit.length})</summary>
            ${currentAudit.length
              ? `<div class="table-wrap" style="margin-top:0.55rem;"><table><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th><th>Abrir</th></tr></thead><tbody>${currentAudit
                  .map(
                    (e) =>
                      `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)} (${esc(e.actorRole)})</td><td>${esc(e.type)}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail)}</td><td>${
                        e.comandaId ? `<button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${e.comandaId}">Ver</button>` : "-"
                      }</td></tr>`
                  )
                  .join("")}</tbody></table></div>`
              : `<div class="empty" style="margin-top:0.55rem;">Sem eventos registrados ainda.</div>`}
          </details>
          ${renderComandaDetailsBox()}
        </div>
        <div class="card">
          <h3>Historico de Fechamentos (90 dias)</h3>
          ${closures.length
            ? closures
                .map((h) => {
                  const summary = h.summary || buildCashSummary(h.commandas || []);
                  return `<details style="margin-top:0.75rem;"><summary><b>${esc(h.id)}</b> | Fechado em ${formatDateTime(h.closedAt)} | ${summary.commandasCount} comandas | ${money(summary.total)}</summary><div class="table-wrap" style="margin-top:0.6rem;"><table><thead><tr><th>Comanda</th><th>Status</th><th>Total</th><th>Cliente</th><th>Abrir</th></tr></thead><tbody>${(h.commandas || [])
                    .map(
                      (c) =>
                        `<tr><td>${esc(c.id)}</td><td>${esc(c.status)}</td><td>${money(comandaTotal(c))}</td><td>${esc(c.customer || "-")}</td><td><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`
                    )
                    .join("")}</tbody></table></div></details>`;
                })
                .join("")
            : `<div class="empty" style="margin-top:0.75rem;">Nenhum fechamento realizado ainda.</div>`}
        </div>
      </div>
    `;
  }

  function renderAdminCash() {
    const openInfo = `Caixa ${state.cash.id} aberto em ${formatDateTime(state.cash.openedAt)}`;
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Fechar Caixa</h3>
          <p class="note">Solicita segunda autenticacao para evitar fechamento por engano.</p>
          <p class="note" style="margin-top:0.35rem;">${esc(openInfo)}</p>
          <form id="close-cash-form" class="form" style="margin-top:0.75rem;" autocomplete="off">
            <div class="field">
              <label>Login admin (2a confirmacao)</label>
              <input name="login" required placeholder="admin" />
            </div>
            <div class="field">
              <label>Senha admin</label>
              <input name="password" type="password" required placeholder="admin" />
            </div>
            <button type="submit" class="btn danger">Fechar Caixa Agora</button>
          </form>
        </div>
        <div class="card">
          <h3>Regras aplicadas no fechamento</h3>
          <ul>
            <li>Todas as comandas do dia vao para historico de 90 dias.</li>
            <li>Historico detalhado de eventos e cada comanda e preservado.</li>
            <li>Dados operacionais do dia sao limpos (comandas e log atual).</li>
            <li>Estoque permanece para o proximo dia.</li>
          </ul>
        </div>
      </div>
    `;
  }

  function renderAdminMonitor() {
    const employees = state.users.filter((u) => u.role === "waiter" || u.role === "cook");
    const selected = uiState.monitorWaiterId;
    const allEvents = [...uiState.remoteMonitorEvents, ...state.auditLog]
      .filter((event) => event.actorRole === "waiter" || event.actorRole === "cook")
      .sort((a, b) => new Date(b.ts || b.broadcastAt) - new Date(a.ts || a.broadcastAt));
    const filteredEvents = allEvents.filter((event) => {
      if (selected === "all") return true;
      return String(event.actorId) === String(selected);
    });

    const monitorComandas = [...state.openComandas, ...state.closedComandas.slice(0, 160)]
      .filter((comanda) => {
        if (selected === "all") return true;
        return String(comanda.createdBy) === String(selected) || (comanda.events || []).some((e) => String(e.actorId) === String(selected));
      })
      .filter((comanda) => matchesComandaSearch(comanda, uiState.adminComandaSearch))
      .sort((a, b) => new Date(comandaUpdatedAt(b) || 0) - new Date(comandaUpdatedAt(a) || 0));
    const opened = monitorComandas.filter((c) => c.status !== "finalizada");
    const finalized = monitorComandas.filter((c) => c.status === "finalizada");

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Monitor Operacional</h3>
          <p class="note">Acompanhe o fluxo entre garcom, cliente e cozinha com visao clara e objetiva.</p>
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
            <label>Buscar comanda</label>
            <input data-role="admin-search" value="${esc(uiState.adminComandaSearch)}" placeholder="Mesa, referencia, codigo ou cliente" />
          </div>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Em andamento</p><b>${opened.length}</b></div>
            <div class="kpi"><p>Finalizadas</p><b>${finalized.length}</b></div>
          </div>
          ${monitorComandas.length
            ? `<div class="table-wrap monitor-table-wrap" style="margin-top:0.75rem;"><table class="monitor-table"><thead><tr><th>Comanda</th><th>Local</th><th>Cliente</th><th>Situacao</th><th>Atualizacao</th><th>Total</th><th>Acoes</th></tr></thead><tbody>${monitorComandas
                .map((c) => {
                  const kitchenBadge = renderKitchenIndicatorBadge(c, true);
                  return `<tr><td data-label="Comanda">${esc(c.id)}</td><td data-label="Local">${esc(c.table)}</td><td data-label="Cliente">${esc(c.customer || "-")}</td><td data-label="Situacao">${c.status === "finalizada" ? '<span class="tag">Finalizada</span>' : '<span class="tag">Aberta</span>'}${kitchenBadge ? `<div style="margin-top:0.3rem;">${kitchenBadge}</div>` : ""}</td><td data-label="Atualizacao">${formatDateTime(comandaUpdatedAt(c))}</td><td data-label="Total">${money(comandaTotal(c))}</td><td data-label="Acoes"><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`;
                })
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem comandas para o filtro escolhido.</div>`}
          <details class="compact-details" style="margin-top:0.75rem;">
            <summary>Historico de alteracoes (oculto)</summary>
            ${filteredEvents.length
              ? `<div class="table-wrap" style="margin-top:0.65rem;"><table><thead><tr><th>Data</th><th>Funcionario</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${filteredEvents
                  .slice(0, 220)
                  .map(
                    (e) =>
                      `<tr><td>${formatDateTime(e.ts || e.broadcastAt)}</td><td>${esc(e.actorName || "-")}</td><td>${esc(e.type || "-")}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail || "-")}</td></tr>`
                  )
                  .join("")}</tbody></table></div>`
              : `<div class="empty" style="margin-top:0.65rem;">Sem eventos para o filtro atual.</div>`}
          </details>
          ${renderComandaDetailsBox()}
        </div>
        ${renderComandaRecordsCompact(monitorComandas, { title: "Registros por Comanda (Minimizados)", limit: 70 })}
      </div>
    `;
  }

  function renderAdmin(user) {
    const tabs = [
      { key: "dashboard", label: "Dashboard" },
      { key: "produtos", label: "Produtos" },
      { key: "funcionarios", label: "Funcionarios" },
      { key: "avulsa", label: "Venda Avulsa" },
      { key: "monitor", label: "Monitor" },
      { key: "apagar", label: "A Pagar" },
      { key: "financeiro", label: "Financas" },
      { key: "historico", label: "Historico" },
      { key: "caixa", label: "Fechar Caixa" }
    ];

    let content = "";
    switch (uiState.adminTab) {
      case "produtos":
        content = renderAdminProducts();
        break;
      case "funcionarios":
        content = renderAdminEmployees();
        break;
      case "avulsa":
        content = renderQuickSale("admin");
        break;
      case "monitor":
        content = renderAdminMonitor();
        break;
      case "apagar":
        content = renderAdminPayables();
        break;
      case "financeiro":
        content = renderAdminFinance();
        break;
      case "historico":
        content = renderAdminHistory();
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
          <button class="btn secondary" data-action="set-tab" data-role="waiter" data-tab="avulsa">Venda Avulsa</button>
        </div>
      </div>
    `;
  }

  function renderWaiterCreateComanda() {
    const activeComanda = uiState.waiterActiveComandaId ? findOpenComanda(uiState.waiterActiveComandaId) : null;
    if (uiState.waiterActiveComandaId && !activeComanda) {
      uiState.waiterActiveComandaId = null;
    }

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Abrir Pedido/Comanda</h3>
          <p class="note">Depois de criar, a comanda continua aberta ate o fechamento pelo garcom.</p>
          <form id="create-comanda-form" class="form" style="margin-top:0.75rem;">
            <div class="field">
              <label>Mesa ou referencia</label>
              <input name="table" required placeholder="Mesa 07" />
            </div>
            <div class="field">
              <label>Nome do cliente (opcional)</label>
              <input name="customer" placeholder="Cliente" />
            </div>
            <div class="field">
              <label>Observacao inicial</label>
              <textarea name="note" placeholder="Ex: alergia, sem gelo..."></textarea>
            </div>
            <button class="btn primary" type="submit">Criar Comanda</button>
          </form>
        </div>
        ${
          activeComanda
            ? `<div class="card">
          <h3>Comanda ativa agora: ${esc(activeComanda.id)}</h3>
          <p class="note">Adicione pedidos, acompanhe a cozinha e finalize quando necessario.</p>
          <div style="margin-top:0.75rem;">${renderComandaCard(activeComanda, { forceExpanded: true })}</div>
        </div>`
            : `<div class="card">
          <h3>Resumo rapido</h3>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Abertas</p><b>${state.openComandas.length}</b></div>
            <div class="kpi"><p>Fila Cozinha</p><b>${listPendingKitchenItems().length}</b></div>
            <div class="kpi"><p>Fechadas hoje</p><b>${state.closedComandas.length}</b></div>
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
              <label><input name="paidConfirm" type="checkbox" /> Venda paga e conferida</label>
            </div>
            <div class="note" data-role="quick-kitchen-note">Para categorias fora de cozinha, a venda fecha imediatamente.</div>
            <button class="btn primary" type="submit">Finalizar Venda Avulsa</button>
          </form>
        </div>
        <div class="card">
          <h3>Regras</h3>
          <ul>
            <li>Exige produto, quantidade e pagamento confirmado.</li>
            <li>Itens com fluxo de cozinha entram no painel da cozinha.</li>
            <li>Bar, Espetinhos, Avulso e Ofertas de pronta entrega finalizam como venda direta.</li>
            <li>Baixa estoque automaticamente.</li>
            <li>Entra no historico e nos indicadores financeiros.</li>
          </ul>
        </div>
      </div>
    `;
  }

  function renderItemRow(comanda, item) {
    const flags = [];
    if (item.canceled) flags.push('<span class="tag">Cancelado</span>');
    if (item.delivered) flags.push('<span class="tag">Entregue</span>');
    if (item.deliveryRequested) flags.push('<span class="tag">Entrega</span>');
    if (!item.delivered && !item.canceled && itemNeedsKitchen(item)) {
      const remMin = Math.ceil(kitchenRemainingMs(item) / 60000);
      flags.push(`<span class="tag">Fila cozinha ~${remMin} min</span>`);
      flags.push(`<span class="tag">Status: ${esc(kitchenStatusLabel(item.kitchenStatus || "fila"))}</span>`);
      if (item.kitchenStatusByName) {
        flags.push(`<span class="tag">${esc(item.kitchenStatusByName)}</span>`);
      }
    }

    return `
      <div class="item-row">
        <div><b>${esc(item.name)}</b> x${item.qty} | ${money(item.priceAtSale)} un | Subtotal ${money(Number(item.qty) * Number(item.priceAtSale || 0))}</div>
        <div class="note">Categoria: ${esc(item.category)} | Criado em: ${formatDateTime(item.createdAt)}</div>
        ${item.waiterNote ? `<div class="note">Obs: ${esc(item.waiterNote)}</div>` : ""}
        ${item.deliveryRequested ? `<div class="note"><b>Entrega:</b> ${esc(item.deliveryRecipient || "-")} | ${esc(item.deliveryLocation || "-")}</div>` : ""}
        ${item.canceled ? `<div class="note">Cancelamento: ${esc(item.cancelReason || "-")} ${item.cancelNote ? `| ${esc(item.cancelNote)}` : ""}</div>` : ""}
        <div class="actions">
          ${flags.join(" ")}
        </div>
      </div>
    `;
  }

  function renderFinalizePanel(comanda) {
    return `
      <form class="card form" data-role="finalize-form" data-comanda-id="${comanda.id}">
        <h4>Finalizacao da comanda ${esc(comanda.id)}</h4>
        <div class="note">Confira dados, escolha pagamento e confirme apos validar manualmente com cliente.</div>
        <div class="field">
          <label>Pagamento</label>
          <select name="paymentMethod" data-role="payment-method">
            ${PAYMENT_METHODS.map((m) => `<option value="${m.value}">${m.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" data-role="fiado-box" style="display:none;">
          <label>Nome do cliente (obrigatorio no fiado)</label>
          <input name="fiadoCustomer" placeholder="Nome completo" />
        </div>
        <div class="field" data-role="pix-box" style="display:none;">
          <label>QR Pix (teste aleatorio)</label>
          <div class="card" style="display:grid; place-items:center; gap:0.5rem;">
            <canvas data-role="pix-canvas"></canvas>
            <div class="note" data-role="pix-code"></div>
          </div>
        </div>
        <div class="field">
          <label><input type="checkbox" name="manualCheck" /> Pagamento conferido manualmente com cliente</label>
        </div>
        <div class="note"><b>Valor total:</b> ${money(comandaTotal(comanda))}</div>
        <button class="btn ok" type="submit">Confirmar finalizacao</button>
      </form>
    `;
  }

  function renderComandaCard(comanda, options = {}) {
    const forceExpanded = Boolean(options.forceExpanded);
    const total = comandaTotal(comanda);
    const isCollapsed = forceExpanded ? false : isWaiterComandaCollapsed(comanda.id);
    const isFinalizeOpen = Boolean(uiState.finalizeOpenByComanda[comanda.id]);
    const kitchenIndicator = renderKitchenIndicatorBadge(comanda);
    const validItemsCount = (comanda.items || []).filter((item) => !item.canceled).length;
    const editableItemsCount = (comanda.items || []).filter((item) => !item.canceled).length;
    const actor = getCurrentUser();
    const canResolveIndicator = actor && actor.role === "waiter" && kitchenIndicator;

    return `
      <div class="comanda-card ${isCollapsed ? "is-collapsed" : ""} ${forceExpanded ? "is-focused" : ""}">
        <div class="comanda-header">
          <div>
            <h3>${esc(comanda.id)} <span class="tag">Mesa: ${esc(comanda.table)}</span></h3>
            ${kitchenIndicator ? `<div style="margin-top:0.3rem;">${kitchenIndicator}</div>` : ""}
            <p class="note">Cliente: ${esc(comanda.customer || "Nao informado")} | Aberta em ${formatDateTime(comanda.createdAt)}</p>
            <p class="note">Total atual: <b>${money(total)}</b></p>
          </div>
          ${forceExpanded ? "" : `<button class="btn secondary" data-action="toggle-comanda-collapse" data-comanda-id="${comanda.id}">${isCollapsed ? "Expandir" : "Minimizar"}</button>`}
        </div>

        ${!isCollapsed && comanda.notes?.length ? `<div class="note">Obs da comanda: ${comanda.notes.map((n) => esc(n)).join(" | ")}</div>` : ""}
        ${!isCollapsed && canResolveIndicator ? `<div class="actions indicator-actions"><button class="btn secondary" data-action="resolve-kitchen-indicator" data-comanda-id="${comanda.id}" data-mode="entendi">Entendi o alerta</button><button class="btn ok" data-action="resolve-kitchen-indicator" data-comanda-id="${comanda.id}" data-mode="entregue">Marcar como entregue</button></div>` : ""}
        ${
          !isCollapsed && editableItemsCount
            ? `<div class="actions comanda-item-picker-actions"><button class="btn secondary compact-action" data-action="increment-item-picker" data-comanda-id="${comanda.id}">+1 em item da comanda</button><button class="btn danger compact-action" data-action="cancel-item-picker" data-comanda-id="${comanda.id}">Devolucao/cancelar item</button></div>`
            : ""
        }

        ${
          isCollapsed
            ? `<div class="note">Itens: <b>${validItemsCount}</b> | Toque em "Expandir" para detalhes.${kitchenIndicator ? " Existe alerta de cozinha pendente." : ""}</div>`
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
            <div class="field">
              <label>Obs manual do pedido</label>
              <input name="waiterNote" placeholder="Opcional" />
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
          <button class="btn secondary" type="submit">Adicionar ao pedido</button>
        </form>
        `
        }

        ${
          !isCollapsed
            ? `<div class="actions">
          <button class="btn secondary" data-action="add-comanda-note" data-comanda-id="${comanda.id}">Adicionar observacao</button>
          <button class="btn secondary" data-action="print-comanda" data-comanda-id="${comanda.id}">Imprimir cupom</button>
          <button class="btn primary" data-action="toggle-finalize" data-comanda-id="${comanda.id}">${isFinalizeOpen ? "Fechar painel" : "Finalizar comanda"}</button>
        </div>`
            : ""
        }

        ${!isCollapsed && isFinalizeOpen ? renderFinalizePanel(comanda) : ""}
      </div>
    `;
  }

  function renderWaiterOpenComandas() {
    if (!state.openComandas.length) {
      return `<div class="empty">Nenhuma comanda aberta no momento.</div>`;
    }

    const sorted = [...state.openComandas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const filtered = sorted.filter((c) => matchesComandaSearch(c, uiState.waiterComandaSearch));

    return `
      <div class="card">
        <div class="field">
          <label>Busca por comanda (mesa/referencia/cliente/codigo)</label>
          <input data-role="waiter-search" value="${esc(uiState.waiterComandaSearch)}" placeholder="Ex: Mesa 7, CMD-0001, Joao" />
        </div>
        <p class="note" style="margin-top:0.5rem;">Comandas ficam minimizadas por padrao para facilitar visualizacao no smartphone.</p>
      </div>
      ${filtered.length ? `<div class="comanda-grid" style="margin-top:1rem;">${filtered.map((c) => renderComandaCard(c)).join("")}</div>` : `<div class="empty" style="margin-top:1rem;">Nenhuma comanda encontrada para a busca.</div>`}
    `;
  }

  function renderWaiterKitchen() {
    const queue = listPendingKitchenItems();
    const avg = queue.length ? Math.ceil(queue.reduce((s, r) => s + r.remainingMs, 0) / queue.length / 60000) : 0;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Fila de Espera - Cozinha</h3>
          <p class="note">Tempo medio atual: <b>${avg} min</b></p>
          ${queue.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table class="responsive-stack waiter-kitchen-table"><thead><tr><th>Comanda</th><th>Produto</th><th>Qtd</th><th>Status Cozinha</th><th>Tempo restante</th><th>Mesa/ref</th></tr></thead><tbody>${queue
                .map(
                  (r) =>
                    `<tr><td data-label="Comanda">${esc(r.comanda.id)}</td><td data-label="Produto">${esc(r.item.name)}</td><td data-label="Qtd">${r.item.qty}</td><td data-label="Status Cozinha"><span class="tag">${esc(kitchenStatusLabel(r.item.kitchenStatus || "fila"))}</span></td><td data-label="Tempo restante">${Math.ceil(r.remainingMs / 60000)} min</td><td data-label="Mesa/ref">${esc(r.comanda.table)}</td></tr>`
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
    const todayAudit = state.auditLog.slice(0, 250);
    const closed = allFinalizedComandasForFinance().sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0)).slice(0, 150);

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Historico de Alteracoes (imutavel)</h3>
          <details class="compact-details" style="margin-top:0.75rem;">
            <summary>Ver alteracoes (${todayAudit.length})</summary>
            ${todayAudit.length
              ? `<div class="table-wrap" style="margin-top:0.55rem;"><table><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${todayAudit
                  .map(
                    (e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)}</td><td>${esc(e.type)}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail)}</td></tr>`
                  )
                  .join("")}</tbody></table></div>`
              : `<div class="empty" style="margin-top:0.55rem;">Sem eventos ainda.</div>`}
          </details>
        </div>
        <div class="card">
          <h3>Comandas Finalizadas Hoje</h3>
          <details class="compact-details" style="margin-top:0.75rem;">
            <summary>Ver finalizadas (${closed.length})</summary>
            ${closed.length
              ? `<div class="table-wrap" style="margin-top:0.55rem;"><table><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Fechada em</th><th>Abrir</th></tr></thead><tbody>${closed
                  .map(
                    (c) =>
                      `<tr><td>${esc(c.id)}</td><td>${esc(c.customer || "-")}</td><td>${money(comandaTotal(c))}</td><td>${esc(paymentLabel(c.payment?.method || "-"))}</td><td>${formatDateTime(c.closedAt)}</td><td><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`
                  )
                  .join("")}</tbody></table></div>`
              : `<div class="empty" style="margin-top:0.55rem;">Ainda sem comandas finalizadas.</div>`}
          </details>
          ${renderComandaDetailsBox()}
        </div>
      </div>
    `;
  }

  function listActiveKitchenOrders() {
    const rows = [];
    for (const comanda of state.openComandas) {
      for (const item of comanda.items || []) {
        if (itemNeedsKitchen(item) && !item.canceled && !item.delivered) {
          rows.push({ comanda, item });
        }
      }
    }
    rows.sort((a, b) => new Date(a.item.createdAt) - new Date(b.item.createdAt));
    return rows;
  }

  function renderCookActive() {
    const rows = listActiveKitchenOrders().filter((row) => matchesComandaSearch(row.comanda, uiState.cookSearch));
    const countFila = rows.filter((r) => (r.item.kitchenStatus || "fila") === "fila").length;
    const countCooking = rows.filter((r) => (r.item.kitchenStatus || "fila") === "cozinhando").length;
    const countMissing = rows.filter((r) => (r.item.kitchenStatus || "fila") === "em_falta").length;

    return `
      <div class="grid">
        <div class="kpis">
          <div class="kpi"><p>Na fila</p><b>${countFila}</b></div>
          <div class="kpi"><p>Cozinhando</p><b>${countCooking}</b></div>
          <div class="kpi"><p>Em falta</p><b>${countMissing}</b></div>
        </div>
        <div class="card">
          <h3>Ambiente Cozinha</h3>
          <p class="note">Receba pedidos de cozinha em tempo real e atualize o status para garcom/admin.</p>
          <p class="note" style="margin-top:0.25rem;">Este painel exibe itens com fluxo de cozinha (Cozinha e Ofertas dependentes da cozinha).</p>
          <div class="field" style="margin-top:0.75rem;">
            <label>Busca por comanda</label>
            <input data-role="cook-search" value="${esc(uiState.cookSearch)}" placeholder="Mesa/referencia/comanda/cliente" />
          </div>
          <p class="note" style="margin-top:0.6rem;">Pedidos marcados como entrega exibem recebedor e local para separacao correta.</p>
          ${rows.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Mesa/ref</th><th>Cliente</th><th>Produto</th><th>Qtd</th><th>Obs</th><th>Status</th><th>Entrega</th><th>Acao</th></tr></thead><tbody>${rows
                .map(
                  (row) =>
                    `<tr><td>${esc(row.comanda.id)}</td><td>${esc(row.comanda.table)}</td><td>${esc(row.comanda.customer || "-")}</td><td>${esc(row.item.name)}</td><td>${row.item.qty}</td><td>${esc(row.item.waiterNote || "-")}</td><td><span class="tag">${esc(kitchenStatusLabel(row.item.kitchenStatus || "fila"))}</span></td><td>${row.item.deliveryRequested ? `<div><b>${esc(row.item.deliveryRecipient || "-")}</b></div><div class="note">${esc(row.item.deliveryLocation || "-")}</div>` : "Balcao/Mesa"}</td><td><div class="actions"><button class="btn secondary" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="cozinhando">Cozinhando</button><button class="btn danger" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="em_falta">Em falta</button><button class="btn ok" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="entregue">Entregue</button></div></td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem pedidos ativos na cozinha.</div>`}
        </div>
      </div>
    `;
  }

  function renderCookHistory() {
    const rows = [...(state.cookHistory || [])].sort((a, b) => new Date(b.deliveredAt || b.updatedAt || 0) - new Date(a.deliveredAt || a.updatedAt || 0));
    return `
      <div class="card">
        <h3>Historico da Cozinha</h3>
        <p class="note">Limpo automaticamente ao fechar o caixa.</p>
        <details class="compact-details" style="margin-top:0.75rem;">
          <summary>Ver historico (${rows.length})</summary>
          ${rows.length
            ? `<div class="table-wrap" style="margin-top:0.55rem;"><table><thead><tr><th>Data</th><th>Comanda</th><th>Mesa/ref</th><th>Produto</th><th>Qtd</th><th>Status final</th><th>Entrega</th><th>Cozinheiro</th></tr></thead><tbody>${rows
                .map(
                  (row) =>
                    `<tr><td>${formatDateTime(row.deliveredAt || row.updatedAt)}</td><td>${esc(row.comandaId)}</td><td>${esc(row.table || "-")}</td><td>${esc(row.itemName)}</td><td>${row.qty}</td><td>${esc(kitchenStatusLabel(row.status || "entregue"))}</td><td>${row.deliveryRequested ? `<div><b>${esc(row.deliveryRecipient || "-")}</b></div><div class="note">${esc(row.deliveryLocation || "-")}</div>` : "Balcao/Mesa"}</td><td>${esc(row.cookName || "-")}</td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.55rem;">Sem pedidos entregues pela cozinha neste caixa.</div>`}
        </details>
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
    const tabs = [
      { key: "abrir", label: "Abrir pedido/comanda" },
      { key: "abertas", label: "Comandas abertas" },
      { key: "cozinha", label: "Fila cozinha" },
      { key: "consulta", label: "Consulta precos" },
      { key: "avulsa", label: "Venda Avulsa" },
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
      case "avulsa":
        content = renderQuickSale("waiter");
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
        ${renderTabs("waiter", tabs, uiState.waiterTab)}
        ${content}
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
    } else if (user.role === "cook") {
      renderCook(user);
    } else {
      renderWaiter(user);
    }

    hydrateAfterRender();
  }

  function hydrateAfterRender() {
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
    const box = form?.querySelector('[data-role="admin-bar-submenu"]');
    const offerBox = form?.querySelector('[data-role="admin-offer-kitchen"]');
    const subSel = form?.subcategory;
    const offerNeedsKitchen = form?.offerNeedsKitchen;
    if (!box || !subSel) return;

    const isBar = category === "Bar";
    const isOffer = category === "Ofertas";
    box.style.display = isBar ? "grid" : "none";
    if (offerBox) offerBox.style.display = isOffer ? "grid" : "none";
    if (!isBar) {
      subSel.value = "Geral";
    } else if (!BAR_SUBCATEGORIES.includes(subSel.value)) {
      subSel.value = "Geral";
    }
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
    if (!box || !fields || !check || !recipient || !location) return;

    const isKitchen = productNeedsKitchen(product);
    if (!isKitchen) {
      box.style.display = "none";
      fields.style.display = "none";
      check.checked = false;
      recipient.value = "";
      location.value = "";
      recipient.required = false;
      location.required = false;
      return;
    }

    box.style.display = "grid";
    fields.style.display = check.checked ? "grid" : "none";
    recipient.required = check.checked;
    location.required = check.checked;
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
          `<option value="${p.id}" ${!productIsAvailable(p) ? "disabled" : ""}>${esc(p.name)}${p.category === "Bar" ? ` (${esc(p.subcategory || "Geral")})` : ""}${p.category === "Ofertas" ? ` (${p.requiresKitchen ? "cozinha" : "pronta entrega"})` : ""} | ${money(p.price)} | estoque ${p.stock}${p.available === false ? " | indisponivel" : ""}</option>`
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
          `<option value="${p.id}" ${!productIsAvailable(p) ? "disabled" : ""}>${esc(p.name)}${p.category === "Bar" ? ` (${esc(p.subcategory || "Geral")})` : ""}${p.category === "Ofertas" ? ` (${p.requiresKitchen ? "cozinha" : "pronta entrega"})` : ""} | ${money(p.price)} | estoque ${p.stock}${p.available === false ? " | indisponivel" : ""}</option>`
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
    if (!actor || (actor.role !== "waiter" && actor.role !== "admin")) {
      alert("Somente garcom ou administrador podem resolver alertas.");
      return;
    }
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;

    let resolvedCount = 0;
    for (const item of comanda.items || []) {
      if (!itemNeedsKitchen(item) || !item.kitchenAlertUnread) continue;
      item.kitchenAlertUnread = false;
      if (mode === "entregue" && item.kitchenStatus === "entregue") {
        item.waiterDeliveredAt = isoNow();
        item.waiterDeliveredById = actor.id;
        item.waiterDeliveredByName = actor.name;
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

  function login(login, password) {
    const user = findUserByLoginPassword(login, password);
    if (!user) {
      alert("Login/senha invalidos.");
      return;
    }

    sessionUserId = user.id;
    persistSessionUserId(sessionUserId);
    saveState({ skipCloud: true, touchMeta: false });
    render();
  }

  function logout() {
    sessionUserId = null;
    persistSessionUserId(null);
    uiState.waiterActiveComandaId = null;
    saveState({ skipCloud: true, touchMeta: false });
    render();
  }

  function createProduct(form) {
    const actor = currentActor();
    const name = form.name.value.trim();
    const category = form.category.value;
    const subcategory = category === "Bar" ? normalizeProductSubcategory({ category: "Bar", subcategory: form.subcategory.value }) : "";
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
    if (p.category === "Bar") {
      const subcategory = prompt("Subcategoria do bar (Doses/Copo ou Geral):", String(p.subcategory || "Geral"));
      if (subcategory === null) return;
      const rawSub = subcategory.trim();
      p.subcategory = rawSub.toLowerCase() === "doses" ? "Doses/Copo" : BAR_SUBCATEGORIES.includes(rawSub) ? rawSub : "Geral";
    } else {
      p.subcategory = "";
    }
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
    appendAudit({ actor, type: "produto_delete", detail: `Produto ${p.name} removido.` });
    saveState();
    render();
  }

  function clearAllProducts() {
    const actor = currentActor();
    if (!confirm("Remover TODOS os produtos para testes?")) return;
    state.products = [];
    appendAudit({ actor, type: "produto_clear", detail: "Todos os produtos foram removidos." });
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
    appendAudit({ actor, type: "estoque_update", detail: "Estoque atualizado manualmente pelo admin." });
    saveState();
    render();
  }

  function createEmployee(form) {
    const actor = currentActor();
    const name = form.name.value.trim();
    const role = form.role.value;
    const functionName = form.functionName.value.trim() || roleLabel(role);
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

  function deleteEmployee(userId) {
    const actor = currentActor();
    const employee = state.users.find((u) => u.id === userId && (u.role === "waiter" || u.role === "cook"));
    if (!employee) return;
    if (!confirm(`Apagar acesso de ${roleLabel(employee.role)} ${employee.name}?`)) return;

    state.users = state.users.filter((u) => u.id !== userId);
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
    const table = form.table.value.trim();
    const customer = form.customer.value.trim();
    const note = form.note.value.trim();

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
      notes: note ? [note] : [],
      items: [],
      events: [],
      payment: null,
      pixCodeDraft: null,
      kitchenAlertUnread: false
    };

    state.openComandas.push(comanda);
    appendComandaEvent(comanda, {
      actor,
      type: "comanda_aberta",
      detail: `Comanda aberta na ${table}${customer ? ` para ${customer}` : ""}.`
    });

    uiState.waiterTab = "abrir";
    uiState.waiterActiveComandaId = comanda.id;
    uiState.waiterCollapsedByComanda[comanda.id] = false;
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
    const paidConfirm = form.paidConfirm.checked;

    if (!paidConfirm) {
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
        priceAtSale: Number(product.price),
        costAtSale: Number(product.cost || 0),
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
        kitchenAlertUnread: true,
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
        uiState.waiterCollapsedByComanda[saleComanda.id] = false;
        uiState.waiterActiveComandaId = saleComanda.id;
      }
      saveState();
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
          priceAtSale: Number(product.price),
          costAtSale: Number(product.cost || 0),
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
    const comanda = findOpenComanda(comandaId);
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return;
    }

    const category = form.category.value;
    const productId = Number(form.productId.value || 0);
    const qty = Math.max(1, Number(form.qty.value || 1));
    const waiterNote = form.waiterNote.value.trim();
    const isDeliveryRaw = Boolean(form.isDelivery?.checked);
    const deliveryRecipient = String(form.deliveryRecipient?.value || "").trim();
    const deliveryLocation = String(form.deliveryLocation?.value || "").trim();

    const product = state.products.find((p) => p.id === productId && p.category === category);
    if (!product) {
      alert("Produto invalido.");
      return;
    }
    if (product.available === false) {
      alert(`Produto ${product.name} esta indisponivel no cardapio.`);
      return;
    }
    const needsKitchen = productNeedsKitchen(product);
    const isDelivery = needsKitchen && isDeliveryRaw;

    if (product.stock < qty) {
      alert(`Estoque insuficiente para ${product.name}. Disponivel: ${product.stock}`);
      return;
    }
    if (needsKitchen && isDelivery && (!deliveryRecipient || !deliveryLocation)) {
      alert("Para entrega, informe quem recebe e o local de entrega.");
      return;
    }

    product.stock -= qty;

    const waitingBefore = totalKitchenQueueMs();

    const item = {
      id: `IT-${String(state.seq.item++).padStart(5, "0")}`,
      productId: product.id,
      name: product.name,
      category: product.category,
      qty,
      priceAtSale: Number(product.price),
      costAtSale: Number(product.cost || 0),
      prepTimeAtSale: Number(product.prepTime || 0),
      requiresKitchen: Boolean(product.requiresKitchen),
      needsKitchen,
      waiterNote,
      noteType: "",
      createdAt: isoNow(),
      delivered: false,
      deliveredAt: null,
      kitchenStatus: needsKitchen ? "fila" : "",
      kitchenStatusAt: needsKitchen ? isoNow() : null,
      kitchenStatusById: null,
      kitchenStatusByName: "",
      kitchenAlertUnread: needsKitchen,
      deliveryRequested: isDelivery,
      deliveryRecipient: isDelivery ? deliveryRecipient : "",
      deliveryLocation: isDelivery ? deliveryLocation : "",
      canceled: false,
      canceledAt: null,
      cancelReason: "",
      cancelNote: ""
    };

    if (itemNeedsKitchen(item)) {
      const prepMs = item.prepTimeAtSale * qty * 60 * 1000;
      item.etaAt = new Date(Date.now() + waitingBefore + prepMs).toISOString();
    }

    comanda.items.push(item);
    if (itemNeedsKitchen(item)) {
      comanda.kitchenAlertUnread = true;
    }

    const kitchenInfo = itemNeedsKitchen(item) ? ` Tempo estimado: ${Math.ceil((waitingBefore + item.prepTimeAtSale * qty * 60000) / 60000)} min.` : "";
    const deliveryInfo = item.deliveryRequested ? ` Entrega para ${item.deliveryRecipient} em ${item.deliveryLocation}.` : "";
    appendComandaEvent(comanda, {
      actor,
      type: "item_add",
      detail: `Item ${item.name} x${qty} adicionado.${kitchenInfo}${deliveryInfo}`,
      reason: "",
      itemId: item.id
    });

    saveState();
    render();
  }

  function incrementItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.canceled) return;

    const product = state.products.find((p) => p.id === item.productId);
    if (product && product.available === false) {
      alert(`Produto ${product.name} esta indisponivel no cardapio.`);
      return;
    }
    if (!product || product.stock < 1) {
      alert("Sem estoque para adicionar mais uma unidade.");
      return;
    }

    product.stock -= 1;
    item.qty = Number(item.qty || 0) + 1;
    item.lastIncrementAt = isoNow();

    appendComandaEvent(comanda, {
      actor,
      type: "item_incrementado",
      detail: `Item ${item.name} incrementado (+1). Nova quantidade: ${item.qty}.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function pickComandaItemByPrompt(comanda, mode = "increment") {
    const candidates = (comanda.items || []).filter((item) => {
      if (item.canceled) return false;
      if (mode === "cancel") return true;
      return true;
    });
    if (!candidates.length) {
      alert("Nao ha itens validos nessa comanda.");
      return null;
    }

    const title = mode === "cancel" ? "Escolha o item para devolucao/cancelamento:" : "Escolha o item para adicionar +1:";
    const list = candidates
      .map(
        (item, idx) =>
          `${idx + 1} - ${item.name} x${item.qty}${itemNeedsKitchen(item) ? ` [${kitchenStatusLabel(item.kitchenStatus || "fila")}]` : ""}`
      )
      .join("\n");
    const answer = prompt(`${title}\n\n${list}\n\nDigite o numero do item:`, "1");
    if (answer === null) return null;
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
      alert("Opcao invalida. Informe o numero exibido na lista.");
      return null;
    }
    return candidates[index].id;
  }

  function incrementItemPicker(comandaId) {
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    const itemId = pickComandaItemByPrompt(comanda, "increment");
    if (!itemId) return;
    incrementItem(comandaId, itemId);
  }

  function cancelItemPicker(comandaId) {
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    const itemId = pickComandaItemByPrompt(comanda, "cancel");
    if (!itemId) return;
    cancelItem(comandaId, itemId);
  }

  function setKitchenItemStatus(comandaId, itemId, status) {
    const actor = currentActor();
    if (actor.role !== "cook" && actor.role !== "admin") {
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
      state.cookHistory = state.cookHistory || [];
      state.cookHistory.unshift({
        id: `KHS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        deliveredAt: item.deliveredAt,
        updatedAt: item.kitchenStatusAt,
        comandaId: comanda.id,
        table: comanda.table,
        customer: comanda.customer || "",
        itemId: item.id,
        itemName: item.name,
        qty: item.qty,
        status: status,
        cookId: actor.id,
        cookName: actor.name,
        deliveryRequested: Boolean(item.deliveryRequested),
        deliveryRecipient: item.deliveryRecipient || "",
        deliveryLocation: item.deliveryLocation || ""
      });
    }

    appendComandaEvent(comanda, {
      actor,
      type: "cozinha_status",
      detail: `Pedido ${item.name} da comanda ${comanda.id} atualizado para ${kitchenStatusLabel(status)}.`,
      itemId: item.id
    });

    if (status === "entregue" && comanda.isQuickKitchenSale) {
      const hasPendingKitchenItems = (comanda.items || []).some((i) => itemNeedsKitchen(i) && !i.canceled && !i.delivered);
      if (!hasPendingKitchenItems) {
        comanda.status = "finalizada";
        comanda.closedAt = isoNow();
        comanda.kitchenAlertUnread = false;
        appendComandaEvent(comanda, {
          actor,
          type: "comanda_finalizada_auto",
          detail: `Comanda avulsa ${comanda.id} finalizada automaticamente apos entrega da cozinha.`
        });
        state.openComandas = state.openComandas.filter((c) => c.id !== comanda.id);
        state.closedComandas.unshift(comanda);
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
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.delivered || item.canceled) return;
    if (itemNeedsKitchen(item)) {
      setKitchenItemStatus(comandaId, itemId, "entregue");
      return;
    }

    item.delivered = true;
    item.deliveredAt = isoNow();

    appendComandaEvent(comanda, {
      actor,
      type: "item_entregue",
      detail: `Item ${item.name} marcado como entregue.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function cancelItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.canceled) return;

    const reasonPrompt = `Motivo da devolucao/cancelamento:\n${CANCEL_REASONS.join(" | ")}`;
    const reason = prompt(reasonPrompt, "Desistencia de pedido");
    if (reason === null) return;
    const note = prompt("Observacao adicional (opcional):", "") || "";

    item.canceled = true;
    item.canceledAt = isoNow();
    item.cancelReason = reason;
    item.cancelNote = note;
    item.kitchenAlertUnread = false;

    const product = state.products.find((p) => p.id === item.productId);
    if (product) {
      product.stock += Number(item.qty || 0);
    }

    appendComandaEvent(comanda, {
      actor,
      type: "item_cancelado",
      detail: `Item ${item.name} cancelado/devolvido e estoque ajustado.`,
      reason,
      itemId: item.id
    });

    comanda.kitchenAlertUnread = kitchenAlertCount(comanda) > 0;

    saveState();
    render();
  }

  function addComandaNote(comandaId) {
    const actor = currentActor();
    const comanda = findOpenComanda(comandaId);
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

  function toggleFinalize(comandaId) {
    uiState.finalizeOpenByComanda[comandaId] = !uiState.finalizeOpenByComanda[comandaId];
    const comanda = findOpenComanda(comandaId);
    if (uiState.finalizeOpenByComanda[comandaId] && comanda && !comanda.pixCodeDraft) {
      comanda.pixCodeDraft = generatePixCode();
      saveState();
    }
    render();
  }

  function finalizeComanda(form) {
    const actor = currentActor();
    const comandaId = form.dataset.comandaId;
    const comanda = findOpenComanda(comandaId);
    if (!comanda) {
      alert("Comanda nao encontrada.");
      return;
    }

    const paymentMethod = form.paymentMethod.value;
    const manualCheck = form.manualCheck.checked;
    const fiadoCustomer = form.fiadoCustomer.value.trim();
    const total = comandaTotal(comanda);

    if (!manualCheck) {
      alert("Confirme manualmente o pagamento antes de finalizar.");
      return;
    }

    if (paymentMethod === "fiado" && !fiadoCustomer) {
      alert("No fiado, o nome do cliente e obrigatorio.");
      return;
    }

    if (!comanda.items.some((item) => !item.canceled)) {
      if (!confirm("Comanda sem itens validos. Finalizar mesmo assim?")) return;
    }

    if (paymentMethod === "pix" && !comanda.pixCodeDraft) {
      comanda.pixCodeDraft = generatePixCode();
    }

    comanda.status = "finalizada";
    comanda.closedAt = isoNow();
    comanda.payment = {
      method: paymentMethod,
      methodLabel: paymentLabel(paymentMethod),
      verifiedAt: isoNow(),
      customerName: paymentMethod === "fiado" ? fiadoCustomer : comanda.customer || "",
      pixCode: paymentMethod === "pix" ? comanda.pixCodeDraft : ""
    };

    if (paymentMethod === "fiado") {
      state.payables.push({
        id: `PG-${String(state.seq.payable++).padStart(5, "0")}`,
        comandaId: comanda.id,
        customerName: fiadoCustomer,
        total,
        status: "pendente",
        createdAt: isoNow(),
        paidAt: null,
        paidMethod: null
      });
    }

    appendComandaEvent(comanda, {
      actor,
      type: "comanda_finalizada",
      detail: `Comanda finalizada em ${paymentLabel(paymentMethod)} no valor ${money(total)}.`
    });

    state.openComandas = state.openComandas.filter((c) => c.id !== comanda.id);
    state.closedComandas.unshift(comanda);

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

    const method = select.value;
    const fiadoBox = form.querySelector('[data-role="fiado-box"]');
    const pixBox = form.querySelector('[data-role="pix-box"]');

    if (fiadoBox) fiadoBox.style.display = method === "fiado" ? "grid" : "none";
    if (pixBox) pixBox.style.display = method === "pix" ? "grid" : "none";

    if (method === "pix") {
      const comandaId = form.dataset.comandaId;
      const comanda = findOpenComanda(comandaId);
      if (!comanda) return;
      if (!comanda.pixCodeDraft) {
        comanda.pixCodeDraft = generatePixCode();
        saveState();
      }

      const codeEl = form.querySelector('[data-role="pix-code"]');
      const canvas = form.querySelector('[data-role="pix-canvas"]');
      if (codeEl) codeEl.textContent = comanda.pixCodeDraft;
      if (canvas) drawPseudoQr(canvas, comanda.pixCodeDraft);
    }
  }

  function printComanda(comandaId) {
    const comanda = findAnyComanda(comandaId);
    if (!comanda) return;

    const lines = (comanda.items || [])
      .map((i) => `${i.name} x${i.qty}  ${money(i.priceAtSale)}${i.canceled ? " (cancelado)" : ""}`)
      .join("<br>");

    const popup = window.open("", "_blank", "width=420,height=700");
    if (!popup) {
      alert("Permita pop-up para imprimir o cupom.");
      return;
    }

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
            <p>Pagamento: ${esc(paymentLabel(comanda.payment?.method || "nao finalizada"))}</p>
            <p>Observacoes: ${(comanda.notes || []).map((n) => esc(n)).join(" | ") || "-"}</p>
            <hr>
            <p>Pronto para impressora de cupom.</p>
          </div>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => {
      popup.focus();
      popup.print();
    }, 300);
  }

  function closeCash(form) {
    const actor = currentActor();
    const loginValue = form.login.value.trim();
    const password = form.password.value;
    const secondAuth = state.users.find((u) => u.role === "admin" && u.login === loginValue && u.password === password);

    if (!secondAuth) {
      alert("Segunda autenticacao invalida.");
      return;
    }

    if (!confirm("Confirmar fechamento do caixa? Comandas do dia serao movidas para historico e dados operacionais limpos.")) {
      return;
    }

    const closedAt = isoNow();
    const rolloverOpen = state.openComandas.map((c) => ({
      ...c,
      status: "encerrada-no-fechamento",
      closedAt
    }));

    const allDayComandas = [...state.closedComandas, ...rolloverOpen];
    const closure = {
      id: `HIST-${Date.now()}`,
      cashId: state.cash.id,
      openedAt: state.cash.openedAt,
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
          detail: `Caixa ${state.cash.id} fechado com segunda autenticacao.`,
          comandaId: null,
          itemId: null,
          reason: ""
        },
        ...state.auditLog
      ],
      summary: buildCashSummary(allDayComandas)
    };

    state.history90.unshift(closure);
    pruneHistory(state);

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
    alert("Caixa fechado com sucesso. Historico mantido por 90 dias.");
    render();
  }

  function validateAdminCredentials(loginValue, password) {
    return state.users.find((u) => u.role === "admin" && u.active && u.login === loginValue && u.password === password) || null;
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
      if (role === "waiter") uiState.waiterTab = tab;
      if (role === "cook") uiState.cookTab = tab;
      render();
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

    if (action === "clear-products") {
      clearAllProducts();
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

    if (action === "receive-payable") {
      receivePayable(button.dataset.id);
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

    if (action === "increment-item") {
      incrementItem(button.dataset.comandaId, button.dataset.itemId);
      return;
    }

    if (action === "cancel-item") {
      cancelItem(button.dataset.comandaId, button.dataset.itemId);
      return;
    }

    if (action === "increment-item-picker") {
      incrementItemPicker(button.dataset.comandaId);
      return;
    }

    if (action === "cancel-item-picker") {
      cancelItemPicker(button.dataset.comandaId);
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

    if (action === "open-comanda-details") {
      uiState.comandaDetailsId = button.dataset.comandaId;
      render();
      return;
    }

      if (action === "close-comanda-details") {
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
        login(form.login.value.trim(), form.password.value);
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

      if (target.matches('[data-role="cook-search"]')) {
        uiState.cookSearch = target.value || "";
        render();
      }
    } catch (err) {
      reportUiRuntimeError("change", err);
      render();
    }
  });

  app.addEventListener("input", (event) => {
    try {
      const target = event.target;
      if (target.matches('[data-role="waiter-catalog-search"]')) {
        uiState.waiterCatalogSearch = target.value || "";
        render();
      }
    } catch (err) {
      reportUiRuntimeError("input", err);
      render();
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      const localUpdated = new Date(state.meta?.updatedAt || 0).getTime();
      const incomingUpdated = new Date(incoming?.meta?.updatedAt || 0).getTime();
      if (Number.isFinite(localUpdated) && Number.isFinite(incomingUpdated) && incomingUpdated < localUpdated) {
        return;
      }
      adoptIncomingState(incoming);
      render();
    } catch (_err) {}
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    uiState.deferredPrompt = event;
    render();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
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
    if (user?.role === "admin" && uiState.adminTab === "monitor") {
      render();
    }
  }, 5000);

  setInterval(() => {
    void pullStateFromSupabase();
  }, 12000);

  void connectSupabase();
  render();
})();
