"use strict";

const process = require("process");

// Polyfill fetch for older Node.js if needed, or rely on global fetch in Node 18+
const fetch = global.fetch;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://fquiicsdvjqzrbeiuaxo.supabase.co";
const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";

function isoNow() {
    return new Date().toISOString();
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

async function updateStateRow(payload, expectedUpdatedAt = null) {
    const query = new URLSearchParams({ id: "eq.main" });
    if (expectedUpdatedAt) {
        query.set("updated_at", `eq.${expectedUpdatedAt}`);
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?${query.toString()}`, {
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
    const data = await response.json();
    if (expectedUpdatedAt && Array.isArray(data) && data.length === 0) {
        throw new Error("O estado remoto mudou durante a atualizacao. Execute o script novamente.");
    }
    return data;
}

function nextPayableId(state) {
    state.seq = state.seq || {};
    state.seq.payable = Number(state.seq.payable || 1);
    const id = `PAY-${String(state.seq.payable).padStart(5, "0")}`;
    state.seq.payable += 1;
    return id;
}

async function main() {
    const row = await fetchStateRow();
    const state = clone(row.payload || {});

    if (!Array.isArray(state.payables)) {
        state.payables = [];
    }

    const createdAt = isoNow();
    const existingCustomers = new Set(
        state.payables
            .map((entry) => String(entry?.customerName || "").trim().toLowerCase())
            .filter(Boolean)
    );

    // add Wellys
    if (!existingCustomers.has("wellys")) {
        state.payables.push({
            id: nextPayableId(state),
            comandaId: "Avulso",
            customerName: "Wellys",
            total: 12,
            status: "pendente",
            createdAt: createdAt,
            paidAt: null,
            paidMethod: ""
        });
        existingCustomers.add("wellys");
    }

    // add xanato
    if (!existingCustomers.has("xanato")) {
        state.payables.push({
            id: nextPayableId(state),
            comandaId: "Avulso",
            customerName: "xanato",
            total: 50,
            status: "pendente",
            createdAt: createdAt,
            paidAt: null,
            paidMethod: ""
        });
    }

    state.meta = state.meta || {};
    state.meta.updatedAt = isoNow();

    await updateStateRow(state, row.updated_at || null);
    console.log("Clientes Wellys e xanato adicionados com sucesso em payables (fiado).");
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
