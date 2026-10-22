const E = Engine;
const { CHARS, ROOMS, NAMES } = E;

const COL = {
  A: "#2e7d32",
  B: "#6a1b9a",
  C: "#37474f",
  D: "#0277bd",
  J: "#f57f17",
  S: "#c62828"
};

const SEX = {
  冒険家: "♀",
  男爵夫人: "♀",
  運転手: "♂",
  探偵: "♂",
  記者: "♂",
  使用人: "♀"
};

const NCOL = ["#c9e7a4", "#dcc6f2", "#fff1a0", "#ffd2b0"];

const COND = [
  {
    d: "毒を盛るために、暗殺者はこの探偵と2人きりになる必要があった。",
    q: ["誰が探偵に毒を盛ったのか？", "どこで毒を盛ったのか？", "いつ毒を盛ったのか？"]
  },
  {
    d: "怪人は極めて用心深く、夜にはすべての時間において、いずれかの部屋に一人だけでいる唯一の人物である。",
    q: ["怪人は誰か？"]
  },
  {
    d: "時間1では、ネックレスはダンスホールにあった。ネックレスを盗んだのは、最も早い時間に1人でこの部屋にいた人物だ。その人物はネックレスを持って部屋を出た。その後、いずれかの場所でネックレスの所有者が他の人物1人だけと一緒になるたびに、宝石の所有者が変わる。この人物が1人だけでいる場合や、同じ場所に3人以上の人物がいる場合、所有者がネックレスを持ち続ける。",
    q: ["時間6で宝石を持っているのは誰か？", "この夜の終わりに警察が介入すべき場所はどこか？"]
  },
  {
    d: "警察によると、共犯者は男1人と女1人だった。時間6で爆発した爆弾を仕掛けたとき、彼らは2人きりだった",
    q: ["犯人は誰か？", "彼らはどの場所で何時に会ったか？", "爆発の犠牲者は誰だったか？"]
  },
  {
    d: "この夜のあいだ、他の招待客が共にいたかどうか問わず、一度も同じ部屋にいなかった男1人と女1人のカップルは1組だけだった。",
    q: ["呪われた恋人たちは誰か？"]
  }
];

const cond = (i) => `<div class="cond">${COND[i].d}<ol>${COND[i].q.map((x) => `<li>${x}</li>`).join("")}</ol></div>`;

// 解答フォームの項目（シナリオ順）
const FORMS = [
  [
    { k: "who", label: "1. 誰が探偵に毒を盛った？", type: "char" },
    { k: "room", label: "2. どこで毒を盛った？", type: "room" },
    { k: "time", label: "3. いつ毒を盛った？", type: "time" }
  ],
  [{ k: "who", label: "1. 怪人は誰？", type: "char" }],
  [
    { k: "who", label: "1. 時間6で宝石を持っているのは誰？", type: "char" },
    { k: "room", label: "2. 警察が介入すべき場所は？", type: "room" }
  ],
  [
    { k: "m", label: "1. 犯人（男性）", type: "male" },
    { k: "f", label: "1. 犯人（女性）", type: "female" },
    { k: "room", label: "2. 爆弾を仕掛けた場所", type: "room" },
    { k: "time", label: "2. 爆弾を仕掛けた時間", type: "time" },
    { k: "victims", label: "3. 爆発の被害者（複数選択可）", type: "chars" }
  ],
  [
    { k: "m", label: "1. 男性", type: "male" },
    { k: "f", label: "1. 女性", type: "female" }
  ]
];

const OPTS = {
  char: () => CHARS.map((n) => [n, `${n}(${NAMES[n]})`]),
  male: () => CHARS.filter((n) => SEX[n] === "♂").map((n) => [n, `${n}(${NAMES[n]})`]),
  female: () => CHARS.filter((n) => SEX[n] === "♀").map((n) => [n, `${n}(${NAMES[n]})`]),
  room: () => ROOMS.map((r, i) => [i, r]),
  time: () => [1, 2, 3, 4, 5, 6].map((t) => [t, `時間${t}`])
};

const S = {
  scen: null,
  ans: {},
  done: false,
  result: null,
  t0: 0,
  t1: 0,
  hist: [],
  last: null,
  notes: [],
  nid: 1,
  u: {
    si: 0,
    di: 0,
    mode: "time",
    room: 0,
    time: 1,
    ci: 0,
    filter: "all",
    tab: "log",
    rail: true,
    map: false
  }
};

const $ = document.getElementById("app");
const bd = (c) => `<span class="bd" style="background:${COL[c]}">${c}</span>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const chip = (act, v, label, on) => `<button class="chip ${on ? "on" : ""}" data-act="${act}" data-v="${v}">${label}</button>`;

function start() {
  const u = S.u;
  $.innerHTML = `
    <main class="start">
      <h1>KRONOLOGIC: PARIS 1920</h1>
      <p class="sub">ソロ捜査モード</p>
      <section class="card">
        <h2>⚙️ ミッション設定</h2>
        <b>シナリオ</b>
        <div class="opts">
          ${E.SCENARIOS.map((s, i) => chip("si", i, s, u.si === i)).join("")}
        </div>
        ${cond(u.si)}
        <b>難易度</b>
        <div class="opts">
          ${E.DIFFICULTIES.map((s, i) => chip("di", i, s, u.di === i)).join("")}
        </div>
        <button class="go" data-act="go">🎲 ゲームを始める</button>
      </section>
    </main>`;
}

function mapSvg(sel) {
  const R = [
    [20, 40, "#4a3326", "#c9a24b"],
    [220, 40, "#1e2a40", "#5b8bd9"],
    [120, 120, "#3d2c10", "#b8860b"],
    [120, 200, "#2a1f26", "#8a7a6a"],
    [20, 280, "#3d2c10", "#d4a72c"],
    [220, 280, "#143a38", "#2bb3a5"]
  ];
  const L = [
    [140, 65, 220, 65],
    [80, 90, 150, 120],
    [280, 90, 210, 120],
    [180, 170, 180, 200],
    [150, 250, 80, 280],
    [210, 250, 280, 280],
    [140, 305, 220, 305]
  ];

  return `
    <svg viewBox="0 0 360 340" width="100%" style="background:#10121a;border-radius:8px">
      ${L.map((l) => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="#fff" stroke-width="3"/>`).join("")}
      ${R.map((r, i) => `
        <rect class="rm ${i === sel ? "sel" : ""}" x="${r[0]}" y="${r[1]}" width="120" height="50" rx="3" fill="${r[2]}" stroke="${r[3]}" stroke-width="2"/>
        <text x="${r[0] + 60}" y="${r[1] + 30}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">${ROOMS[i]}</text>
      `).join("")}
    </svg>`;
}

function board() {
  const tc = {}, pc = {};
  const sc = S.scen;

  sc.known.forEach(([c, r]) => {
    (tc[r + "_1"] ||= { n: null, w: new Set() }).w.add(NAMES[c]);
    (pc[c + "_" + r] ||= { n: null, t: new Set() }).t.add(1);
  });

  if (sc.initAll) {
    ROOMS.forEach((_, r) => {
      const c = (tc[r + "_1"] ||= { n: null, w: new Set() });
      c.n = c.w.size;
    });
  }

  S.hist.forEach((h) => {
    if (h.type === "PLACE_TIME") {
      const c = (tc[h.roomIdx + "_" + h.t] ||= { n: null, w: new Set() });
      c.n = h.count;
      if (h.char) c.w.add(NAMES[h.char]);
    } else {
      const c = (pc[h.name + "_" + h.roomIdx] ||= { n: null, t: new Set() });
      c.n = h.count;
      if (h.time !== null) c.t.add(h.time);
    }
  });

  const t1 = ROOMS.map((r, i) => `
    <tr>
      <th>${r}</th>
      ${[1, 2, 3, 4, 5, 6].map((t) => {
        const c = tc[i + "_" + t];
        return `<td>${c ? ((c.n === null ? "" : "👥" + c.n) + (c.w.size ? " [" + [...c.w].sort().join(",") + "]" : "")).trim() : "・"}</td>`;
      }).join("")}
    </tr>`).join("");

  const t2 = CHARS.map((n) => `
    <tr>
      <th>${n}(${NAMES[n]})</th>
      ${ROOMS.map((_, i) => {
        const c = pc[n + "_" + i];
        return `<td>${c ? (c.n === null ? "" : c.n + "回") + (c.t.size ? (c.n === null ? "" : " ") + "t" + [...c.t].sort().join(",") : "") : "・"}</td>`;
      }).join("")}
    </tr>`).join("");

  return `
    <b>⏳ 場所 × 時間</b>
    <table>
      <tr><th></th>${[1, 2, 3, 4, 5, 6].map((t) => `<th>時間${t}</th>`).join("")}</tr>
      ${t1}
    </table>
    <b>🎴 人物 × 場所</b>
    <table>
      <tr><th></th>${ROOMS.map((r) => `<th>${r}</th>`).join("")}</tr>
      ${t2}
    </table>`;
}

// 解答フォーム（提出前）
function answerForm() {
  const fields = FORMS[S.u.si].map((f) => {
    if (f.type === "chars") {
      const sel = S.ans[f.k] || [];
      return `
        <div class="fld">
          <label>${f.label}</label>
          <div class="opts">${CHARS.map((n) => chip("vic", n, `${n}(${NAMES[n]})`, sel.includes(n))).join("")}</div>
        </div>`;
    }
    const options = OPTS[f.type]().map(([v, l]) => `<option value="${v}" ${String(S.ans[f.k]) === String(v) ? "selected" : ""}>${l}</option>`).join("");
    return `
      <div class="fld">
        <label>${f.label}</label>
        <select data-ans="${f.k}"><option value="">— 選択 —</option>${options}</select>
      </div>`;
  });

  return `
    <h2>📝 解答</h2>
    <p class="mu">解答は1回しか提出できません。</p>
    <div class="flds">${fields.join("")}</div>
    <button class="run" data-act="submit">📝 解答を提出（1回限り）</button>
    <button class="ghost" data-act="giveup">🏳 降参して答えを見る</button>`;
}

// 結果と真相（提出後・降参後）
function resultView() {
  const sc = S.scen;
  const sec = Math.round((S.t1 - S.t0) / 1000);
  const time = `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, "0")}秒`;
  const allOk = S.result && S.result.every((r) => r.ok);
  const head = !S.result ? "🏳 降参" : allOk ? "🎉 正解！事件解決" : "❌ 不正解";
  const rows = S.result
    ? `<ul class="rs">${S.result.map((r) => `<li>${r.ok ? "✅" : "❌"} ${r.label}</li>`).join("")}</ul>`
    : "";

  return `
    <h2>${head}</h2>
    <p class="mu">調査 ${S.hist.length} 回 ／ 所要時間 ${time}</p>
    ${rows}
    <b>🔎 真相</b>
    <p><b>${sc.sol.join("<br>")}</b></p>
    <table>
      <tr><th></th>${[1, 2, 3, 4, 5, 6].map((t) => `<th>時間${t}</th>`).join("")}</tr>
      ${ROOMS.map((r, i) => `
        <tr>
          <th>${r}</th>${sc.occ[i].map((o) => `<td>${o.map((c) => bd(NAMES[c])).join(" ") || "-"}</td>`).join("")}
        </tr>`).join("")}
    </table>
    <div class="opts">
      <button class="chip" data-act="replay">🎲 同じ設定でもう一度</button>
      <button class="chip" data-act="back">⚙️ 設定に戻る</button>
    </div>`;
}

function answerCard() {
  return `<section class="card ${S.done ? "result" : ""}">${S.done ? resultView() : answerForm()}</section>`;
}

// 新しい事件を作って開始する（失敗したら false）
function startGame() {
  const u = S.u;
  const s = E.generate(E.SCENARIOS[u.si], E.DIFFICULTIES[u.di]);
  if (!s) {
    alert("条件を満たす問題を生成できませんでした。もう一度お試しください。");
    return false;
  }
  Object.assign(S, { scen: s, hist: [], last: null, notes: [], ans: {}, done: false, result: null, t0: Date.now(), t1: 0 });
  Object.assign(u, { tab: "log", filter: "all", map: false });
  return true;
}

function game() {
  const u = S.u, sc = S.scen, tm = u.mode === "time", mapOpen = u.tab === "board" && u.map;
  const drawer = mapOpen ? `
    <aside class="mapdrawer">
      <div style="display:flex;justify-content:space-between">
        <h2 style="font-size:1.1rem">🗺 館内マップ</h2>
        <button class="chip" data-act="map" title="閉じる">✕</button>
      </div>
      ${mapSvg(u.room)}
    </aside>` : "";

  const log = S.hist.filter((h) => u.filter === "all" || (u.filter === "time") === (h.type === "PLACE_TIME")).reverse()
    .map((h) => `
      <div class="log">
        <b>調査 ${h.seq}</b> ${h.type === "PLACE_TIME" ? `⏳ 【${h.room}】×【時間 ${h.t}】` : `🎴 【${h.room}】×【${h.character}】`}<br>
        ${h.shared}<br>${h.priv}
      </div>`).join("") || '<p class="mu">まだ調査を行っていません。</p>';


  const notes = S.notes.map((n) => `
    <div class="note" style="background:${n.c}">
      <textarea data-note="${n.id}" placeholder="例: Dは時間3に舞台にいた">${esc(n.t)}</textarea>
      <button data-act="del" data-v="${n.id}">🗑️ 削除</button>
    </div>`).join("");

  $.innerHTML = `
    <div class="game ${u.rail ? "" : "noright"} ${mapOpen ? "mapopen" : ""}">
      <aside class="left">
        <h2 style="font-size:1.1rem">KRONOLOGIC</h2>
        <b>👥 登場人物</b>
        <div class="cast">
          ${CHARS.map((n) => `<div><div class="av" style="background:${COL[NAMES[n]]}">${NAMES[n]}</div>${n}${SEX[n]}</div>`).join("")}
        </div>
        <b>📖 シナリオの条件</b>
        ${cond(u.si)}
        <button class="ghost" data-act="back">← 設定に戻る</button>
      </aside>

      <main class="center">
        <p class="mu">${sc.type} ／ 難易度 ${sc.diff} ／ 調査 ${S.hist.length} 回</p>
        <div class="row">
          <section class="card">${mapSvg(u.room)}</section>
          <section class="card">
            <h2>🕵️ 調査</h2>
            <div class="opts">
              ${chip("mode", "time", "⏳ 時間調査", tm)}
              ${chip("mode", "person", "🎴 人物調査", !tm)}
            </div>
            <b>場所</b><br>
            <select data-sel="room">
              ${ROOMS.map((r, i) => `<option value="${i}" ${u.room === i ? "selected" : ""}>${r}</option>`).join("")}
            </select>
            <div class="opts">
              ${tm
                ? [1, 2, 3, 4, 5, 6].map((t) => chip("time", t, "時間" + t, u.time === t)).join("")
                : CHARS.map((n, i) => chip("ci", i, `${n}(${NAMES[n]})`, u.ci === i)).join("")}
            </div>
            ${S.done
              ? '<p class="mu">🔒 解答済みのため、調査はできません。</p>'
              : '<button class="run" data-act="run">🔎 重ね合わせ実行</button>'}
            ${S.last ? `<div class="res sh">${S.last.shared}</div><div class="res pv">${S.last.priv}</div>` : ""}
          </section>
        </div>

        <section class="card">
          <b>📍 初期情報</b>
          ${sc.clues.map((c) => `<div class="log">${c}</div>`).join("")}
        </section>

        <section class="card">
          <div class="opts">
            ${chip("tab", "log", "📜 調査記録", u.tab === "log")}
            ${chip("tab", "board", "🧮 判明ボード", u.tab === "board")}
            ${u.tab === "board" ? chip("map", "", u.map ? "🗺 マップを閉じる" : "🗺 マップを横に表示", u.map) : ""}
          </div>
          ${u.tab === "log"
            ? `<div class="opts">
                ${chip("filter", "all", "すべて", u.filter === "all")}
                ${chip("filter", "time", "⏳ 時間のみ", u.filter === "time")}
                ${chip("filter", "person", "🎴 人物のみ", u.filter === "person")}
              </div>${log}`
            : board()}
        </section>

        ${answerCard()}
      </main>

      ${u.rail
        ? `<aside class="right">
            <div style="display:flex;justify-content:space-between">
              <h2 style="font-size:1.1rem">📌 付箋メモ</h2>
              <button class="chip" data-act="rail" title="閉じる">▷</button>
            </div>
            <button class="ghost" data-act="add">＋ 付箋を追加</button>
            ${notes}
          </aside>`
        : `<button class="edge" data-act="rail">◁ 付箋</button>`
      }
      ${drawer}
    </div>`;
}

const draw = () => (S.scen ? game() : start());

$.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const a = b.dataset.act, v = b.dataset.v, u = S.u;

  if (a === "si") u.si = +v;
  else if (a === "di") u.di = +v;
  else if (a === "go" || a === "replay") {
    if (!startGame()) return;
  } else if (a === "back") {
    if (!S.done && !confirm("設定に戻ると、調査記録と付箋が消えます。よろしいですか？")) return;
    S.scen = null;
  } else if (a === "mode") u.mode = v;
  else if (a === "time") u.time = +v;
  else if (a === "ci") u.ci = +v;
  else if (a === "run" && !S.done) {
    const r = u.mode === "time"
      ? E.inquirePlaceTime(S.scen, u.room, u.time)
      : E.inquirePlacePerson(S.scen, u.room, CHARS[u.ci]);
    r.seq = S.hist.length + 1;
    S.hist.push(r);
    S.last = r;
  } else if (a === "tab") u.tab = v;
  else if (a === "filter") u.filter = v;
  else if (a === "vic") {
    const list = (S.ans.victims ||= []);
    const i = list.indexOf(v);
    if (i < 0) list.push(v);
    else list.splice(i, 1);
  } else if (a === "submit") {
    const filled = FORMS[u.si].every((f) => (f.type === "chars" ? (S.ans[f.k] || []).length : S.ans[f.k]));
    if (!filled) return alert("すべての項目を入力してください。");
    if (!confirm("解答は1回限りです。この内容で提出しますか？")) return;
    S.result = E.judge(S.scen, S.ans);
    S.done = true;
    S.t1 = Date.now();
  } else if (a === "giveup") {
    if (!confirm("降参すると答えが表示され、この事件は終了します。よろしいですか？")) return;
    S.result = null;
    S.done = true;
    S.t1 = Date.now();
  }
  else if (a === "rail") u.rail = !u.rail;
  else if (a === "map") u.map = !u.map;
  else if (a === "add") {
    S.notes.unshift({ id: S.nid, t: "", c: NCOL[(S.nid - 1) % 4] });
    S.nid++;
  } else if (a === "del") {
    S.notes = S.notes.filter((n) => n.id !== +v);
  }

  draw();
});

$.addEventListener("change", (e) => {
  if (e.target.dataset.ans) S.ans[e.target.dataset.ans] = e.target.value;

  if (e.target.dataset.sel === "room") {
    S.u.room = +e.target.value;
    draw();
  }
});

$.addEventListener("input", (e) => {
  const n = S.notes.find((x) => x.id === +e.target.dataset.note);
  if (n) n.t = e.target.value;
});

draw();