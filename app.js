
"use strict";

(() => {
  const STORAGE_KEY = "restobar_control_v1";
  const SESSION_KEY = "restobar_local_session_user";
  const ESTABLISHMENT_NAME = "Brancao (Lanches, hamburgueres e petiscos)";
  const BRAND_LOGO = "./brand-logo.png";
  const CATEGORIES = ["Bar", "Cozinha", "Espetinhos", "Avulsos"];
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
    adminTab: "dashboard",
    waiterTab: "home",
    cookTab: "ativos",
    finalizeOpenByComanda: {},
    deferredPrompt: null,
    monitorWaiterId: "all",
    comandaDetailsId: null,
    comandaDetailsSource: "closed",
    waiterComandaSearch: "",
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
      { name: "Cerveja Long Neck", category: "Bar", price: randomPrice(9, 15), stock: randomInt(20, 80), prepTime: 0, cost: randomPrice(5, 8) },
      { name: "Caipirinha", category: "Bar", price: randomPrice(14, 22), stock: randomInt(20, 50), prepTime: 3, cost: randomPrice(6, 10) },
      { name: "Refrigerante Lata", category: "Bar", price: randomPrice(5, 8), stock: randomInt(40, 120), prepTime: 0, cost: randomPrice(2.8, 4.5) },
      { name: "Batata Frita", category: "Cozinha", price: randomPrice(22, 34), stock: randomInt(15, 50), prepTime: randomInt(12, 18), cost: randomPrice(8, 14) },
      { name: "Tilapia Empanada", category: "Cozinha", price: randomPrice(35, 48), stock: randomInt(10, 30), prepTime: randomInt(18, 28), cost: randomPrice(15, 22) },
      { name: "Picanha na Chapa", category: "Cozinha", price: randomPrice(59, 78), stock: randomInt(8, 24), prepTime: randomInt(22, 32), cost: randomPrice(30, 44) },
      { name: "Espetinho de Frango", category: "Espetinhos", price: randomPrice(9, 14), stock: randomInt(30, 120), prepTime: randomInt(7, 12), cost: randomPrice(4.2, 6.7) },
      { name: "Espetinho de Carne", category: "Espetinhos", price: randomPrice(11, 17), stock: randomInt(30, 100), prepTime: randomInt(7, 12), cost: randomPrice(5.8, 8.8) },
      { name: "Pao de Alho", category: "Espetinhos", price: randomPrice(8, 12), stock: randomInt(35, 110), prepTime: randomInt(4, 8), cost: randomPrice(3, 5) },
      { name: "Molho Especial", category: "Avulsos", price: randomPrice(3, 6), stock: randomInt(50, 200), prepTime: 0, cost: randomPrice(0.8, 2.1) },
      { name: "Queijo Coalho", category: "Avulsos", price: randomPrice(6, 11), stock: randomInt(30, 100), prepTime: randomInt(3, 6), cost: randomPrice(2.7, 4.8) },
      { name: "Farofa da Casa", category: "Avulsos", price: randomPrice(4, 8), stock: randomInt(30, 90), prepTime: 0, cost: randomPrice(1.2, 2.9) }
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

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const first = initialState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(first));
      return first;
    }

    try {
      const parsed = JSON.parse(raw);
      const fallback = initialState();
      const merged = {
        ...fallback,
        ...parsed,
        users: parsed.users || fallback.users,
        products: parsed.products || fallback.products,
        openComandas: parsed.openComandas || [],
        closedComandas: parsed.closedComandas || [],
        cookHistory: parsed.cookHistory || [],
        payables: parsed.payables || [],
        auditLog: parsed.auditLog || [],
        history90: parsed.history90 || [],
        seq: { ...fallback.seq, ...(parsed.seq || {}) },
        meta: { ...fallback.meta, ...(parsed.meta || {}) },
        session: { userId: parsed.session?.userId || null }
      };

      if (!merged.users.find((u) => u.role === "admin" && u.login === "admin")) {
        merged.users.push({ id: merged.seq.user++, role: "admin", name: "Administrador", functionName: "Administrador", login: "admin", password: "admin", active: true });
      }
      if (!merged.users.find((u) => u.role === "waiter" && u.login === "user")) {
        merged.users.push({ id: merged.seq.user++, role: "waiter", name: "Garcom Teste", functionName: "Garcom", login: "user", password: "user", active: true });
      }
      if (!merged.users.find((u) => u.role === "cook" && u.login === "cook")) {
        merged.users.push({ id: merged.seq.user++, role: "cook", name: "Cozinheiro Teste", functionName: "Cozinheiro", login: "cook", password: "cook", active: true });
      }

      pruneHistory(merged);
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
        const currentSession = sessionUserId;
        const fallback = initialState();
        state = data.payload;
        state.users = state.users || fallback.users;
        state.products = state.products || fallback.products;
        state.openComandas = state.openComandas || [];
        state.closedComandas = state.closedComandas || [];
        state.cookHistory = state.cookHistory || [];
        state.payables = state.payables || [];
        state.auditLog = state.auditLog || [];
        state.history90 = state.history90 || [];
        state.seq = { ...fallback.seq, ...(state.seq || {}) };
        state.meta = { ...fallback.meta, ...(state.meta || {}) };
        state.session = { userId: null };
        sessionUserId = currentSession;
        persistSessionUserId(sessionUserId);
        if (!state.users.find((u) => u.role === "admin" && u.login === "admin")) {
          state.users.push({ id: state.seq.user++, role: "admin", name: "Administrador", functionName: "Administrador", login: "admin", password: "admin", active: true });
        }
        if (!state.users.find((u) => u.role === "waiter" && u.login === "user")) {
          state.users.push({ id: state.seq.user++, role: "waiter", name: "Garcom Teste", functionName: "Garcom", login: "user", password: "user", active: true });
        }
        if (!state.users.find((u) => u.role === "cook" && u.login === "cook")) {
          state.users.push({ id: state.seq.user++, role: "cook", name: "Cozinheiro Teste", functionName: "Cozinheiro", login: "cook", password: "cook", active: true });
        }
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

  function listPendingKitchenItems() {
    const rows = [];
    for (const comanda of state.openComandas) {
      for (const item of comanda.items || []) {
        if (item.category === "Cozinha" && !item.canceled && !item.delivered) {
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
          <img class="brand-logo" src="${BRAND_LOGO}" alt="Logo ${esc(ESTABLISHMENT_NAME)}" />
          <div>
          <h2>${esc(ESTABLISHMENT_NAME)}</h2>
          <p class="user">Usuario: ${esc(user.name)} (${esc(roleLabel(user.role))}) | Caixa atual: ${esc(state.cash.id)}</p>
          <p class="note"><span class="status-dot ${statusClass}"></span>Supabase: ${esc(uiState.supabaseStatus)}${esc(statusMsg)}</p>
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
      <div class="tabs">
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
            <img class="brand-logo" src="${BRAND_LOGO}" alt="Logo ${esc(ESTABLISHMENT_NAME)}" />
            <h2>${esc(ESTABLISHMENT_NAME)}</h2>
          </div>
          <p class="note">Acesso inicial: admin/admin, user/user e cook/cook</p>
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

  function renderProductsByCategory(category) {
    const products = state.products.filter((p) => p.category === category);
    if (!products.length) {
      return `<div class="empty">Sem produtos cadastrados em ${esc(category)}.</div>`;
    }

    return `
      <div class="table-wrap">
        <table>
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
          <tbody>
            ${products
              .map(
                (p) => `
              <tr>
                <td>${esc(p.name)}</td>
                <td>${money(p.price)}</td>
                <td>${Number(p.stock)}</td>
                <td>${Number(p.prepTime || 0)}</td>
                <td>${money(p.cost || 0)}</td>
                <td>
                  <div class="actions">
                    <button class="btn secondary" data-action="edit-product" data-id="${p.id}">Editar</button>
                    <button class="btn danger" data-action="delete-product" data-id="${p.id}">Apagar</button>
                  </div>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
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
          <p class="note">Administrador pode adicionar, apagar e alterar preco/produto por categoria.</p>
          <div class="actions" style="margin-top:0.75rem;">
            ${CATEGORIES.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}
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
                      <td>${esc(p.category)}</td>
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
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Criado em</th><th>Acoes</th></tr></thead><tbody>${pending
                .map(
                  (p) => `<tr><td>${esc(p.comandaId)}</td><td>${esc(p.customerName)}</td><td>${money(p.total)}</td><td>${formatDateTime(p.createdAt)}</td><td><button class="btn ok" data-action="receive-payable" data-id="${p.id}">Marcar Pago</button></td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Nenhum fiado pendente.</div>`}
        </div>
        <div class="card">
          <h3>Fiados Pagos</h3>
          ${paid.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Pago em</th><th>Metodo</th></tr></thead><tbody>${paid
                .map(
                  (p) => `<tr><td>${esc(p.comandaId)}</td><td>${esc(p.customerName)}</td><td>${money(p.total)}</td><td>${formatDateTime(p.paidAt)}</td><td>${esc(paymentLabel(p.paidMethod || ""))}</td></tr>`
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
                        `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td><input name="price-${p.id}" value="${Number(p.price || 0).toFixed(2)}" /></td><td>${Number(p.stock || 0)}</td><td><input type="number" min="0" name="stock-${p.id}" value="${Number(p.stock || 0)}" /></td><td>${money(p.cost || 0)}</td><td><input name="cost-${p.id}" value="${Number(p.cost || 0).toFixed(2)}" /></td></tr>`
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
            item.category === "Cozinha" && !item.canceled ? esc(kitchenStatusLabel(item.kitchenStatus || "fila")) : item.canceled ? "Cancelado" : item.delivered ? "Entregue" : "Pendente"
          }</td><td>${esc(item.waiterNote || "-")}</td></tr>`
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

  function renderAdminHistory() {
    const currentAudit = state.auditLog.slice(0, 250);
    const closures = state.history90;

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Historico Imutavel (Dia Atual)</h3>
          <p class="note">Alteracoes de funcionarios e admin registradas para conferencia.</p>
          ${currentAudit.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th><th>Abrir</th></tr></thead><tbody>${currentAudit
                .map(
                  (e) =>
                    `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)} (${esc(e.actorRole)})</td><td>${esc(e.type)}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail)}</td><td>${
                      e.comandaId ? `<button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${e.comandaId}">Ver</button>` : "-"
                    }</td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem eventos registrados ainda.</div>`}
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
    const employeeIds = new Set(employees.map((w) => String(w.id)));
    const allEvents = [...uiState.remoteMonitorEvents, ...state.auditLog]
      .filter((event) => event.actorRole === "waiter" || event.actorRole === "cook")
      .sort((a, b) => new Date(b.ts || b.broadcastAt) - new Date(a.ts || a.broadcastAt));
    const filteredEvents = allEvents.filter((event) => {
      if (selected === "all") return true;
      return String(event.actorId) === String(selected);
    });
    const openComandas = state.openComandas.filter((comanda) => {
      if (selected === "all") return true;
      return String(comanda.createdBy) === String(selected) || (comanda.events || []).some((e) => String(e.actorId) === String(selected));
    }).filter((comanda) => matchesComandaSearch(comanda, uiState.adminComandaSearch));

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Monitor em Tempo Real</h3>
          <p class="note">Acompanhe comandas abertas e alteracoes feitas por garcons e cozinheiros.</p>
          <div class="field" style="margin-top:0.75rem;">
            <label>Filtrar funcionario</label>
            <select data-action="monitor-filter" data-role="monitor-filter">
              <option value="all" ${selected === "all" ? "selected" : ""}>Todos</option>
              ${employees
                .map((w) => `<option value="${w.id}" ${String(w.id) === String(selected) ? "selected" : ""}>${esc(w.name)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field" style="margin-top:0.5rem;">
            <label>Busca por comanda</label>
            <input data-role="admin-search" value="${esc(uiState.adminComandaSearch)}" placeholder="Mesa/referencia/comanda/cliente" />
          </div>
          ${openComandas.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Mesa</th><th>Cliente</th><th>Total</th><th>Abrir</th></tr></thead><tbody>${openComandas
                .map(
                  (c) =>
                    `<tr><td>${esc(c.id)}</td><td>${esc(c.table)}</td><td>${esc(c.customer || "-")}</td><td>${money(comandaTotal(c))}</td><td><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem comandas abertas para o filtro escolhido.</div>`}
          ${renderComandaDetailsBox()}
        </div>
        <div class="card">
          <h3>Feed de Alteracoes</h3>
          <p class="note">Eventos locais + broadcast Supabase.</p>
          ${filteredEvents.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Data</th><th>Funcionario</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${filteredEvents
                .filter((e) => selected === "all" || String(e.actorId) === String(selected) || !employeeIds.has(String(selected)))
                .slice(0, 300)
                .map(
                  (e) =>
                    `<tr><td>${formatDateTime(e.ts || e.broadcastAt)}</td><td>${esc(e.actorName || "-")}</td><td>${esc(e.type || "-")}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail || "-")}</td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem eventos para o filtro atual.</div>`}
        </div>
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
      <div class="container">
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
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Abrir Pedido/Comanda</h3>
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
        <div class="card">
          <h3>Resumo rapido</h3>
          <div class="kpis" style="margin-top:0.75rem;">
            <div class="kpi"><p>Abertas</p><b>${state.openComandas.length}</b></div>
            <div class="kpi"><p>Fila Cozinha</p><b>${listPendingKitchenItems().length}</b></div>
            <div class="kpi"><p>Fechadas hoje</p><b>${state.closedComandas.length}</b></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQuickSale(roleContext) {
    const title = roleContext === "admin" ? "Venda Avulsa (Admin)" : roleContext === "waiter" ? "Venda Avulsa (Garcom)" : "Venda Avulsa";
    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>${title}</h3>
          <p class="note">Venda rapida sem abrir comanda completa. Registra estoque, financeiro e historico.</p>
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
              <label>Observacao (opcional)</label>
              <input name="note" placeholder="Ex: consumo no balcao" />
            </div>
            <div class="field">
              <label><input name="paidConfirm" type="checkbox" /> Venda paga e conferida</label>
            </div>
            <button class="btn primary" type="submit">Finalizar Venda Avulsa</button>
          </form>
        </div>
        <div class="card">
          <h3>Regras</h3>
          <ul>
            <li>Exige apenas produto, quantidade e pagamento confirmado.</li>
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
    if (!item.delivered && !item.canceled && item.category === "Cozinha") {
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
        ${item.canceled ? `<div class="note">Cancelamento: ${esc(item.cancelReason || "-")} ${item.cancelNote ? `| ${esc(item.cancelNote)}` : ""}</div>` : ""}
        <div class="actions">
          ${flags.join(" ")}
          ${!item.canceled ? `<button class="btn secondary" data-action="increment-item" data-comanda-id="${comanda.id}" data-item-id="${item.id}">+1 igual</button>` : ""}
          ${!item.canceled ? `<button class="btn danger" data-action="cancel-item" data-comanda-id="${comanda.id}" data-item-id="${item.id}">Devolucao/Cancelar</button>` : ""}
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

  function renderComandaCard(comanda) {
    const total = comandaTotal(comanda);
    const isFinalizeOpen = Boolean(uiState.finalizeOpenByComanda[comanda.id]);
    const alertCount = kitchenAlertCount(comanda);

    return `
      <div class="comanda-card">
        <div>
          <h3>${esc(comanda.id)} <span class="tag">Mesa: ${esc(comanda.table)}</span> ${alertCount ? `<span class="tag" style="border-color:#fecaca;background:#fff1f2;color:#b91c1c;">Alerta cozinha: ${alertCount}</span>` : ""}</h3>
          <p class="note">Cliente: ${esc(comanda.customer || "Nao informado")} | Aberta em ${formatDateTime(comanda.createdAt)}</p>
          <p class="note">Total atual: <b>${money(total)}</b></p>
        </div>

        ${comanda.notes?.length ? `<div class="note">Obs da comanda: ${comanda.notes.map((n) => esc(n)).join(" | ")}</div>` : ""}

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
          <div class="note" data-role="kitchen-estimate">Tempo estimado cozinha: -</div>
          <button class="btn secondary" type="submit">Adicionar ao pedido</button>
        </form>

        <div class="actions">
          <button class="btn ${alertCount ? "danger" : "secondary"}" data-action="open-comanda-alert" data-comanda-id="${comanda.id}">${alertCount ? "Abrir comanda (limpar alerta)" : "Abrir comanda"}</button>
          <button class="btn secondary" data-action="add-comanda-note" data-comanda-id="${comanda.id}">Adicionar observacao</button>
          <button class="btn secondary" data-action="print-comanda" data-comanda-id="${comanda.id}">Imprimir cupom</button>
          <button class="btn primary" data-action="toggle-finalize" data-comanda-id="${comanda.id}">${isFinalizeOpen ? "Fechar painel" : "Finalizar comanda"}</button>
        </div>

        ${isFinalizeOpen ? renderFinalizePanel(comanda) : ""}
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
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Produto</th><th>Qtd</th><th>Status Cozinha</th><th>Tempo restante</th><th>Mesa/ref</th></tr></thead><tbody>${queue
                .map(
                  (r) => `<tr><td>${esc(r.comanda.id)}</td><td>${esc(r.item.name)}</td><td>${r.item.qty}</td><td><span class="tag">${esc(kitchenStatusLabel(r.item.kitchenStatus || "fila"))}</span></td><td>${Math.ceil(r.remainingMs / 60000)} min</td><td>${esc(r.comanda.table)}</td></tr>`
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

  function renderWaiterHistory() {
    const todayAudit = state.auditLog.slice(0, 250);
    const closed = allFinalizedComandasForFinance().sort((a, b) => new Date(b.closedAt || 0) - new Date(a.closedAt || 0)).slice(0, 150);

    return `
      <div class="grid cols-2">
        <div class="card">
          <h3>Historico de Alteracoes (imutavel)</h3>
          ${todayAudit.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Data</th><th>Ator</th><th>Tipo</th><th>Comanda</th><th>Detalhe</th></tr></thead><tbody>${todayAudit
                .map(
                  (e) => `<tr><td>${formatDateTime(e.ts)}</td><td>${esc(e.actorName)}</td><td>${esc(e.type)}</td><td>${esc(e.comandaId || "-")}</td><td>${esc(e.detail)}</td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Sem eventos ainda.</div>`}
        </div>
        <div class="card">
          <h3>Comandas Finalizadas Hoje</h3>
          ${closed.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Fechada em</th><th>Abrir</th></tr></thead><tbody>${closed
                .map(
                  (c) =>
                    `<tr><td>${esc(c.id)}</td><td>${esc(c.customer || "-")}</td><td>${money(comandaTotal(c))}</td><td>${esc(paymentLabel(c.payment?.method || "-"))}</td><td>${formatDateTime(c.closedAt)}</td><td><button class="btn secondary" data-action="open-comanda-details" data-comanda-id="${c.id}">Ver</button></td></tr>`
                )
                .join("")}</tbody></table></div>`
            : `<div class="empty" style="margin-top:0.75rem;">Ainda sem comandas finalizadas.</div>`}
          ${renderComandaDetailsBox()}
        </div>
      </div>
    `;
  }

  function listActiveKitchenOrders() {
    const rows = [];
    for (const comanda of state.openComandas) {
      for (const item of comanda.items || []) {
        if (item.category === "Cozinha" && !item.canceled && !item.delivered) {
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
          <div class="field" style="margin-top:0.75rem;">
            <label>Busca por comanda</label>
            <input data-role="cook-search" value="${esc(uiState.cookSearch)}" placeholder="Mesa/referencia/comanda/cliente" />
          </div>
          ${rows.length
            ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Comanda</th><th>Mesa/ref</th><th>Cliente</th><th>Produto</th><th>Qtd</th><th>Status</th><th>Acao</th></tr></thead><tbody>${rows
                .map(
                  (row) =>
                    `<tr><td>${esc(row.comanda.id)}</td><td>${esc(row.comanda.table)}</td><td>${esc(row.comanda.customer || "-")}</td><td>${esc(row.item.name)}</td><td>${row.item.qty}</td><td><span class="tag">${esc(kitchenStatusLabel(row.item.kitchenStatus || "fila"))}</span></td><td><div class="actions"><button class="btn secondary" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="cozinhando">Cozinhando</button><button class="btn danger" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="em_falta">Em falta</button><button class="btn ok" data-action="cook-status" data-comanda-id="${row.comanda.id}" data-item-id="${row.item.id}" data-status="entregue">Entregue</button></div></td></tr>`
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
        ${rows.length
          ? `<div class="table-wrap" style="margin-top:0.75rem;"><table><thead><tr><th>Data</th><th>Comanda</th><th>Mesa/ref</th><th>Produto</th><th>Qtd</th><th>Status final</th><th>Cozinheiro</th></tr></thead><tbody>${rows
              .map(
                (row) =>
                  `<tr><td>${formatDateTime(row.deliveredAt || row.updatedAt)}</td><td>${esc(row.comandaId)}</td><td>${esc(row.table || "-")}</td><td>${esc(row.itemName)}</td><td>${row.qty}</td><td>${esc(kitchenStatusLabel(row.status || "entregue"))}</td><td>${esc(row.cookName || "-")}</td></tr>`
              )
              .join("")}</tbody></table></div>`
          : `<div class="empty" style="margin-top:0.75rem;">Sem pedidos entregues pela cozinha neste caixa.</div>`}
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
      <div class="container">
        ${renderInstallBanner()}
        ${renderTopBar(user)}
        ${renderTabs("cook", tabs, uiState.cookTab)}
        ${content}
      </div>
    `;
  }

  function renderWaiter(user) {
    const tabs = [
      { key: "home", label: "Inicio" },
      { key: "abrir", label: "Abrir pedido/comanda" },
      { key: "abertas", label: "Comandas abertas" },
      { key: "avulsa", label: "Venda Avulsa" },
      { key: "cozinha", label: "Fila cozinha" },
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
      case "historico":
        content = renderWaiterHistory();
        break;
      default:
        content = renderWaiterHome();
    }

    app.innerHTML = `
      <div class="container">
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
    });

    document.querySelectorAll('[data-role="payment-method"]').forEach((select) => {
      toggleFinalizeView(select);
    });

    document.querySelectorAll('form[data-role="quick-sale-form"]').forEach((form) => {
      fillQuickSaleProductSelect(form);
    });
  }

  function fillProductSelect(selectElement, category) {
    if (!selectElement) return;
    const options = state.products.filter((p) => p.category === category);

    if (!options.length) {
      selectElement.innerHTML = `<option value="">Sem produtos</option>`;
      return;
    }

    selectElement.innerHTML = options
      .map((p) => `<option value="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${esc(p.name)} | ${money(p.price)} | estoque ${p.stock}</option>`)
      .join("");

    const firstAvailable = options.find((p) => p.stock > 0);
    if (firstAvailable) {
      selectElement.value = String(firstAvailable.id);
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
      .map((p) => `<option value="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${esc(p.name)} | ${money(p.price)} | estoque ${p.stock}</option>`)
      .join("");
    const firstAvailable = options.find((p) => p.stock > 0);
    if (firstAvailable) {
      selectElement.value = String(firstAvailable.id);
    }
  }

  function updateKitchenEstimate(form) {
    const info = form.querySelector('[data-role="kitchen-estimate"]');
    if (!info) return;

    const category = form.querySelector('[data-role="item-category"]')?.value;
    const productId = Number(form.querySelector('[data-role="item-product"]')?.value || 0);
    const qty = Math.max(1, Number(form.querySelector('input[name="qty"]')?.value || 1));

    if (category !== "Cozinha") {
      info.textContent = "Tempo estimado cozinha: nao aplicavel para esta categoria.";
      return;
    }

    const product = state.products.find((p) => p.id === productId);
    if (!product) {
      info.textContent = "Tempo estimado cozinha: selecione um produto.";
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
    return (comanda.items || []).filter((item) => item.category === "Cozinha" && item.kitchenAlertUnread && !item.canceled).length;
  }

  function clearComandaKitchenAlerts(comandaId) {
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    for (const item of comanda.items || []) {
      if (item.category === "Cozinha") {
        item.kitchenAlertUnread = false;
      }
    }
    comanda.kitchenAlertUnread = false;
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
    saveState({ skipCloud: true, touchMeta: false });
    render();
  }

  function createProduct(form) {
    const actor = currentActor();
    const name = form.name.value.trim();
    const category = form.category.value;
    const price = parseNumber(form.price.value);
    const stock = Math.max(0, Number(form.stock.value || 0));
    const prepTime = Math.max(0, Number(form.prepTime.value || 0));
    const cost = Math.max(0, parseNumber(form.cost.value));

    if (!name || !CATEGORIES.includes(category) || price <= 0) {
      alert("Preencha nome, categoria e preco valido.");
      return;
    }

    state.products.push({ id: state.seq.product++, name, category, price, stock, prepTime, cost });
    appendAudit({ actor, type: "produto_add", detail: `Produto ${name} criado em ${category}.` });
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

    p.name = name.trim() || p.name;
    p.price = Math.max(0, parseNumber(price));
    p.stock = Math.max(0, Number(stock));
    p.prepTime = Math.max(0, Number(prepTime));
    p.cost = Math.max(0, parseNumber(cost));

    appendAudit({ actor, type: "produto_edit", detail: `Produto ${p.name} alterado.` });
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

    uiState.waiterTab = "abertas";
    saveState();
    render();
  }

  function createQuickSale(form) {
    const actor = currentActor();
    const category = form.category.value;
    const productId = Number(form.productId.value || 0);
    const qty = Math.max(1, Number(form.qty.value || 1));
    const paymentMethod = form.paymentMethod.value;
    const note = form.note.value.trim();
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
    if (product.stock < qty) {
      alert(`Estoque insuficiente para ${product.name}. Disponivel: ${product.stock}`);
      return;
    }

    product.stock -= qty;

    const saleComanda = {
      id: `AV-${String(state.seq.sale++).padStart(5, "0")}`,
      table: "Venda Avulsa",
      customer: "",
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
        customerName: "",
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

    const product = state.products.find((p) => p.id === productId);
    if (!product) {
      alert("Produto invalido.");
      return;
    }

    if (product.stock < qty) {
      alert(`Estoque insuficiente para ${product.name}. Disponivel: ${product.stock}`);
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
      waiterNote,
      noteType: "",
      createdAt: isoNow(),
      delivered: false,
      deliveredAt: null,
      kitchenStatus: product.category === "Cozinha" ? "fila" : "",
      kitchenStatusAt: product.category === "Cozinha" ? isoNow() : null,
      kitchenStatusById: null,
      kitchenStatusByName: "",
      kitchenAlertUnread: false,
      canceled: false,
      canceledAt: null,
      cancelReason: "",
      cancelNote: ""
    };

    if (item.category === "Cozinha") {
      const prepMs = item.prepTimeAtSale * qty * 60 * 1000;
      item.etaAt = new Date(Date.now() + waitingBefore + prepMs).toISOString();
    }

    comanda.items.push(item);

    const kitchenInfo = item.category === "Cozinha" ? ` Tempo estimado: ${Math.ceil((waitingBefore + item.prepTimeAtSale * qty * 60000) / 60000)} min.` : "";
    appendComandaEvent(comanda, {
      actor,
      type: "item_add",
      detail: `Item ${item.name} x${qty} adicionado.${kitchenInfo}`,
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

  function setKitchenItemStatus(comandaId, itemId, status) {
    const actor = currentActor();
    if (actor.role !== "cook" && actor.role !== "admin") {
      alert("Apenas cozinheiro ou administrador podem alterar status da cozinha.");
      return;
    }
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;
    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.category !== "Cozinha" || item.canceled) return;

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
        cookName: actor.name
      });
    }

    appendComandaEvent(comanda, {
      actor,
      type: "cozinha_status",
      detail: `Pedido ${item.name} da comanda ${comanda.id} atualizado para ${kitchenStatusLabel(status)}.`,
      itemId: item.id
    });

    saveState();
    render();
  }

  function deliverItem(comandaId, itemId) {
    const actor = currentActor();
    const comanda = findOpenComanda(comandaId);
    if (!comanda) return;

    const item = (comanda.items || []).find((i) => i.id === itemId);
    if (!item || item.delivered || item.canceled) return;
    if (item.category === "Cozinha") {
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
            img { width: 120px; display: block; margin: 0 auto 8px; filter: grayscale(1) contrast(1.15); }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <img src="${BRAND_LOGO}" alt="Logo" />
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
  app.addEventListener("click", async (event) => {
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

    if (action === "add-comanda-note") {
      addComandaNote(button.dataset.comandaId);
      return;
    }

    if (action === "open-comanda-alert") {
      clearComandaKitchenAlerts(button.dataset.comandaId);
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
  });

  app.addEventListener("submit", (event) => {
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
  });

  app.addEventListener("change", (event) => {
    const target = event.target;

    if (target.matches('[data-role="item-category"]')) {
      const form = target.closest('form[data-role="add-item-form"]');
      const productSel = form.querySelector('[data-role="item-product"]');
      fillProductSelect(productSel, target.value);
      updateKitchenEstimate(form);
      return;
    }

    if (target.matches('[data-role="item-product"]') || target.name === "qty") {
      const form = target.closest('form[data-role="add-item-form"]');
      if (form) {
        updateKitchenEstimate(form);
      }
      return;
    }

    if (target.matches('[data-role="quick-category"]')) {
      const form = target.closest('form[data-role="quick-sale-form"]');
      if (form) fillQuickSaleProductSelect(form);
      return;
    }

    if (target.matches('[data-role="payment-method"]')) {
      toggleFinalizeView(target);
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

    if (target.matches('[data-role="admin-search"]')) {
      uiState.adminComandaSearch = target.value || "";
      render();
      return;
    }

    if (target.matches('[data-role="cook-search"]')) {
      uiState.cookSearch = target.value || "";
      render();
    }
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
