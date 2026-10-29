/**
 * Browser-facing JSON API for the floating widget.
 *
 * The host ledger is the single source of truth: the widget reads this state
 * and posts knocks/auto/sutra changes back here. There is deliberately no
 * second (localStorage) merit ledger on the client.
 */
export const MUYU_API_PREFIX = '/dsh-muyu';
const MAX_BODY_CHARS = 8 * 1024;
const MAX_CYCLE_TITLE = 80;
const MAX_BOOK_ID = 64;
const MAX_ACTION_CHARS = 16;
export function buildMuyuState(muyu, includeHistory = false) {
    const stats = muyu.getMeritStats();
    const book = muyu.getSutra();
    return {
        todayMerit: stats.todayMerit,
        totalMerit: stats.totalMerit,
        todayTokens: stats.todayTokens,
        totalTokens: stats.totalTokens,
        pendingTokens: stats.pendingTokens,
        tokensPerMerit: muyu.getTokensPerMerit(),
        todayKey: stats.todayKey,
        bookId: book.id,
        bookTitle: book.title,
        currentSentence: muyu.getCurrentSentence(),
        lastSentence: muyu.getLastChantedSentence(),
        chantSeq: muyu.getChantSeq(),
        auto: muyu.getAutoKnockStatus(),
        ...(includeHistory ? { records: stats.records } : {})
    };
}
function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
    });
    res.end(body);
}
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let text = '';
        let settled = false;
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
        const decoder = new TextDecoder('utf-8');
        req.on('data', (chunk) => {
            if (settled)
                return;
            text += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
            if (text.length > MAX_BODY_CHARS) {
                fail(new Error('request body too large'));
            }
        });
        req.on('end', () => {
            if (settled)
                return;
            text += decoder.decode();
            settled = true;
            if (text.trim() === '') {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(text));
            }
            catch {
                reject(new Error('invalid JSON body'));
            }
        });
        req.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))));
    });
}
function clampInteger(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(num)));
}
function headerValue(req, name) {
    const value = req.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
}
function expectedOrigin(webServer) {
    try {
        if (typeof webServer?.getOrigin === 'function') {
            const origin = webServer.getOrigin();
            if (origin)
                return new URL(String(origin));
        }
    }
    catch { }
    try {
        const protocol = typeof webServer?.protocol === 'string' ? webServer.protocol : 'http:';
        const host = webServer?.host;
        const port = webServer?.port;
        if (host && port !== undefined) {
            return new URL(`${protocol}//${host}:${port}`);
        }
    }
    catch { }
    return null;
}
function isLoopbackHostname(hostname) {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
function defaultPort(url) {
    return url.port || (url.protocol === 'https:' ? '443' : '80');
}
function allowedHost(req, webServer) {
    const host = (headerValue(req, 'host') || '').trim().toLowerCase();
    if (!host)
        return false;
    const expected = expectedOrigin(webServer);
    if (!expected)
        return false;
    if (host === expected.host.toLowerCase())
        return true;
    const port = defaultPort(expected);
    return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host);
}
function allowedOrigin(req, webServer) {
    const origin = headerValue(req, 'origin');
    // Electron's dsh-app:// protocol bridge forwards requests without an Origin header.
    if (!origin)
        return true;
    if (origin === 'dsh-app://app')
        return true;
    const expected = expectedOrigin(webServer);
    if (!expected)
        return false;
    if (origin === expected.origin)
        return true;
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== expected.protocol)
            return false;
        return defaultPort(parsed) === defaultPort(expected) && isLoopbackHostname(parsed.hostname);
    }
    catch {
        return false;
    }
}
function requireJsonContentType(req, res) {
    const contentType = (headerValue(req, 'content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
        sendJson(res, 415, { error: 'content-type must be application/json' });
        return false;
    }
    return true;
}
function checkRequestOrigin(req, res, webServer) {
    if (!allowedHost(req, webServer)) {
        sendJson(res, 403, { error: 'forbidden host' });
        return false;
    }
    if (!allowedOrigin(req, webServer)) {
        sendJson(res, 403, { error: 'forbidden origin' });
        return false;
    }
    return true;
}
function methodNotAllowed(res, allowed) {
    sendJson(res, 405, { error: `method not allowed; use ${allowed}` });
}
function guard(handler) {
    return (req, res) => {
        Promise.resolve()
            .then(() => handler(req, res))
            .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            if (!res.headersSent) {
                sendJson(res, 400, { error: message });
            }
            else {
                res.end();
            }
        });
    };
}
export function createMuyuRouteHandlers(muyu, webServer) {
    const state = guard(async (req, res) => {
        if (!checkRequestOrigin(req, res, webServer))
            return;
        if ((req.method || 'GET').toUpperCase() !== 'GET') {
            methodNotAllowed(res, 'GET');
            return;
        }
        const url = new URL(req.url || `${MUYU_API_PREFIX}/state`, 'http://localhost');
        const includeHistory = url.searchParams.get('history') === '1';
        sendJson(res, 200, buildMuyuState(muyu, includeHistory));
    });
    const knock = guard(async (req, res) => {
        if (!checkRequestOrigin(req, res, webServer))
            return;
        if ((req.method || '').toUpperCase() !== 'POST') {
            methodNotAllowed(res, 'POST');
            return;
        }
        if (!requireJsonContentType(req, res))
            return;
        const body = await readJsonBody(req);
        const count = clampInteger(body?.count, 1, 1, 108);
        const result = muyu.knock(count);
        sendJson(res, 200, {
            state: buildMuyuState(muyu),
            knock: {
                amount: result.amount,
                currentSentence: result.currentSentence,
                cycleCompleted: result.cycleCompleted,
                completedCycles: result.completedCycles
            }
        });
    });
    const auto = guard(async (req, res) => {
        if (!checkRequestOrigin(req, res, webServer))
            return;
        if ((req.method || '').toUpperCase() !== 'POST') {
            methodNotAllowed(res, 'POST');
            return;
        }
        if (!requireJsonContentType(req, res))
            return;
        const body = await readJsonBody(req);
        const action = String(body?.action || 'status');
        if (action.length > MAX_ACTION_CHARS) {
            sendJson(res, 400, { error: 'action is too long' });
            return;
        }
        if (action === 'start') {
            const targetCount = clampInteger(body?.targetCount, 0, 0, 1080);
            const intervalMs = body?.intervalMs === undefined ? undefined : clampInteger(body.intervalMs, 1200, 200, 60000);
            const title = typeof body?.cycleTitle === 'string' ? body.cycleTitle.slice(0, MAX_CYCLE_TITLE) : undefined;
            muyu.startAutoKnock(targetCount, intervalMs, title);
        }
        else if (action === 'stop') {
            muyu.stopAutoKnock();
        }
        else if (action !== 'status') {
            sendJson(res, 400, { error: 'action must be start, stop, or status' });
            return;
        }
        sendJson(res, 200, { state: buildMuyuState(muyu) });
    });
    const sutra = guard(async (req, res) => {
        if (!checkRequestOrigin(req, res, webServer))
            return;
        if ((req.method || '').toUpperCase() !== 'POST') {
            methodNotAllowed(res, 'POST');
            return;
        }
        if (!requireJsonContentType(req, res))
            return;
        const body = await readJsonBody(req);
        const bookId = typeof body?.bookId === 'string' ? body.bookId : '';
        if (bookId.length > MAX_BOOK_ID) {
            sendJson(res, 400, { error: 'bookId is too long' });
            return;
        }
        if (!bookId || !muyu.selectSutra(bookId)) {
            sendJson(res, 400, { error: `unknown sutra: ${bookId || '(empty)'}` });
            return;
        }
        sendJson(res, 200, { state: buildMuyuState(muyu) });
    });
    return { state, knock, auto, sutra };
}
/**
 * Register the widget API on the host web server. Returns a disposer that
 * removes every route (used by the plugin's Cordis effect).
 */
export function registerMuyuClientApi(webServer, muyu) {
    if (!webServer || typeof webServer.register !== 'function') {
        return () => { };
    }
    const handlers = createMuyuRouteHandlers(muyu, webServer);
    const routes = [
        { kind: 'exact', path: `${MUYU_API_PREFIX}/state`, handler: handlers.state },
        { kind: 'exact', path: `${MUYU_API_PREFIX}/knock`, handler: handlers.knock },
        { kind: 'exact', path: `${MUYU_API_PREFIX}/auto`, handler: handlers.auto },
        { kind: 'exact', path: `${MUYU_API_PREFIX}/sutra`, handler: handlers.sutra }
    ];
    const disposers = routes.map(route => {
        try {
            return webServer.register(route);
        }
        catch (error) {
            console.warn('[dsh-plugin-muyu] failed to register client API route', route.path, error);
            return () => { };
        }
    });
    return () => {
        for (const dispose of disposers) {
            try {
                dispose();
            }
            catch { }
        }
    };
}
//# sourceMappingURL=client-api.js.map