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

// ゲームのタイトル（ここを書き換えると、画面のタイトルが変わります）
const TITLE = "オペラ座の時間推理 1920";
const DISCLAIMER = "非公式のファン制作です。出版元や原作とは関係がありません。実物のボードゲームをお持ちの方向けの、練習用ツールです。";

const COND = [
  {
    d: "犯人は、探偵と二人だけになれたときにしか、毒を盛ることができなかった。",
    q: ["探偵に毒を盛ったのは誰か？", "毒を盛ったのはどの場所か？", "毒を盛ったのはいつか？"]
  },
  {
    d: "怪人は決して人目につかない。夜のあいだ、どの時間も、部屋でたった一人きりでいる人物が、ちょうど1人だけいる。それが怪人である。",
    q: ["怪人は誰か？"]
  },
  {
    d: "時間1、首飾りはダンスホールにあった。それを持ち出したのは、ダンスホールで最初に一人きりになった人物である。以後、首飾りの持ち主は、ちょうど1人の相手と同じ部屋になるたびに、その相手へ首飾りを渡してしまう。持ち主が一人でいるときや、3人以上の部屋にいるときは、手放さない。",
    q: ["時間6で首飾りを持っているのは誰か？", "夜の終わりに、警察が向かうべき場所はどこか？"]
  },
  {
    d: "共犯者は、男性1人と女性1人。二人は、周りに誰もいない状況で爆弾を仕掛けた。爆弾は、夜の終わり（時間6）に爆発した。",
    q: ["共犯者の二人は誰か？", "爆弾はどこで、いつ仕掛けられたか？", "爆発に巻き込まれたのは誰か？"]
  },
  {
    d: "他の人がいたかどうかに関係なく、夜のあいだ一度も同じ部屋に居合わせなかった男女の組は、ちょうど1組だけある。",
    q: ["その男女の二人は誰か？"]
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

// 登場人物の一覧（男女がわかるように、♂♀を付ける）
const castHtml = () => `
  <div class="cast">
    ${CHARS.map((n) => `<div><div class="av" style="background:${COL[NAMES[n]]}">${NAMES[n]}</div>${n}${SEX[n]}</div>`).join("")}
  </div>`;

const bd = (c) => `<span class="bd" style="background:${COL[c]}">${c}</span>`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const chip = (act, v, label, on) => `<button class="chip ${on ? "on" : ""}" data-act="${act}" data-v="${v}">${label}</button>`;

// 付箋の大きさ（高さ）を、いま画面にあるものから読み取って、付箋のデータに記録する（変わったら true）
function syncNoteSizes(notes) {
  if (!document.querySelectorAll) return false;
  let changed = false;
  document.querySelectorAll("textarea[data-note]").forEach((el) => {
    const n = notes.find((x) => x.id === +el.dataset.note);
    const h = Math.round(el.offsetHeight);
    if (n && h > 20 && n.h !== h) {
      n.h = h;
      changed = true;
    }
  });
  return changed;
}

// 付箋を、上（-1）か下（+1）へ入れ替える
function moveNote(notes, id, d) {
  const i = notes.findIndex((n) => n.id === id);
  const j = i + d;
  if (i < 0 || j < 0 || j >= notes.length) return;
  [notes[i], notes[j]] = [notes[j], notes[i]];
}

// 付箋1枚のHTML（保存した大きさ・並べ替えボタン付き）
const noteHtml = (n) => `
  <div class="note" style="background:${n.c}">
    <textarea data-note="${n.id}" style="height:${n.h || 80}px" placeholder="例: Dは時間3に舞台にいた">${esc(n.t)}</textarea>
    <div class="nb">
      <button data-act="nup" data-v="${n.id}" title="上へ">▲</button>
      <button data-act="ndown" data-v="${n.id}" title="下へ">▼</button>
      <button data-act="del" data-v="${n.id}">🗑️ 削除</button>
    </div>
  </div>`;

// 館内マップ。sel: 光らせる部屋、known: 時間1の初期配置 [[人物名, 部屋番号], ...]
function mapSvg(sel, known = []) {
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

  // 部屋の中に、時間1にいる人物を丸いバッジで表示する
  const tokens = (r, i) => {
    const codes = known.filter(([, ri]) => ri === i).map(([n]) => NAMES[n]);
    return codes.map((code, k) => {
      const cx = r[0] + 60 + (k - (codes.length - 1) / 2) * 24;
      return `
        <circle cx="${cx}" cy="${r[1] + 38}" r="9" fill="${COL[code]}" stroke="#fff" stroke-width="1"/>
        <text x="${cx}" y="${r[1] + 42}" fill="#fff" font-size="11" text-anchor="middle" font-weight="800">${code}</text>`;
    }).join("");
  };

  return `
    <svg viewBox="0 0 360 340" width="100%" style="background:#10121a;border-radius:8px">
      ${known.length ? '<text x="10" y="22" fill="#9a9486" font-size="11">時間1の初期配置</text>' : ""}
      ${L.map((l) => `<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="#fff" stroke-width="3"/>`).join("")}
      ${R.map((r, i) => `
        <rect class="rm ${i === sel ? "sel" : ""}" x="${r[0]}" y="${r[1]}" width="120" height="50" rx="3" fill="${r[2]}" stroke="${r[3]}" stroke-width="2"/>
        <text x="${r[0] + 60}" y="${r[1] + 20}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">${ROOMS[i]}</text>
        ${tokens(r, i)}
      `).join("")}
    </svg>`;
}

// 場所の読み方（漢字の部分だけにフリガナ）
const ROOM_RUBY = [
  "<ruby>大<rt>だい</rt></ruby>ロビー",
  "<ruby>大階段<rt>だいかいだん</rt></ruby>",
  "<ruby>桟敷席<rt>さじきせき</rt></ruby>",
  "<ruby>舞台<rt>ぶたい</rt></ruby>",
  "ダンスホール",
  "<ruby>音楽堂<rt>おんがくどう</rt></ruby>"
];
const roomLegend = () => `<div class="legend">${ROOM_RUBY.map((h) => `<span>${h}</span>`).join("")}</div>`;

// 真相の表（説明書の「真相」ページ風）。縦が場所、横が時間。人物は色付きの丸で示す。
// truth: Ⅳなら爆弾（💣＝仕掛けた場所と時間、💥＝爆発）、Ⅴなら恋人たち（その2人の居場所に色を付ける）
function truthGrid(occ, truth) {
  const lovers = truth && truth.type === "lovers" ? truth.pair : [];
  const bomb = truth && truth.type === "bomb" ? truth : null;
  const cell = (r, t) => {
    const here = occ[r][t];
    const lit = here.find((x) => lovers.includes(x));
    const style = lit ? ` style="background:${COL[NAMES[lit]]}66"` : "";
    const mark = bomb
      ? (bomb.plant[0] === r && bomb.plant[1] === t ? '<span class="mk2">💣</span>' : "") + (bomb.blast[0] === r && bomb.blast[1] === t ? '<span class="mk2">💥</span>' : "")
      : "";
    const tokens = here.map((x) => `<span class="tk" style="background:${COL[NAMES[x]]}">${NAMES[x]}</span>`).join("");
    return `<td class="tgc"${style}>${mark}${tokens}</td>`;
  };
  return `
    <table class="tg">
      <tr><th></th>${[1, 2, 3, 4, 5, 6].map((t) => `<th><span class="tn">${t}</span></th>`).join("")}</tr>
      ${ROOMS.map((room, r) => `<tr><th class="tgr">${room}</th>${[0, 1, 2, 3, 4, 5].map((t) => cell(r, t)).join("")}</tr>`).join("")}
    </table>`;
}

// 答え（結論）の枠
const verdictBox = (lines) => `<div class="verdict">${lines.map((l) => `<div>● ${l.replace(/^\d+\.\s*/, "")}</div>`).join("")}</div>`;

// 判明ボードのHTML。sc: 事件の公開情報（known, initAll）、hist: 調査記録
function boardHtml(sc, hist) {
  const tc = {}, pc = {};

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

  hist.forEach((h) => {
    if (h.type === "PLACE_TIME") {
      const c = (tc[h.roomIdx + "_" + h.t] ||= { n: null, w: new Set() });
      c.n = h.count;
      if (h.char) c.w.add(NAMES[h.char]);
    } else {
      const c = (pc[h.name + "_" + h.roomIdx] ||= { n: null, t: new Set() });
      c.n = h.count;
      if (h.time != null) c.t.add(h.time);
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
