// オンライン対戦の画面（手番制）。共通の部品は common.js にある。
const API = window.SERVER_URL || "";
const $ = document.getElementById("app");

let V = null; // サーバーから届いた最新の状態
let SES = JSON.parse(sessionStorage.getItem("kr") || "null"); // { code, token }
let ES = null;
let BUSY = false; // 通信中は、ボタンの二重押しを受け付けない

// このタブを見分けるための番号（同じタブからの二重の参加を、同じ人として扱うため）
const CID = sessionStorage.getItem("krcid") || (() => {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem("krcid", id);
  return id;
})();

const U = {
  name: localStorage.getItem("krname") || "",
  code: "",
  mode: "time",
  room: 0,
  time: 1,
  ci: 0,
  ans: {},
  answering: false,
  tab: "log",
  map: false,
  rail: true,
  msg: "",
  invited: false,
  err: ""
};

// 招待リンク（?room=ABCD）で開かれたときは、部屋コードを入れておく
const qs = new URLSearchParams(location.search);
if (qs.get("room")) {
  U.code = qs.get("room").toUpperCase().slice(0, 4);
  U.invited = true;
}

// 付箋メモ（自分の画面だけに保存。部屋ごとに、このタブの中で保持）
let NOTES = [];
let NID = 1;
let NOTES_CODE = null;
let PENDING = false;

function loadNotes() {
  if (NOTES_CODE === V.code) return;
  NOTES_CODE = V.code;
  const s = JSON.parse(sessionStorage.getItem("krn_" + V.code) || "null") || { notes: [], nid: 1 };
  NOTES = s.notes;
  NID = s.nid;
}

const saveNotes = () => sessionStorage.setItem("krn_" + V.code, JSON.stringify({ notes: NOTES, nid: NID }));

async function post(path, body) {
  try {
    const r = await fetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, cid: CID, ...(SES || {}) })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "エラーが発生しました。");
    U.err = "";
    return j;
  } catch (e) {
    U.err = e.message;
    render();
    return null;
  }
}

function connect() {
  if (ES) ES.close();
  if (!SES) return;
  ES = new EventSource(`${API}/api/events?code=${SES.code}&token=${SES.token}`);
  ES.onmessage = (e) => {
    V = JSON.parse(e.data);
    // 付箋を入力している最中は、画面の作り直しを後回しにする
    if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.note) PENDING = true;
    else render();
  };
  ES.onerror = () => {
    if (ES.readyState === 2) reset("部屋に接続できませんでした。");
  };
}

function reset(msg) {
  if (ES) ES.close();
  sessionStorage.removeItem("kr");
  SES = null;
  V = null;
  U.err = msg || "";
  render();
}

function home() {
  $.innerHTML = `
    <main class="start">
      <h1>KRONOLOGIC: PARIS 1920</h1>
      <p class="sub">オンライン対戦（手番制・最大4人）</p>
      ${U.invited ? `<section class="card result"><b>📨 部屋 ${esc(U.code)} に招待されています</b><p class="mu">名前を入れて「参加する」を押してください。</p></section>` : ""}
      <section class="card">
        <b>名前</b><br>
        <input id="nm" maxlength="12" value="${esc(U.name)}" placeholder="あなたの名前">
        <button class="go" data-act="create" ${BUSY ? "disabled" : ""}>🎲 部屋を作る</button>
        <hr style="border-color:var(--line);margin:1.2rem 0">
        <b>部屋コードで参加</b><br>
        <input id="cd" maxlength="4" value="${esc(U.code)}" placeholder="ABCD" style="text-transform:uppercase">
        <button class="go" data-act="join" ${BUSY ? "disabled" : ""}>🚪 参加する</button>
        ${BUSY ? '<p class="mu">⏳ サーバーに接続中…（しばらく使っていないと、最初は1分ほどかかります）</p>' : ""}
        ${U.err ? `<p class="err">${esc(U.err)}</p>` : ""}
        ${window.__install ? '<button class="ghost" data-act="install">📲 アプリとしてインストール</button>' : ""}
        <details class="mu">
          <summary>📲 アプリとして使うには</summary>
          <p>PCのChrome / Edgeは、アドレスバーの右にあるインストールのアイコンから。iPhoneは、Safariの共有ボタンから「ホーム画面に追加」を選びます。</p>
        </details>
        <p class="mu"><a href="index.html" style="color:var(--gold)">← 1人用はこちら</a></p>
      </section>
    </main>`;
}

function lobby() {
  NOTES = [];
  NID = 1;
  NOTES_CODE = V.code;
  sessionStorage.removeItem("krn_" + V.code);
  const host = V.host === V.you;
  $.innerHTML = `
    <main class="start">
      <h1>部屋コード</h1>
      <div class="big">${V.code}</div>
      <button class="ghost" data-act="invite">📨 招待リンクを共有・コピー</button>
      ${U.msg ? `<p class="mu">${esc(U.msg)}</p>` : '<p class="mu">リンクを送ると、押すだけで、この部屋に入れます。</p>'}
      <section class="card">
        <b>参加者（${V.players.length}/4）</b>
        ${V.players.map((p) => `<div class="log">${esc(p.name)}${p.id === V.host ? " 👑" : ""}${p.id === V.you ? "（あなた）" : ""}</div>`).join("")}
      </section>
      <section class="card">
        <h2>⚙️ ミッション設定</h2>
        ${host
          ? `<b>シナリオ</b><div class="opts">${E.SCENARIOS.map((s, i) => chip("si", i, s, V.si === i)).join("")}</div>
             ${cond(V.si)}
             <b>難易度</b><div class="opts">${E.DIFFICULTIES.map((s, i) => chip("di", i, s, V.di === i)).join("")}</div>
             <button class="go" data-act="start">▶ ゲームを始める</button>`
          : `<p>${E.SCENARIOS[V.si]} ／ ${E.DIFFICULTIES[V.di]}</p>${cond(V.si)}<p class="mu">部屋の主が開始するのを待っています…</p>`}
        ${U.err ? `<p class="err">${esc(U.err)}</p>` : ""}
      </section>
      <button class="ghost" data-act="leave">← 退出する</button>
    </main>`;
}

function answerForm() {
  const fields = FORMS[V.si].map((f) => {
    if (f.type === "chars") {
      const sel = U.ans[f.k] || [];
      return `<div class="fld"><label>${f.label}</label><div class="opts">${CHARS.map((n) => chip("vic", n, `${n}(${NAMES[n]})`, sel.includes(n))).join("")}</div></div>`;
    }
    const options = OPTS[f.type]().map(([v, l]) => `<option value="${v}" ${String(U.ans[f.k]) === String(v) ? "selected" : ""}>${l}</option>`).join("");
    return `<div class="fld"><label>${f.label}</label><select data-ans="${f.k}"><option value="">— 選択 —</option>${options}</select></div>`;
  });
  return `
    <p class="mu">解答は1回限りです。間違えるとその場で脱落します。</p>
    <div class="flds">${fields.join("")}</div>
    <button class="run" data-act="submit">📝 この内容で解答する</button>`;
}

function game() {
  const me = V.players.find((p) => p.id === V.you);
  const sc = V.scenario;
  const ended = V.phase === "end";
  const myTurn = !ended && V.turn === V.you && me.alive;
  const turnName = (V.players.find((p) => p.id === V.turn) || {}).name;
  const winner = V.players.find((p) => p.id === V.winner);
  const last = V.log[V.log.length - 1];
  loadNotes();
  const mapOpen = U.tab === "board" && U.map;
  const again = myTurn && last && last.by === V.you && last.free; // 続けて調査できる状態

  const banner = ended
    ? `<h2>${winner ? `🏆 ${esc(winner.name)} が事件を解決！` : "😵 全員が脱落…事件は迷宮入り"}</h2>`
    : myTurn
    ? `<h2>👉 あなたの手番です${again ? "（もう一度調査できます）" : ""}</h2>`
    : me.alive
    ? `<h2>⏳ ${esc(turnName || "")} の手番です</h2>`
    : `<h2>❌ あなたは脱落しました（観戦中）</h2>`;

  const feed = V.log.slice().reverse().map((l) => `
    <div class="log">
      <b>#${l.seq} ${esc(l.byName)}</b>
      ${l.type === "PLACE_TIME" ? `⏳ 【${l.room}】×【時間 ${l.t}】` : `🎴 【${l.room}】×【${l.character}】`}<br>
      ${l.shared}${l.priv ? `<br>${l.priv}` : ""}${l.free ? '<br><span class="mu">🔁 手番は続きます（記録なし／初期情報と同じ）</span>' : ""}
    </div>`).join("") || '<p class="mu">まだ調査はありません。</p>';

  const players = V.players.map((p) => `
    <div class="log ${p.id === V.turn && !ended ? "turn" : ""}">
      ${p.id === V.turn && !ended ? "👉 " : ""}${esc(p.name)}${p.id === V.you ? "（あなた）" : ""}
      ${p.verdict === "correct" ? "🏆" : !p.alive ? "❌脱落" : ""}${p.connected ? "" : " 📴"}
    </div>`).join("");

  const inquiry = ended
    ? ""
    : myTurn
    ? `<div class="opts">${chip("mode", "time", "⏳ 時間調査", U.mode === "time")}${chip("mode", "person", "🎴 人物調査", U.mode === "person")}</div>
       <b>場所</b><br>
       <select data-sel="room">${ROOMS.map((r, i) => `<option value="${i}" ${U.room === i ? "selected" : ""}>${r}</option>`).join("")}</select>
       <div class="opts">${U.mode === "time"
         ? [1, 2, 3, 4, 5, 6].map((t) => chip("time", t, "時間" + t, U.time === t)).join("")
         : CHARS.map((n, i) => chip("ci", i, `${n}(${NAMES[n]})`, U.ci === i)).join("")}</div>
       <button class="run" data-act="run">🔎 調査する</button>
       <p class="mu">※ 記録がなかったときや、初期配置と同じ情報のときは、もう一度調査できます（連続3回まで）。</p>
       <button class="ghost" data-act="toggleAns">${U.answering ? "解答をやめる" : "📝 調査せずに解答する"}</button>
       ${U.answering ? answerForm() : ""}`
    : `<p class="mu">自分の手番になるまで、他の人の調査を見て推理しましょう。</p>`;

  const reveal = ended
    ? `<section class="card result"><b>🔎 真相</b><p><b>${V.reveal.sol.join("<br>")}</b></p>
        <table>
          <tr><th></th>${[1, 2, 3, 4, 5, 6].map((t) => `<th>時間${t}</th>`).join("")}</tr>
          ${ROOMS.map((r, i) => `<tr><th>${r}</th>${V.reveal.occ[i].map((o) => `<td>${o.map((c) => bd(NAMES[c])).join(" ") || "-"}</td>`).join("")}</tr>`).join("")}
        </table>
        ${V.host === V.you ? '<button class="go" data-act="again">🎲 もう一度（ロビーへ戻る）</button>' : '<p class="mu">部屋の主が、次の事件を始めるのを待ちましょう。</p>'}
        <button class="ghost" data-act="leave">← 退出する</button>
      </section>`
    : "";

  const notesHtml = NOTES.map((n) => `
    <div class="note" style="background:${n.c}">
      <textarea data-note="${n.id}" placeholder="例: Dは時間3に舞台にいた">${esc(n.t)}</textarea>
      <button data-act="del" data-v="${n.id}">🗑️ 削除</button>
    </div>`).join("");

  const rail = U.rail
    ? `<aside class="right">
        <div style="display:flex;justify-content:space-between">
          <h2 style="font-size:1.1rem">📌 付箋メモ</h2>
          <button class="chip" data-act="rail" title="閉じる">▷</button>
        </div>
        <button class="ghost" data-act="add">＋ 付箋を追加</button>
        ${notesHtml}
      </aside>`
    : `<button class="edge" data-act="rail">◁ 付箋</button>`;

  const drawer = mapOpen
    ? `<aside class="mapdrawer">
        <div style="display:flex;justify-content:space-between">
          <h2 style="font-size:1.1rem">🗺 館内マップ</h2>
          <button class="chip" data-act="map" title="閉じる">✕</button>
        </div>
        ${mapSvg(U.room, sc.known)}
      </aside>`
    : "";

  $.innerHTML = `
    <div class="game ${U.rail ? "" : "noright"} ${mapOpen ? "mapopen" : ""}">
      <aside class="left">
        <h2 style="font-size:1.1rem">部屋 ${V.code}</h2>
        <b>👥 プレイヤー</b>${players}
        <b>📖 シナリオの条件</b>${cond(V.si)}
      </aside>
      <main class="center">
        <p class="mu">${sc.type} ／ 難易度 ${sc.diff} ／ 調査 ${V.log.length} 回</p>
        <section class="card ${myTurn ? "result" : ""}">${banner}${U.err ? `<p class="err">${esc(U.err)}</p>` : ""}</section>
        <div class="row">
          <section class="card">${mapSvg(U.room, sc.known)}${roomLegend()}</section>
          <section class="card"><h2>🕵️ 調査</h2>${inquiry}</section>
        </div>
        ${reveal}
        <section class="card"><b>📍 初期情報</b>${sc.clues.map((c) => `<div class="log">${c}</div>`).join("")}</section>
        <section class="card">
          <div class="opts">
            ${chip("tab", "log", "📜 みんなの調査記録", U.tab === "log")}
            ${chip("tab", "board", "🧮 判明ボード", U.tab === "board")}
            ${U.tab === "board" ? chip("map", "", U.map ? "🗺 マップを閉じる" : "🗺 マップを横に表示", U.map) : ""}
          </div>
          ${U.tab === "log"
            ? feed
            : `<p class="mu">他の人の調査からは「人数」だけがわかります。人物や時間は、調べた本人にだけ見えます。</p>${boardHtml(sc, V.log)}`}
        </section>
      </main>
      ${rail}
      ${drawer}
    </div>`;
}

function render() {
  PENDING = false;
  if (!V) home();
  else if (V.phase === "lobby") lobby();
  else game();
}

$.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;

  if (a === "create" || a === "join") {
    if (BUSY) return;
    BUSY = true;
    render();
    localStorage.setItem("krname", U.name);
    const j = await post("/api/" + a, { name: U.name, code: U.code.toUpperCase() });
    BUSY = false;
    if (!j) return render();
    SES = { code: j.code, token: j.token };
    sessionStorage.setItem("kr", JSON.stringify(SES));
    return connect();
  }
  if (a === "si" || a === "di") return post("/api/config", { si: a === "si" ? +v : V.si, di: a === "di" ? +v : V.di });
  if (a === "start" || a === "again") return post("/api/" + a, {});
  if (a === "invite") {
    const url = `${location.origin}${location.pathname}?room=${V.code}`;
    const text = `KRONOLOGICで対戦しよう！ 部屋コード: ${V.code}`;
    try {
      if (navigator.share) await navigator.share({ title: "KRONOLOGIC", text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        flash("招待リンクをコピーしました。友達に送ってください。");
      }
    } catch (err) {
      if (err && err.name !== "AbortError") prompt("このリンクをコピーして送ってください", url);
    }
    return;
  }
  if (a === "install") {
    if (window.__install) await window.__install.prompt();
    window.__install = null;
    return render();
  }
  if (a === "leave") {
    if (V && V.phase === "lobby") await post("/api/leave", {});
    return reset();
  }
  if (a === "run") {
    const j = await post("/api/inquire", { mode: U.mode, room: U.room, time: U.time, char: CHARS[U.ci] });
    if (j) U.answering = false;
    return;
  }
  if (a === "submit") {
    const filled = FORMS[V.si].every((f) => (f.type === "chars" ? (U.ans[f.k] || []).length : U.ans[f.k]));
    if (!filled) return alert("すべての項目を入力してください。");
    if (!confirm("解答は1回限りです。間違えると脱落します。提出しますか？")) return;
    const j = await post("/api/answer", { input: U.ans });
    if (j) { U.ans = {}; U.answering = false; }
    return;
  }
  if (a === "mode") U.mode = v;
  else if (a === "time") U.time = +v;
  else if (a === "ci") U.ci = +v;
  else if (a === "toggleAns") U.answering = !U.answering;
  else if (a === "tab") U.tab = v;
  else if (a === "map") U.map = !U.map;
  else if (a === "rail") U.rail = !U.rail;
  else if (a === "add") {
    NOTES.unshift({ id: NID, t: "", c: NCOL[(NID - 1) % 4] });
    NID++;
    saveNotes();
  } else if (a === "del") {
    NOTES = NOTES.filter((n) => n.id !== +v);
    saveNotes();
  }
  else if (a === "vic") {
    const list = (U.ans.victims ||= []);
    const i = list.indexOf(v);
    if (i < 0) list.push(v);
    else list.splice(i, 1);
  }
  render();
});

$.addEventListener("change", (e) => {
  if (e.target.dataset.ans) U.ans[e.target.dataset.ans] = e.target.value;
  if (e.target.dataset.sel === "room") {
    U.room = +e.target.value;
    render();
  }
});

$.addEventListener("input", (e) => {
  const n = NOTES.find((x) => x.id === +e.target.dataset.note);
  if (n) {
    n.t = e.target.value;
    saveNotes();
  }
  if (e.target.id === "nm") U.name = e.target.value;
  if (e.target.id === "cd") U.code = e.target.value;
});

// 付箋の入力が終わったら、後回しにしていた画面の更新を行う
$.addEventListener("focusout", (e) => {
  if (PENDING && e.target.dataset.note) setTimeout(() => PENDING && render(), 800);
});

// 短いお知らせを、2.5秒だけ表示する
function flash(msg) {
  U.msg = msg;
  render();
  setTimeout(() => {
    U.msg = "";
    render();
  }, 2500);
}

// インストールできる状態になったら、入口の画面にボタンを出す
window.addEventListener("pwa-ready", () => {
  if (!V) render();
});

connect();
render();
