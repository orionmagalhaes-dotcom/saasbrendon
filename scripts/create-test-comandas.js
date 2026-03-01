"use strict";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fquiicsdvjqzrbeiuaxo.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";

const countArg = Number(process.argv[2] || 3);
const TEST_COMANDAS_COUNT = Number.isFinite(countArg) && countArg > 0 ? Math.floor(countArg) : 3;

function isoNow() {
  return new Date().toISOString();
}

function productNeedsKitchen(product) {
  if (!product) return false;
  if (product.category === "Cozinha") return true;
  return product.category === "Ofertas" && Boolean(product.requiresKitchen);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function fetchStateRow() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main&select=id,payload,updated_at`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Falha ao buscar estado: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data) || !data.length || !data[0]?.payload) {
    throw new Error("Estado 'main' nao encontrado no Supabase.");
  }
  return data[0];
}

async function updateStateRow(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      payload,
      updated_at: isoNow()
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao atualizar estado: HTTP ${response.status} ${text}`);
  }
  return response.json();
}

function nextEventId(state) {
  state.seq = state.seq || {};
  state.seq.event = Number(state.seq.event || 1);
  const id = `EV-${state.seq.event}`;
  state.seq.event += 1;
  return id;
}

function nextItemId(state) {
  state.seq = state.seq || {};
  state.seq.item = Number(state.seq.item || 1);
  const id = `IT-${String(state.seq.item).padStart(5, "0")}`;
  state.seq.item += 1;
  return id;
}

function collectComandaIds(state) {
  const ids = new Set();
  for (const c of Array.isArray(state.openComandas) ? state.openComandas : []) ids.add(String(c?.id || ""));
  for (const c of Array.isArray(state.closedComandas) ? state.closedComandas : []) ids.add(String(c?.id || ""));
  for (const closure of Array.isArray(state.history90) ? state.history90 : []) {
    for (const c of Array.isArray(closure?.commandas) ? closure.commandas : []) ids.add(String(c?.id || ""));
  }
  ids.delete("");
  return ids;
}

function nextComandaId(state, usedIds) {
  state.seq = state.seq || {};
  state.seq.comanda = Number(state.seq.comanda || 1);
  for (let guard = 0; guard < 20000; guard += 1) {
    const candidate = `CMD-${String(state.seq.comanda).padStart(4, "0")}`;
    state.seq.comanda += 1;
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
  throw new Error("Nao foi possivel gerar um novo ID de comanda.");
}

function pickActor(state) {
  const users = Array.isArray(state.users) ? state.users : [];
  const waiter = users.find((u) => u && u.active !== false && u.role === "waiter");
  if (waiter) return waiter;
  const admin = users.find((u) => u && u.active !== false && u.role === "admin");
  if (admin) return admin;
  return { id: 0, role: "system", name: "Sistema" };
}

function buildTestComandas(state, amount) {
  state.openComandas = Array.isArray(state.openComandas) ? state.openComandas : [];
  state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
  state.products = Array.isArray(state.products) ? state.products : [];

  const actor = pickActor(state);
  const products = state.products.filter((p) => p && p.available !== false && Number(p.stock || 0) > 0);
  if (!products.length) {
    throw new Error("Nao existem produtos disponiveis para criar comandas de teste.");
  }

  const usedIds = collectComandaIds(state);
  const created = [];
  for (let i = 0; i < amount; i += 1) {
    const comandaId = nextComandaId(state, usedIds);
    const createdAt = isoNow();
    const productA = products[i % products.length];
    const productB = products[(i + 3) % products.length];
    const picks = [productA, productB].filter(Boolean);

    const items = [];
    for (let idx = 0; idx < picks.length; idx += 1) {
      const product = picks[idx];
      const qty = Math.min(idx + 1, Math.max(1, Number(product.stock || 1)));
      if (qty <= 0) continue;

      product.stock = Math.max(0, Number(product.stock || 0) - qty);
      const needsKitchen = productNeedsKitchen(product);
      items.push({
        id: nextItemId(state),
        productId: product.id,
        name: product.name,
        category: product.category,
        qty,
        priceAtSale: Number(product.price || 0),
        costAtSale: Number(product.cost || 0),
        prepTimeAtSale: Number(product.prepTime || 0),
        requiresKitchen: Boolean(product.requiresKitchen),
        needsKitchen,
        waiterNote: "Teste automatizado",
        noteType: "",
        createdAt,
        delivered: false,
        deliveredAt: null,
        kitchenStatus: needsKitchen ? "fila" : "",
        kitchenStatusAt: needsKitchen ? createdAt : null,
        kitchenStatusById: null,
        kitchenStatusByName: "",
        kitchenPriority: needsKitchen ? "normal" : "",
        kitchenPriorityById: null,
        kitchenPriorityByName: "",
        kitchenPriorityAt: needsKitchen ? createdAt : null,
        kitchenReceivedAt: null,
        kitchenReceivedById: null,
        kitchenReceivedByName: "",
        kitchenAlertUnread: needsKitchen,
        waiterVisualState: "new",
        waiterVisualUpdatedAt: createdAt,
        deliveryRequested: false,
        deliveryRecipient: "",
        deliveryLocation: "",
        canceled: false,
        canceledAt: null,
        cancelReason: "",
        cancelNote: ""
      });
    }

    const kitchenAlertUnread = items.some((item) => item.needsKitchen && !item.canceled);
    const events = [];
    events.push({
      ts: createdAt,
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      type: "comanda_aberta",
      detail: `Comanda de teste ${comandaId} aberta.`,
      reason: "",
      itemId: null
    });
    for (const item of items) {
      events.push({
        ts: createdAt,
        actorId: actor.id,
        actorRole: actor.role,
        actorName: actor.name,
        type: "item_add",
        detail: `Item ${item.name} x${item.qty} adicionado na comanda de teste.`,
        reason: "teste automatizado",
        itemId: item.id
      });
    }

    const comanda = {
      id: comandaId,
      table: `TESTE-${String(i + 1).padStart(2, "0")}`,
      customer: `Cliente Teste ${i + 1}`,
      createdAt,
      createdBy: actor.id,
      status: "aberta",
      notes: ["Comanda de teste criada automaticamente"],
      items,
      events,
      payment: null,
      pixCodeDraft: null,
      kitchenAlertUnread
    };
    state.openComandas.push(comanda);
    created.push(comanda);

    for (const event of events) {
      state.auditLog.unshift({
        id: nextEventId(state),
        ts: event.ts,
        actorId: event.actorId,
        actorRole: event.actorRole,
        actorName: event.actorName,
        type: event.type,
        detail: event.detail,
        comandaId: comandaId,
        itemId: event.itemId || null,
        reason: event.reason || ""
      });
    }
  }

  state.auditLog = state.auditLog.slice(0, 5000);
  state.meta = state.meta || {};
  state.meta.updatedAt = isoNow();
  return created;
}

async function main() {
  const row = await fetchStateRow();
  const state = clone(row.payload || {});
  const created = buildTestComandas(state, TEST_COMANDAS_COUNT);
  await updateStateRow(state);
  const ids = created.map((c) => c.id).join(", ");
  console.log(`Comandas de teste criadas: ${created.length}`);
  console.log(`IDs: ${ids}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
