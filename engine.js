(function (root) {
  const NAMES = {
    冒険家: "A",
    男爵夫人: "B",
    運転手: "C",
    探偵: "D",
    記者: "J",
    使用人: "S"
  };
  const CHARS = Object.keys(NAMES);
  const ROOMS = ["大ロビー", "大階段", "桟敷席", "舞台", "ダンスホール", "音楽堂"];
  const FEM = new Set(["冒険家", "男爵夫人", "使用人"]);
  const MALE = new Set(["運転手", "探偵", "記者"]);
  const EDGES = [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5]];
  const ADJ = ROOMS.map(() => []);
  
  EDGES.forEach(([u, v]) => {
    ADJ[u].push(v);
    ADJ[v].push(u);
  });

  const N = 6, T = 6;
  const MAXROOM = 3;
  const SCENARIOS = [
    "シナリオⅠ（毒入りの夜会）",
    "シナリオⅡ（仮面の怪人）",
    "シナリオⅢ（消えた首飾り）",
    "シナリオⅣ（爆弾の夜）",
    "シナリオⅤ（すれ違う恋人たち）"
  ];
  const DIFFICULTIES = [
    "★☆☆ (初級: 初期配置全開示)",
    "★★☆ (中級: 初期配置一部開示)",
    "★★★ (上級: 上級配置高難度)"
  ];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const cs = (c) => `${c} (${NAMES[c]})`;
  const cn = (c) => `${c}(${NAMES[c]})`;

  function attempt(type, diff) {
    const paths = {};
    for (const c of CHARS) {
      const s = type.includes("シナリオⅢ") && Math.random() < 0.45 ? 4 : Math.floor(Math.random() * N);
      const p = [s];
      for (let i = 1; i < T; i++) {
        p.push(pick(ADJ[p[i - 1]]));
      }
      paths[c] = p;
    }

    const occ = ROOMS.map(() => Array.from({ length: T }, () => []));
    const visits = {};
    CHARS.forEach((c) => {
      visits[c] = ROOMS.map(() => []);
    });

    for (const c of CHARS) {
      paths[c].forEach((r, t) => {
        occ[r][t].push(c);
        visits[c][r].push(t + 1);
      });
    }

    if (!ROOMS.every((_, r) => occ[r].some((o) => o.length))) return null;
    if (occ.some((r) => r.some((o) => o.length > MAXROOM))) return null; // 同室は最大3人まで
    if (type.includes("シナリオⅢ") && !occ[4].every((o) => o.length)) return null;
    if ((type.includes("シナリオⅠ") || type.includes("シナリオⅣ")) && occ.some((r) => r[0].length === 2)) return null; // 時間1に二人きりの場面を作らない

    const easy = diff.includes("初級");
    let sol = null, hint = null, answers = null, truth = null;

    if (type.includes("シナリオⅠ")) {
      const dp = paths["探偵"], ev = [];
      dp.forEach((r, t) => {
        if (t < 1) return; // 毒を盛る場面は時間2〜6
        const o = occ[r][t];
        if (o.length === 2) {
          ev.push({ k: o.find((c) => c !== "探偵"), room: ROOMS[r], ri: r, t: t + 1 });
        }
      });
      if (ev.length !== 1) return null;
      answers = [
        { label: "犯人", expect: { who: ev[0].k } },
        { label: "場所", expect: { room: ev[0].ri } },
        { label: "時間", expect: { time: ev[0].t } }
      ];
      sol = [
        `1. 探偵に毒を盛った人物: 【${cs(ev[0].k)}】`,
        `2. 毒を盛った場所: 【${ev[0].room}】`,
        `3. 毒を盛った時間: 【時間 ${ev[0].t}】`
      ];
    } else if (type.includes("シナリオⅡ")) {
      const al = CHARS.filter((c) => paths[c].every((r, t) => occ[r][t].length === 1));
      if (al.length !== 1) return null;
      answers = [{ label: "怪人", expect: { who: al[0] } }];
      sol = [`1. 怪人の正体: 【${cs(al[0])}】`];
    } else if (type.includes("シナリオⅢ")) {
      let cur = null, st = 0;
      for (let t = 0; t < T; t++) {
        if (occ[4][t].length === 1) {
          cur = occ[4][t][0];
          st = t + 1;
          break;
        }
      }
      if (cur === null) return null;
      for (let t = st - 1; t < T; t++) {
        const o = occ[paths[cur][t]][t];
        if (o.length === 2) cur = o.find((c) => c !== cur);
      }
      answers = [
        { label: "宝石の所有者", expect: { who: cur } },
        { label: "警察が介入すべき場所", expect: { room: paths[cur][5] } }
      ];
      sol = [
        `1. 時間 6 で宝石を持っている人物: 【${cs(cur)}】`,
        `2. 警察が介入すべき場所: 【${ROOMS[paths[cur][5]]}】`
      ];
    } else if (type.includes("シナリオⅣ")) {
      const ev = [];
      for (let r = 0; r < N; r++) {
        for (let t = 1; t <= 4; t++) {
          const o = occ[r][t];
          if (o.length === 2 && ((MALE.has(o[0]) && FEM.has(o[1])) || (MALE.has(o[1]) && FEM.has(o[0])))) {
            ev.push([o[0], o[1], r, t]);
          }
        }
      }
      if (ev.length !== 1) return null;
      const [a, b, r, t] = ev[0], vic = occ[r][5];
      if (!vic.length) return null;
      truth = { type: "bomb", culprits: [a, b], plant: [r, t], blast: [r, 5] }; // 0始まりの時間番号
      answers = [
        { label: "犯人", expect: { m: MALE.has(a) ? a : b, f: MALE.has(a) ? b : a } },
        { label: "爆弾を仕掛けた場所・時間", expect: { room: r, time: t + 1 } },
        { label: "爆発の被害者", expect: { victims: vic } }
      ];
      sol = [
        `1. 犯人(共犯者): 【${cn(a)}】 と 【${cn(b)}】`,
        `2. 爆弾を仕掛けた場所・時間: 【${ROOMS[r]}・時間 ${t + 1}】`,
        `3. 爆発の被害者（時間 6 にその場所にいた人物）: 【${vic.map(cn).join("、")}】`
      ];
    } else if (type.includes("シナリオⅤ")) {
      const nm = [];
      for (const m of MALE) {
        for (const f of FEM) {
          if (!paths[m].some((r, t) => r === paths[f][t])) {
            nm.push([m, f]);
          }
        }
      }
      if (nm.length !== 1) return null;
      hint = pick(nm[0]);
      truth = { type: "lovers", pair: [nm[0][0], nm[0][1]] };
      answers = [{ label: "すれ違う恋人たち", expect: { m: nm[0][0], f: nm[0][1] } }];
      sol = [`1. すれ違う恋人たち: 【${cn(nm[0][0])}】 と 【${cn(nm[0][1])}】 (全時間で1度も同じ部屋にいなかった唯一の男女ペア)`];
    }

    if (!sol) return null;

    const sh = shuffle(CHARS);
    const cl = (c) => `時間 1: 【${cs(c)}】 ➔ 【${ROOMS[paths[c][0]]}】`;
    const clues = easy
      ? sh.map(cl)
      : diff.includes("中級")
      ? [...sh.slice(0, 4).map(cl), "時間 1: 残り2人の初期位置はランダム非公開（調査で特定）"]
      : [...sh.slice(0, 2).map(cl), "時間 1: 他の人物の初期位置はランダム非公開（調査で特定）"];

    if (hint && easy) clues.push(`ヒント: すれ違う恋人たちのうち1人は、【${cs(hint)}】です。`);

    const known = (easy ? sh : diff.includes("中級") ? sh.slice(0, 4) : sh.slice(0, 2)).map((c) => [c, paths[c][0]]);

    return { type, diff, paths, occ, visits, sol, clues, known, initAll: easy, answers, truth };
  }

  function generate(type, diff) {
    for (let i = 0; i < 50000; i++) {
      const s = attempt(type, diff);
      if (s) return s;
    }
    return null;
  }

  function inquirePlacePerson(s, r, c) {
    const v = s.visits[c][r], n = v.length;
    // 初期配置（時間1）で、すでにわかっている滞在は避けて選ぶ（他の滞在があるとき）
    const knownHere = s.known.some(([name, room]) => name === c && room === r);
    const fresh = knownHere ? v.filter((x) => x !== 1) : v;
    const t = n ? pick(fresh.length ? fresh : v) : null;
    return {
      type: "PLACE_PERSON",
      room: ROOMS[r],
      roomIdx: r,
      name: c,
      character: cs(c),
      count: n,
      time: t,
      shared: `【共有情報】${cs(c)} は 【${ROOMS[r]}】 に合計 ${n} 回滞在した。`,
      priv: t !== null ? `【個人情報】そのうち 1 回は 【時間 ${t}】 だった。` : "【個人情報】この場所への滞在記録はない。"
    };
  }

  function inquirePlaceTime(s, r, t) {
    const o = s.occ[r][t - 1], n = o.length;
    // 時間1は、初期配置ですでにわかっている人物を避けて選ぶ（他にいるとき）
    const fresh = t === 1 ? o.filter((x) => !s.known.some(([name, room]) => name === x && room === r)) : o;
    const c = n ? pick(fresh.length ? fresh : o) : null;
    return {
      type: "PLACE_TIME",
      room: ROOMS[r],
      roomIdx: r,
      t,
      count: n,
      char: c,
      shared: `【共有情報】時間 ${t} の 【${ROOMS[r]}】 には合計 ${n} 人がいた。`,
      priv: c ? `【個人情報】そのうちの 1 人は 【${cs(c)}】 であった。` : "【個人情報】この時間帯にその場所にいた人物はいない。"
    };
  }

  // 解答の判定：各設問ごとに正誤を返す（配列は順不同で比較）
  function judge(s, input) {
    const norm = (v) => (Array.isArray(v) ? v.map(String).sort().join(",") : String(v ?? ""));
    return s.answers.map((q) => ({
      label: q.label,
      ok: Object.keys(q.expect).every((k) => norm(input[k]) === norm(q.expect[k]))
    }));
  }

  const api = { NAMES, CHARS, ROOMS, SCENARIOS, DIFFICULTIES, generate, inquirePlacePerson, inquirePlaceTime, judge };
  if (typeof module !== "undefined") {
    module.exports = api;
  } else {
    root.Engine = api;
  }
})(this);