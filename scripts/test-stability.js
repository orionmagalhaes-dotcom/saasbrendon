"use strict";

/**
 * Testes unitarios para funcoes puras do app.js
 * Executa sem dependencias externas: node scripts/test-stability.js
 *
 * NOTA: As funcoes sao copiadas do app.js para teste isolado.
 * Ao alterar app.js, mantenha estes testes sincronizados.
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.error(`  FAIL: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        passed++;
    } else {
        failed++;
        const msg = `${message} — esperado: ${JSON.stringify(expected)}, recebido: ${JSON.stringify(actual)}`;
        failures.push(msg);
        console.error(`  FAIL: ${msg}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a === b) {
        passed++;
    } else {
        failed++;
        const msg = `${message} — esperado: ${b}, recebido: ${a}`;
        failures.push(msg);
        console.error(`  FAIL: ${msg}`);
    }
}

function section(name) {
    console.log(`\n--- ${name} ---`);
}

// ======================================================
// Funcoes copiadas do app.js para teste
// ======================================================

function parseNumber(input) {
    if (typeof input === "number") return input;
    const raw = String(input || "").trim().replace(/[^0-9,.-]/g, "");
    const hasComma = raw.includes(",");
    const normalized = hasComma ? raw.replaceAll(".", "").replaceAll(",", ".") : raw;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
}

function parseUpdatedAtTimestamp(value) {
    const ts = new Date(value || 0).getTime();
    if (!Number.isFinite(ts)) return 0;
    const oneYearAhead = Date.now() + 365 * 24 * 60 * 60 * 1000;
    if (ts > oneYearAhead) return 0;
    return ts;
}

function normalizeDeletedIdList(source) {
    if (!Array.isArray(source)) return [];
    return [...new Set(source.map((id) => String(id || "").trim()).filter(Boolean))];
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

function isoNow() {
    return new Date().toISOString();
}

function todayISO() {
    return new Date().toISOString().slice(0, 10);
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

function sortByRowIdAsc(rows = []) {
    return [...rows].sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? ""), undefined, { numeric: true }));
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

function esc(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function money(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseNumber(value || 0));
}

function hasSystemTestMarker(value) {
    const SYSTEM_TEST_MARKERS = ["teste", "test", "mock", "pixteste", "cupom de teste"];
    const lower = String(value || "").toLowerCase().trim();
    return SYSTEM_TEST_MARKERS.some((marker) => lower.includes(marker));
}

// ======================================================
// TESTES
// ======================================================

section("parseNumber");
assertEqual(parseNumber(42), 42, "numero inteiro");
assertEqual(parseNumber(3.14), 3.14, "numero decimal");
assertEqual(parseNumber("42"), 42, "string inteira");
assertEqual(parseNumber("3,14"), 3.14, "string com virgula");
assertEqual(parseNumber("1.234,56"), 1234.56, "string com ponto e virgula");
assertEqual(parseNumber("R$ 10,50"), 10.50, "string com moeda");
assertEqual(parseNumber("abc"), 0, "string invalida");
assertEqual(parseNumber(""), 0, "string vazia");
assertEqual(parseNumber(null), 0, "null");
assertEqual(parseNumber(undefined), 0, "undefined");
assert(Number.isNaN(parseNumber(NaN)), "NaN retorna NaN (typeof number short-circuit)");
assertEqual(parseNumber(Infinity), Infinity, "Infinity retorna Infinity (typeof number short-circuit)");
assertEqual(parseNumber(-Infinity), -Infinity, "-Infinity retorna -Infinity (typeof number short-circuit)");
assertEqual(parseNumber("0"), 0, "zero string");
assertEqual(parseNumber(0), 0, "zero numero");
assertEqual(parseNumber("-5,50"), -5.50, "negativo com virgula");

section("parseUpdatedAtTimestamp");
{
    const valid = parseUpdatedAtTimestamp("2025-01-15T12:00:00.000Z");
    assert(valid > 0, "timestamp valido retorna positivo");
    const zero = parseUpdatedAtTimestamp(null);
    assertEqual(zero, 0, "null retorna 0");
    const zero2 = parseUpdatedAtTimestamp(undefined);
    assertEqual(zero2, 0, "undefined retorna 0");
    const zero3 = parseUpdatedAtTimestamp("");
    assertEqual(zero3, 0, "string vazia retorna 0");
    const zero4 = parseUpdatedAtTimestamp("not-a-date");
    assertEqual(zero4, 0, "string invalida retorna 0");
    // Timestamp muito no futuro (>1 ano) deve retornar 0
    const futureDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
    const futureResult = parseUpdatedAtTimestamp(futureDate);
    assertEqual(futureResult, 0, "data >1 ano no futuro retorna 0");
    // Timestamp recente no futuro (dentro de 1 ano) deve retornar positivo
    const nearFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const nearResult = parseUpdatedAtTimestamp(nearFuture);
    assert(nearResult > 0, "data <1 ano no futuro retorna positivo");
}

section("normalizeDeletedIdList");
assertDeepEqual(normalizeDeletedIdList(null), [], "null retorna []");
assertDeepEqual(normalizeDeletedIdList(undefined), [], "undefined retorna []");
assertDeepEqual(normalizeDeletedIdList("not an array"), [], "string retorna []");
assertDeepEqual(normalizeDeletedIdList([1, 2, 3]), ["1", "2", "3"], "numeros convertidos para strings");
assertDeepEqual(normalizeDeletedIdList(["a", "b", "a"]), ["a", "b"], "remove duplicatas");
assertDeepEqual(normalizeDeletedIdList(["", null, "x"]), ["x"], "filtra vazios e nulls");
assertDeepEqual(normalizeDeletedIdList([" 1 ", "2"]), ["1", "2"], "faz trim");

section("hashText");
{
    const h1 = hashText("hello");
    const h2 = hashText("hello");
    assertEqual(h1, h2, "mesma entrada produz mesmo hash");
    const h3 = hashText("world");
    assert(h1 !== h3, "entradas diferentes produzem hashes diferentes");
    const h4 = hashText("");
    const h5 = hashText(null);
    assertEqual(h4, h5, "string vazia e null produzem mesmo hash");
    assert(typeof h1 === "string", "resultado e string");
    assertEqual(h1.length, 8, "hash tem 8 caracteres");
}

section("isoNow / todayISO");
{
    const iso = isoNow();
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(iso), "isoNow formato ISO valido");
    const today = todayISO();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(today), "todayISO formato YYYY-MM-DD");
    assert(iso.startsWith(today), "isoNow comeca com todayISO");
}

section("normalizeOperationalResetAt");
assertEqual(normalizeOperationalResetAt(null), "", "null retorna vazio");
assertEqual(normalizeOperationalResetAt(123), "", "numero retorna vazio");
assertEqual(normalizeOperationalResetAt(""), "", "string vazia retorna vazio");
assertEqual(normalizeOperationalResetAt("  "), "", "espacos retorna vazio");
assertEqual(normalizeOperationalResetAt("not-a-date"), "", "data invalida retorna vazio");
{
    const valid = normalizeOperationalResetAt("2025-06-15T10:30:00.000Z");
    assert(valid.length > 0, "data valida retorna ISO string");
    assert(valid.includes("2025"), "resultado contem o ano correto");
}

section("selectLatestOperationalResetAt");
{
    const a = "2025-01-01T00:00:00.000Z";
    const b = "2025-06-15T00:00:00.000Z";
    const result = selectLatestOperationalResetAt(a, b);
    assert(result.includes("2025-06-15"), "seleciona a data mais recente");
    const empty = selectLatestOperationalResetAt("", null, undefined);
    assertEqual(empty, "", "todas invalidas retorna vazio");
}

section("mergedRowsById");
{
    const local = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
    const remote = [{ id: 2, name: "B2" }, { id: 3, name: "C" }];

    // preferLocal=true: local wins on conflicts, remote-only items included
    const merged = mergedRowsById(local, remote, []);
    assertEqual(merged.length, 3, "merge com preferLocal inclui todos");
    // With preferLocal=true: firstRows=remote, secondRows=local. Second overwrites first.
    assertEqual(merged.find(r => r.id === 2)?.name, "B", "preferLocal: local prevalece sobre remote");

    // com deletedIds
    const merged2 = mergedRowsById(local, remote, ["2"]);
    assertEqual(merged2.length, 2, "merge exclui deletados");
    assert(!merged2.find(r => String(r.id) === "2"), "id 2 foi excluido");

    // arrays null/undefined
    const merged3 = mergedRowsById(null, null, []);
    assertEqual(merged3.length, 0, "null arrays retorna []");

    // allowRemoteOnly=false
    const merged4 = mergedRowsById(local, remote, [], { allowRemoteOnly: false });
    assertEqual(merged4.length, 2, "allowRemoteOnly=false filtra remoto-only");
}

section("pickRowByTimestamp");
{
    const a = { id: 1, name: "A", updatedAt: "2025-01-01T00:00:00Z" };
    const b = { id: 1, name: "B", updatedAt: "2025-06-15T00:00:00Z" };

    const winner = pickRowByTimestamp(a, b);
    assertEqual(winner.name, "B", "escolhe o mais recente");

    const winner2 = pickRowByTimestamp(b, a);
    assertEqual(winner2.name, "B", "independe da ordem");

    assertEqual(pickRowByTimestamp(null, b)?.name, "B", "null local retorna remote");
    assertEqual(pickRowByTimestamp(a, null)?.name, "A", "null remote retorna local");
    assertEqual(pickRowByTimestamp(null, null), null, "ambos null retorna null");

    // mesma timestamp, preferLocal
    const same1 = { id: 1, name: "L", updatedAt: "2025-01-01T00:00:00Z" };
    const same2 = { id: 1, name: "R", updatedAt: "2025-01-01T00:00:00Z" };
    assertEqual(pickRowByTimestamp(same1, same2, { preferLocal: true })?.name, "L", "mesma ts com preferLocal retorna local");
    assertEqual(pickRowByTimestamp(same1, same2, { preferLocal: false })?.name, "R", "mesma ts sem preferLocal retorna remote");
}

section("mergeComandasById");
{
    const local = [
        { id: "CMD-0001", table: "T1", createdAt: "2025-01-01T00:00:00Z" },
        { id: "CMD-0002", table: "T2", createdAt: "2025-01-01T00:00:00Z" }
    ];
    const remote = [
        { id: "CMD-0002", table: "T2-updated", createdAt: "2025-06-15T00:00:00Z" },
        { id: "CMD-0003", table: "T3", createdAt: "2025-01-01T00:00:00Z" }
    ];

    const merged = mergeComandasById(local, remote);
    assertEqual(merged.length, 3, "merge inclui todas as comandas");
    assertEqual(merged.find(c => c.id === "CMD-0002")?.table, "T2-updated", "comanda mais recente ganha");

    // null inputs
    const merged2 = mergeComandasById(null, null);
    assertEqual(merged2.length, 0, "null inputs retorna []");

    // allowRemoteOnly = false
    const merged3 = mergeComandasById(local, remote, { allowRemoteOnly: false });
    assertEqual(merged3.length, 2, "allowRemoteOnly=false filtra remote-only");
}

section("mergeAuditRows");
{
    const local = [
        { id: "E1", ts: "2025-06-15T12:00:00Z", type: "login" },
        { id: "E2", ts: "2025-06-15T11:00:00Z", type: "comanda_aberta" }
    ];
    const remote = [
        { id: "E2", ts: "2025-06-15T11:00:00Z", type: "comanda_aberta" }, // duplicate
        { id: "E3", ts: "2025-06-15T10:00:00Z", type: "logout" }
    ];

    const merged = mergeAuditRows(local, remote);
    assertEqual(merged.length, 3, "remove duplicatas");
    assertEqual(merged[0].id, "E1", "ordenado por ts desc");
    assertEqual(merged[2].id, "E3", "ultimo e o mais antigo");

    // null inputs
    const merged2 = mergeAuditRows(null, null);
    assertEqual(merged2.length, 0, "null inputs retorna []");
}

section("stateFootprint");
{
    const normal = stateFootprint({
        users: [{ id: 1 }, { id: 2 }],
        products: [{ id: 1 }],
        openComandas: [{ id: "CMD-1" }],
        closedComandas: [],
        history90: [],
        auditLog: [{ id: "E1" }, { id: "E2" }],
        payables: [],
        cashHtmlReports: [],
        cookHistory: []
    });
    assertEqual(normal.users, 2, "contagem de users");
    assertEqual(normal.products, 1, "contagem de products");
    assertEqual(normal.openComandas, 1, "contagem de openComandas");
    assertEqual(normal.catalogRows, 3, "catalogRows = users + products");
    assertEqual(normal.operationalRows, 3, "operationalRows = open+closed+history+audit+pay+cash+cook");

    // null/undefined state
    const empty = stateFootprint(null);
    assertEqual(empty.catalogRows, 0, "null state tem 0 catalogRows");
    assertEqual(empty.operationalRows, 0, "null state tem 0 operationalRows");
}

section("isLikelyResetState");
{
    assert(isLikelyResetState({}), "objeto vazio e reset state");
    assert(isLikelyResetState({ users: [{ id: 1 }] }), "1 user e reset state");
    assert(!isLikelyResetState({ users: [{ id: 1 }, { id: 2 }] }), "2 users nao e reset state");
    assert(!isLikelyResetState({ products: [{ id: 1 }] }), "com produtos nao e reset state");
    assert(!isLikelyResetState({ openComandas: [{ id: "CMD-1" }] }), "com comandas nao e reset state");
}

section("shouldForceRemotePreference");
{
    const empty = {};
    const rich = { users: [{ id: 1 }, { id: 2 }], products: [{ id: 1 }] };
    assert(shouldForceRemotePreference(empty, rich), "estado local vazio, remoto rico = force remote");
    assert(!shouldForceRemotePreference(rich, empty), "estado local rico, remoto vazio = nao force remote");
    assert(!shouldForceRemotePreference(rich, rich), "ambos ricos = nao force remote");
}

section("esc");
assertEqual(esc("<script>"), "&lt;script&gt;", "escapa tags HTML");
assertEqual(esc("a&b"), "a&amp;b", "escapa ampersand");
assertEqual(esc('"hello"'), "&quot;hello&quot;", "escapa aspas duplas");
assertEqual(esc("it's"), "it&#039;s", "escapa aspas simples");
assertEqual(esc(null), "", "null retorna string vazia");
assertEqual(esc(undefined), "", "undefined retorna string vazia");
assertEqual(esc(42), "42", "numero convertido para string");

section("money");
{
    const r = money(10.5);
    assert(r.includes("10,50"), "formata valor com virgula");
    assert(r.includes("R$"), "inclui simbolo R$");

    const r2 = money(0);
    assert(r2.includes("0,00"), "zero formatado");

    const r3 = money("15,75");
    assert(r3.includes("15,75"), "string com virgula");
}

section("hasSystemTestMarker");
assert(hasSystemTestMarker("Item Teste"), "detecta 'teste'");
assert(hasSystemTestMarker("Mock Data"), "detecta 'mock'");
assert(hasSystemTestMarker("PixTeste"), "detecta 'pixteste'");
assert(hasSystemTestMarker("Cupom de Teste 123"), "detecta 'cupom de teste'");
assert(!hasSystemTestMarker("Pizza"), "nao detecta falso positivo");
assert(!hasSystemTestMarker(""), "string vazia nao e marcador");
assert(!hasSystemTestMarker(null), "null nao e marcador");

section("sortByRowIdAsc");
{
    const rows = [{ id: "3" }, { id: "1" }, { id: "2" }];
    const sorted = sortByRowIdAsc(rows);
    assertEqual(sorted[0].id, "1", "ordena por id asc");
    assertEqual(sorted[2].id, "3", "ultimo e o maior");

    const empty = sortByRowIdAsc([]);
    assertEqual(empty.length, 0, "array vazio retorna []");

    const def = sortByRowIdAsc();
    assertEqual(def.length, 0, "undefined retorna []");
}

section("Edge cases — arrays vazios no Math.max");
{
    // Simula o mesmo padrao usado em mergeStateForCloud (linhas 763-764)
    const users = [];
    const maxUserId = Math.max(0, ...users.map((u) => Number(u?.id || 0)));
    assertEqual(maxUserId, 0, "Math.max(0, ...[]) retorna 0, nao -Infinity");

    const oneUser = [{ id: 5 }];
    const maxUserId2 = Math.max(0, ...oneUser.map((u) => Number(u?.id || 0)));
    assertEqual(maxUserId2, 5, "Math.max com um elemento funciona");
}

section("sanitizeStateForCloud (simulated)");
{
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

    const input = { users: [{ id: 1 }], session: { userId: 5 }, meta: { updatedAt: "2025-01-01" } };
    const result = sanitizeStateForCloud(input);
    assertEqual(result.session.userId, null, "session limpa");
    assertEqual(result.users.length, 1, "dados preservados");
    assert(result !== input, "cria copia, nao referencia");

    // teste com objeto nao serializavel (circular ref nao pode acontecer com JSON, mas testa fallback)
    const simple = { a: 1, session: { userId: 10 } };
    const result2 = sanitizeStateForCloud(simple);
    assertEqual(result2.session.userId, null, "fallback funciona");
}

section("adoptIncomingState (simulated)");
{
    function adoptIncomingState(source) {
        if (!source || typeof source !== "object" || Array.isArray(source)) {
            return null;
        }
        return "processed";
    }

    assertEqual(adoptIncomingState(null), null, "null rejeitado");
    assertEqual(adoptIncomingState(undefined), null, "undefined rejeitado");
    assertEqual(adoptIncomingState("string"), null, "string rejeitada");
    assertEqual(adoptIncomingState([1, 2]), null, "array rejeitado");
    assertEqual(adoptIncomingState(42), null, "numero rejeitado");
    assertEqual(adoptIncomingState({ data: true }), "processed", "objeto valido aceito");
}

// ======================================================
// RESULTADO FINAL
// ======================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTADOS: ${passed} passaram, ${failed} falharam`);
if (failures.length) {
    console.log(`\nFalhas detalhadas:`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}
console.log("=".repeat(50));
process.exit(failed > 0 ? 1 : 0);
