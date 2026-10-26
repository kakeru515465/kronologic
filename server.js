// KRONOLOGIC オンライン対戦サーバー（Node.js標準機能のみ・追加インストール不要）
// 起動: node server.js  →  http://localhost:3000/online.html
const http = require("http");
const fs = require("fs");
const path = require("path");
const E = require("./engine.js");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const MAX_SPECTATORS = 8;
// スタンプ（画面側の online.js の STAMPS と、同じ順番にそろえる）
const STAMPS = ["🤔 考え中", "👍 なるほど", "😱 まさか", "🙏 お願い", "⏰ 急いで", "🎉 やった！"];
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png", ".txt": "text/plain; charset=utf-8" };
const FILES = new Set(["index.html", "online.html", "app.js", "online.js", "common.js", "engine.js", "config.js", "style.css", "pwa.js", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "rules.html", "robots.txt"]);
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

function viewFor(room, me, spec = false) {
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
    role: spec ? "spectator" : "player",
    chatOn: room.chatOn,
    chat: room.chat,
    spectators: room.spectators.map((x) => x.name),
    // 観戦者には、個人情報を送らない
    log: room.log.map((l) => (!spec && l.by === me.id ? l : stripPrivate(l)))
  };
  if (sc) v.scenario = { type: sc.type, diff: sc.diff, clues: sc.clues, known: sc.known, initAll: sc.initAll };
  if (ended) v.reveal = { sol: sc.sol, occ: sc.occ, truth: sc.truth };
  return v;
}

function push(room) {
  for (const c of room.clients) {
    const player = room.players.find((p) => p.id === c.pid);
    const sp = !player && room.spectators.find((x) => x.id === c.pid);
    const me = player || sp;
    if (me) c.res.write(`data: ${JSON.stringify(viewFor(room, me, !!sp))}\n\n`);
  }
}

function nextTurn(room) {
  room.free = 0;
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

// 名前が重なったときは、2, 3…を付けて見分ける
function uniqueName(room, name) {
  let n = name, k = 2;
  while ([...room.players, ...room.spectators].some((p) => p.name === n)) n = `${name}${k++}`;
  return n;
}

// ロビーからプレイヤーを外す（誰もいなくなったら部屋も消す）
function removePlayer(room, me) {
  room.players = room.players.filter((p) => p !== me);
  room.clients.forEach((c) => {
    if (c.pid === me.id) {
      room.clients.delete(c);
      c.res.end();
    }
  });
  if (!room.players.length) rooms.delete(room.code);
  else push(room);
}

// 観戦者を外す
function removeSpectator(room, sp) {
  room.spectators = room.spectators.filter((x) => x !== sp);
  room.clients.forEach((c) => {
    if (c.pid === sp.id) {
      room.clients.delete(c);
      c.res.end();
    }
  });
  push(room);
}

function watchSpecGhost(room, sp) {
  setTimeout(() => {
    if (!sp.connected && room.spectators.includes(sp)) removeSpectator(room, sp);
  }, 60000);
}

// 参加者か観戦者かを、トークンで見分ける
function getMember(b) {
  const room = rooms.get(String(b.code || "").toUpperCase());
  if (!room) fail("部屋が見つかりません。");
  const player = room.players.find((p) => p.token === b.token);
  const sp = !player && room.spectators.find((x) => x.token === b.token);
  if (!player && !sp) fail("この部屋の参加者ではありません。");
  return { room, who: player || sp, spec: !!sp };
}

// チャットとスタンプの共通処理（連投は止める。古い発言は50件まで）
function addChat(room, who, spec, kind, text) {
  const now = Date.now();
  if (who.lastMsg && now - who.lastMsg < 700) fail("送信が早すぎます。少し待ってください。");
  who.lastMsg = now;
  room.chat.push({ name: who.name, spec, kind, text });
  if (room.chat.length > 50) room.chat.shift();
  push(room);
}

// 接続しないままの参加者（二重送信の片方など）を、60秒後にロビーから外す
function watchGhost(room, me) {
  setTimeout(() => {
    if (!me.connected && room.phase === "lobby" && room.players.includes(me)) removePlayer(room, me);
  }, 60000);
}

// 記録がなかった場合や、初期配置と同じ情報の場合は、手番を続けて調査できる
function isFreeResult(sc, res) {
  if (res.count === 0) return true;
  const known = sc.known.map(([c, r]) => c + "_" + r);
  if (res.type === "PLACE_TIME") return res.t === 1 && (sc.initAll || (res.char && known.includes(res.char + "_" + res.roomIdx)));
  return res.time === 1 && known.includes(res.name + "_" + res.roomIdx);
}

const actions = {
  create(b) {
    const room = { code: newCode(), phase: "lobby", si: 0, di: 0, players: [], log: [], clients: new Set(), scen: null, order: null, ti: 0, winner: null, spectators: [], chat: [], chatOn: true, made: Date.now() };
    const me = { id: rid(), token: rid() + rid(), name: cleanName(b.name, "探偵1"), cid: b.cid || null, alive: true, connected: false, verdict: null };
    room.players.push(me);
    rooms.set(room.code, room);
    watchGhost(room, me);
    return { code: room.code, token: me.token };
  },

  join(b) {
    const room = rooms.get(String(b.code || "").toUpperCase());
    if (!room) fail("部屋が見つかりません。");
    const dup = b.cid && room.players.find((p) => p.cid === b.cid);
    if (dup) return { code: room.code, token: dup.token }; // 二重送信は、同じ人として扱う
    if (b.spectate) {
      const dupS = b.cid && room.spectators.find((x) => x.cid === b.cid);
      if (dupS) return { code: room.code, token: dupS.token };
      if (room.spectators.length >= MAX_SPECTATORS) fail("観戦席が満員です。");
      const sp = { id: rid(), token: rid() + rid(), name: uniqueName(room, cleanName(b.name, "観戦者" + (room.spectators.length + 1))), cid: b.cid || null, connected: false };
      room.spectators.push(sp);
      watchSpecGhost(room, sp);
      push(room);
      return { code: room.code, token: sp.token };
    }
    if (room.phase !== "lobby") fail("この部屋はすでに始まっています。観戦なら、「観戦する」から入れます。");
    if (room.players.length >= MAX_PLAYERS) fail("この部屋は満員です。");
    const name = uniqueName(room, cleanName(b.name, "探偵" + (room.players.length + 1)));
    const me = { id: rid(), token: rid() + rid(), name, cid: b.cid || null, alive: true, connected: false, verdict: null };
    room.players.push(me);
    watchGhost(room, me);
    push(room);
    return { code: room.code, token: me.token };
  },

  config(b) {
    const { room, me } = getRoom(b);
    if (!me || me !== room.players[0] || room.phase !== "lobby") fail("操作できません。");
    if (E.SCENARIOS[b.si] && E.DIFFICULTIES[b.di]) { room.si = b.si; room.di = b.di; }
    if (typeof b.chatOn === "boolean") room.chatOn = b.chatOn;
    push(room);
  },

  start(b) {
    const { room, me } = getRoom(b);
    if (!me || me !== room.players[0] || room.phase !== "lobby") fail("操作できません。");
    const sc = E.generate(E.SCENARIOS[room.si], E.DIFFICULTIES[room.di]);
    if (!sc) fail("事件を生成できませんでした。もう一度お試しください。");
    Object.assign(room, { scen: sc, phase: "play", log: [], winner: null, order: shuffle(room.players.map((p) => p.id)), ti: 0, free: 0 });
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
    const free = isFreeResult(room.scen, res) && (room.free || 0) < 3; // 続けて調査できるのは連続3回まで
    room.log.push({ ...res, seq: room.log.length + 1, by: me.id, byName: me.name, free });
    if (free) room.free = (room.free || 0) + 1;
    else nextTurn(room);
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

  leave(b) {
    const room = rooms.get(String(b.code || "").toUpperCase());
    if (!room) return;
    const sp = room.spectators.find((x) => x.token === b.token);
    if (sp) return removeSpectator(room, sp);
    const me = room.players.find((p) => p.token === b.token);
    if (me && room.phase === "lobby") removePlayer(room, me);
  },

  chat(b) {
    const { room, who, spec } = getMember(b);
    if (!room.chatOn) fail("この部屋では、文字のチャットは使えません。");
    const text = String(b.text || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 60);
    if (!text) return;
    addChat(room, who, spec, "chat", text);
  },

  stamp(b) {
    const { room, who, spec } = getMember(b);
    const i = Number(b.i);
    if (!Number.isInteger(i) || !STAMPS[i]) fail("スタンプが正しくありません。");
    addChat(room, who, spec, "stamp", STAMPS[i]);
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
  const player = room && room.players.find((p) => p.token === q.get("token"));
  const sp = room && !player && room.spectators.find((x) => x.token === q.get("token"));
  const me = player || sp;
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
      if (room.phase === "lobby") watchGhost(room, me);
      if (sp) watchSpecGhost(room, me);
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
  // サーバーが起きているかを、画面から確かめるための窓口
  if (req.method === "GET" && url.pathname === "/api/ping") return send(res, 200, { ok: true });
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
