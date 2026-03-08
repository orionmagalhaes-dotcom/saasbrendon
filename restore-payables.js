const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://fquiicsdvjqzrbeiuaxo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";

function extractStateCandidate(source) {
    if (!source || typeof source !== "object") return null;
    if (Array.isArray(source)) {
        for (const entry of source) {
            const candidate = extractStateCandidate(entry);
            if (candidate) return candidate;
        }
        return null;
    }
    if (source.payload && typeof source.payload === "object") return source.payload;
    if (source.state && typeof source.state === "object") return source.state;
    if (Array.isArray(source.payables) || Array.isArray(source.products) || Array.isArray(source.openComandas)) return source;
    for (const value of Object.values(source)) {
        const candidate = extractStateCandidate(value);
        if (candidate) return candidate;
    }
    return null;
}

function loadBackupState() {
    const input = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.join(__dirname, "backup_check.json");
    if (!fs.existsSync(input)) {
        return { filePath: input, state: null };
    }
    const parsed = JSON.parse(fs.readFileSync(input, "utf8"));
    return { filePath: input, state: extractStateCandidate(parsed) };
}

async function restorePayables() {
    console.log("Fetching current state from Supabase...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main&select=payload,updated_at`, {
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!res.ok) {
        throw new Error(`Falha ao buscar estado: HTTP ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data.length || !data[0]?.payload) {
        throw new Error("Estado 'main' nao encontrado no Supabase.");
    }

    const payload = data[0].payload;
    const expectedUpdatedAt = data[0].updated_at || null;
    const { filePath, state: backupState } = loadBackupState();
    const restoredPayables = Array.isArray(backupState?.payables) ? backupState.payables : [];

    if (restoredPayables.length === 0) {
        console.log(`No payables found in backup file: ${filePath}`);
        console.log("Catalog backups do not store payables, so provide a full state backup JSON when needed.");
        return;
    }

    console.log(`Found ${restoredPayables.length} payables in backup file: ${filePath}`);
    console.log(`Restoring ${restoredPayables.length} payables...`);
    payload.payables = restoredPayables;
    payload.meta = payload.meta || {};
    payload.meta.updatedAt = new Date().toISOString();

    const query = new URLSearchParams({ id: "eq.main" });
    if (expectedUpdatedAt) {
        query.set("updated_at", `eq.${expectedUpdatedAt}`);
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?${query.toString()}`, {
        method: "PATCH",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        body: JSON.stringify({ payload })
    });

    if (!patchRes.ok) {
        throw new Error(`Failed to restore payables: HTTP ${patchRes.status} ${await patchRes.text()}`);
    }

    const writeData = await patchRes.json();
    if (expectedUpdatedAt && Array.isArray(writeData) && writeData.length === 0) {
        throw new Error("O estado remoto mudou durante o restore. Execute o script novamente.");
    }

    console.log("Payables successfully restored to Supabase!");
}

restorePayables().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
