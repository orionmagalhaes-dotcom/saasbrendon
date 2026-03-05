const fs = require('fs');

const SUPABASE_URL = "https://fquiicsdvjqzrbeiuaxo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWlpY3NkdmpxenJiZWl1YXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDMxMDksImV4cCI6MjA4NjUxOTEwOX0.JYRxM0TJa1zEvqUPfMDWlCYnUfOlGR5oq7UoVaonL7w";

async function restorePayables() {
    console.log("Fetching current state from Supabase...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main&select=payload`, {
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    const data = await res.json();
    const payload = data[0].payload;

    // Try to find a recent catalog backup inside meta
    const meta = payload.meta || {};
    const backups = meta["__rtb_catalog_backups__"] || [];

    console.log(`Found ${backups.length} internal backups.`);

    let restoredPayables = [];

    if (backups.length > 0) {
        // Get the most recent backup before my reset
        backups.sort((a, b) => new Date(b.ts) - new Date(a.ts));

        for (const backup of backups) {
            if (backup.payload && backup.payload.payables && backup.payload.payables.length > 0) {
                restoredPayables = backup.payload.payables;
                console.log(`Found ${restoredPayables.length} payables in backup from ${backup.ts}`);
                break;
            }
        }
    }

    if (restoredPayables.length === 0) {
        console.log("No payables found in catalog backups. They might have been completely cleared or were empty.");
        return;
    }

    console.log(`Restoring ${restoredPayables.length} payables...`);
    payload.payables = restoredPayables;

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/restobar_state?id=eq.main`, {
        method: "PATCH",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        body: JSON.stringify({ payload })
    });

    if (patchRes.ok) {
        console.log("Payables successfully restored to Supabase!");
    } else {
        console.error("Failed to restore payables:", await patchRes.text());
    }
}

restorePayables().catch(console.error);
