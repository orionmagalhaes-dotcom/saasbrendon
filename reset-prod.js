const SUPABASE_URL = "https://fquiicsdvjqzrbeiuaxo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";

async function resetDb() {
    console.log("Fetching current state from Supabase to enforce operational cutoff...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main&select=payload,updated_at`, {
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    if (!res.ok) {
        console.error("Failed to fetch state:", await res.text());
        return;
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data.length || !data[0]?.payload) {
        throw new Error("Estado 'main' nao encontrado no Supabase.");
    }
    const payload = data[0].payload;
    const expectedUpdatedAt = data[0].updated_at || null;

    // Enforce operational cutoff to prevent offline lingering data from resurrecting
    payload.meta = payload.meta || {};
    payload.meta.operationalResetAt = new Date().toISOString();
    payload.meta.updatedAt = new Date().toISOString();

    // Clear operational fields again just in case
    payload.openComandas = [];
    payload.closedComandas = [];
    payload.history90 = [];
    payload.auditLog = [];
    payload.cookHistory = [];
    payload.cashHtmlReports = [];

    payload.seq = payload.seq || {};
    payload.seq.cash = 2;
    payload.seq.comanda = 1;
    payload.seq.event = 1;

    payload.cash = {
        id: "CX-1",
        openedAt: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10)
    };

    console.log("Updating Supabase row with operationalResetAt cutoff...");
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
        console.error("Patch failed:", await patchRes.text());
        return;
    }
    const writeData = await patchRes.json();
    if (expectedUpdatedAt && Array.isArray(writeData) && writeData.length === 0) {
        throw new Error("O estado remoto mudou durante o reset. Execute o script novamente.");
    }

    console.log("Reset successful! operationalResetAt cutoff applied.");
}

resetDb().catch(console.error);
