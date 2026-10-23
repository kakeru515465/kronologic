// KRONOLOGIC オンライン対戦サーバー（Node.js標準機能のみ・追加インストール不要）
// 起動: node server.js  →  http://localhost:3000/online.html
const http = require("http");
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const FILES = new Set(["index.html", "online.html", "app.js", "online.js", "common.js", "engine.js", "config.js", "style.css"]);
const rooms = new Map();

const rid = () => Math.random().toString(36).slice(2, 10);
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

function newCode() {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (;;) {
    const c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("");
    if (!rooms.has(c)) return c;
  }
}

// ---- 各プレイヤーに見せてよい情報だけを組み立てる（答えは終了まで送らない） ----
function stripPrivate(entry) {
  const { priv, char, time, ...pub } = entry;
  return pub;
}

function viewFor(room, me) {
  const sc = room.scen;
  const ended = room.phase === "end";
  const v = {
    phase: room.phase,
    code: room.code,
    you: me.id,
    host: room.players[0].id,
    turn: room.order ? room.order[room.ti] : null,
    si: room.si,
    di: room.di,
    winner: room.winner,
    players: room.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive, connected: p.connected, verdict: p.verdict })),
    log: room.log.map((l) => (l.by === me.id ? l : stripPrivate(l)))
  };
  if (sc) v.scenario = { type: sc.type, diff: sc.diff, clues: sc.clues, known: sc.known, initAll: sc.initAll };
  if (ended) v.reveal = { sol: sc.sol, occ: sc.occ };
  return v;
}

function push(room) {
  for (const c of room.clients) {
    const me = room.players.find((p) => p.id === c.pid);
    if (me) c.res.write(`data: ${JSON.stringify(viewFor(room, me))}\n\n`);
  }
}

function nextTurn(room) {
  const n = room.order.length;
  for (let i = 1; i <= n; i++) {
    const idx = (room.ti + i) % n;
    const p = room.players.find((x) => x.id === room.order[idx]);
    if (p.alive) { room.ti = idx; return; }
  }
}

// ---- 操作の処理 ----
const fail = (msg) => { throw Object.assign(new Error(msg), { status: 400 }); };

function getRoom(b) {
  const room = rooms.get(String(b.code || "").toUpperCase());
  if (!room) fail("部屋が見つかりません。");
  const me = room.players.find((p) => p.token === b.token);
  return { room, me };
}

function cleanName(s, fallback) {
  return String(s || "").trim().slice(0, 12) || fallback;
}

const actions = {
  create(b) {
    const room = { code: newCode(), phase: "lobby", si: 0, di: 0, players: [], log: [], clients: new Set(), scen: null, order: null, ti: 0, winner: null, made: Date.now() };
    const me = { id: rid(), token: rid() + rid(), name: cleanName(b.name, "探偵1"), alive: true, connected: false, verdict: null };
    room.players.push(me);
    rooms.set(room.code, room);
    return { code: room.code, token: me.token };
  },

  join(b) {
    const room = rooms.get(String(b.code || "").toUpperCase());
    if (!room) fail("部屋が見つかりません。");
    if (room.phase !== "lobby") fail("この部屋はすでに始まっています。");
    if (room.players.length >= MAX_PLAYERS) fail("この部屋は満員です。");
    let name = cleanName(b.name, "探偵" + (room.players.length + 1));
    if (room.players.some((p) => p.name === name)) name += room.players.length + 1;
    const me = { id: rid(), token: rid() + rid(), name, alive: true, connected: false, verdict: null };
    room.players.push(me);
    push(room);
    return { code: room.code, token: me.token };
  },

  config(b) {
    const { room, me } = getRoom(b);
    if (!me || me !== room.players[0] || room.phase !== "lobby") fail("操作できません。");
    if (E.SCENARIOS[b.si] && E.DIFFICULTIES[b.di]) { room.si = b.si; room.di = b.di; }
    push(room);
  },

  start(b) {
    const { room, me } = getRoom(b);
    if (!me || me !== room.players[0] || room.phase !== "lobby") fail("操作できません。");
    const sc = E.generate(E.SCENARIOS[room.si], E.DIFFICULTIES[room.di]);
    if (!sc) fail("事件を生成できませんでした。もう一度お試しください。");
    Object.assign(room, { scen: sc, phase: "play", log: [], winner: null, order: shuffle(room.players.map((p) => p.id)), ti: 0 });
    room.players.forEach((p) => { p.alive = true; p.verdict = null; });
    push(room);
  },

  inquire(b) {
    const { room, me } = getRoom(b);
    if (!me || room.phase !== "play" || room.order[room.ti] !== me.id || !me.alive) fail("あなたの手番ではありません。");
    const r = Number(b.room);
    if (!Number.isInteger(r) || r < 0 || r > 5) fail("場所が正しくありません。");
    let res;
    if (b.mode === "time") {
      const t = Number(b.time);
      if (!Number.isInteger(t) || t < 1 || t > 6) fail("時間が正しくありません。");
      res = E.inquirePlaceTime(room.scen, r, t);
    } else {
      if (!E.CHARS.includes(b.char)) fail("人物が正しくありません。");
      res = E.inquirePlacePerson(room.scen, r, b.char);
    }
    room.log.push({ ...res, seq: room.log.length + 1, by: me.id, byName: me.name });
    nextTurn(room);
    push(room);
  },

  answer(b) {
    const { room, me } = getRoom(b);
    if (!me || room.phase !== "play" || room.order[room.ti] !== me.id || !me.alive) fail("あなたの手番ではありません。");
    const results = E.judge(room.scen, b.input || {});
    if (results.every((x) => x.ok)) {
      me.verdict = "correct";
      room.winner = me.id;
      room.phase = "end";
    } else {
      me.verdict = "wrong";
      me.alive = false;
      if (room.players.every((p) => !p.alive)) room.phase = "end";
      else nextTurn(room);
    }
    push(room);
  },

  again(b) {
    const { room, me } = getRoom(b);
    if (!me || me !== room.players[0] || room.phase !== "end") fail("操作できません。");
    Object.assign(room, { phase: "lobby", scen: null, log: [], order: null, ti: 0, winner: null });
    room.players.forEach((p) => { p.alive = true; p.verdict = null; });
    push(room);
  }
};

// ---- HTTP ----
function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
}

function handleEvents(req, res, q) {
  const room = rooms.get(String(q.get("code") || "").toUpperCase());
  const me = room && room.players.find((p) => p.token === q.get("token"));
  if (!me) return send(res, 404, { error: "部屋が見つかりません。" });
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
  const client = { res, pid: me.id };
  room.clients.add(client);
  me.connected = true;
  push(room);
  req.on("close", () => {
    room.clients.delete(client);
    if (![...room.clients].some((c) => c.pid === me.id)) {
      me.connected = false;
      push(room);
      // 手番の人が切断したまま45秒たったら、手番を飛ばす
      if (room.phase === "play" && room.order[room.ti] === me.id) {
        setTimeout(() => {
          if (!me.connected && room.phase === "play" && room.order[room.ti] === me.id) { nextTurn(room); push(room); }
        }, 45000);
      }
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/api/events") return handleEvents(req, res, url.searchParams);
  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    const fn = actions[url.pathname.slice(5)];
    if (!fn) return send(res, 404, { error: "not found" });
    let body = "";
    req.on("data", (d) => { body += d; if (body.length > 10000) req.destroy(); });
    req.on("end", () => {
      try { send(res, 200, fn(JSON.parse(body || "{}")) || { ok: true }); }
      catch (e) { send(res, e.status || 500, { error: e.status ? e.message : "サーバーエラー" }); }
    });
    return;
  }
  const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (req.method === "GET" && FILES.has(name)) {
    const file = path.join(__dirname, name);
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(`ファイルが見つかりません: ${name}`);
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(name)] });
    return fs.createReadStream(file).on("error", () => res.end()).pipe(res);
  }
  res.writeHead(404); res.end("Not found");
});

// SSEの接続維持と、古い部屋の掃除
setInterval(() => {
  for (const [code, room] of rooms) {
    room.clients.forEach((c) => c.res.write(": ping\n\n"));
    if (Date.now() - room.made > 6 * 3600 * 1000 && room.clients.size === 0) rooms.delete(code);
  }
}, 25000);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}/online.html`);
    const missing = [...FILES].filter((f) => !fs.existsSync(path.join(__dirname, f)));
    if (missing.length) console.log("⚠ 足りないファイルがあります:", missing.join(", "));
  });
}
server.rooms = rooms; // テスト用
module.exports = server;
