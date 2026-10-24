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
        <p class="mu"><a href="online.html" style="color:var(--gold)">👥 オンライン対戦（友達と遊ぶ）はこちら</a></p>
      </section>
    </main>`;
}

function board() {
  return boardHtml(S.scen, S.hist);
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
      ${mapSvg(u.room, sc.known)}
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
          <section class="card">${mapSvg(u.room, sc.known)}${roomLegend()}</section>
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