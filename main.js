// 상태를 들고 있고, 버튼·검색을 받아서 다시 그린다 (탭: 추천 찾기 / 트렌드)
(() => {
  const F = {
    concern: ["잡티·미백", "여드름", "모공·피지", "민감·진정", "보습·건조", "노화·탄력", "자외선", "다크서클·눈가"],
    skin: ["지성", "건성", "수부지", "복합성", "민감성", "중성"],
    form: ["크림", "세럼앰플", "토너", "패드", "팩마스크", "선케어", "클렌저"],
    time: ["아침", "밤"],
  };
  const blank = () => ({ concern: [], skin: [], form: [], time: [], ingredient: [], word: [], country: "", shown: 10, said: [], viaBtn: false });  // said·viaBtn: 구매 기록용 추천 경로  // 목록은 10개씩, 더 보기로 10개 더
  let st = blank(), open = false, tab = "find", sh = null, tc = "", tshown = 10, dshown = 10;
  const hist = [];  // 뒤로가기: 화면·조건이 바뀌기 전 상태를 쌓아 둔다
  const SAME = ["say", "more", "tmore", "dmore", "panel", "lang", "back"];  // 화면이 바뀌지 않는 버튼은 안 쌓음
  const $ = id => document.getElementById(id);
  const names = OB.products.map(p => p.name.toLowerCase());
  const count = {};
  OB.products.forEach(p => Array.isArray(p.ingredients) && p.ingredients.forEach(i => count[i] = (count[i] || 0) + 1));
  const hasCond = () => ["concern", "skin", "form", "time", "ingredient", "word"].some(c => st[c].length) || !!st.country;

  function inView() {  // 지금 조건(추천 성분 빼고)에 맞는 제품에 든 성분 수 → 눌러도 0개가 안 나오는 성분만 추천
    const n = {};
    for (const r of Score.products(OB.products, { ...st, ingredient: [] }, OB.trend))
      if (Array.isArray(r.p.ingredients)) r.p.ingredients.forEach(i => n[i] = (n[i] || 0) + 1);
    return n;
  }

  function renderFind() {
    $("chips").innerHTML = View.selected(st, OB.countries);
    $("sumtext").textContent = View.summary(st);
    $("toggle").setAttribute("aria-expanded", open);
    $("panel").hidden = !open;
    if (open) $("panel").innerHTML = View.filters(st, F, OB.countries);
    $("ings").innerHTML = View.ingCards(Score.ingredients(OB.dict, st, OB.trend, inView()), st);
    $("results").innerHTML = Card.list(Score.products(OB.products, st, OB.trend), st, st.shown, hasCond());
    $("examples").hidden = hasCond();
  }

  function render() {
    for (const v of ["find", "dict", "trend"]) $(v).hidden = tab !== v;
    document.body.dataset.tab = tab;  // 추천 찾기 탭만 2단계 디자인
    $("form").hidden = tab !== "find";
    $("title").textContent = { find: "추천 찾기", dict: "성분 사전", trend: "트렌드" }[tab];
    document.querySelectorAll(".tabbar button").forEach(b => b.setAttribute("aria-current", b.dataset.val === tab ? "page" : "false"));
    if (tab === "find") renderFind();
    if (tab === "dict") $("dlist").innerHTML = Dict.list($("dq").value, count, dshown);
    if (tab === "trend") $("trend").innerHTML = Trend.page(tc, tshown, count);
    $("back").hidden = !hist.length;
    $("lconfirm").innerHTML = Log.dialog();
    $("logbtn").hidden = !Log.on();
    $("logbtn").textContent = `기록 ${Log.count()}`;
    $("sheet").hidden = !sh;
    if (sh) $("sheetbody").innerHTML = sheetHtml();
  }

  function sheetHtml() {
    if (sh.k === "ing") return Sheet.html(sh.v, st.ingredient.includes(sh.v));
    if (sh.k === "prod") return Product.html(sh.v, st);
    if (sh.k === "log") return Log.page();
    return Trend.sheet(sh.v, count);
  }

  function toggle(cat, val) {
    if (cat === "country") st.country = st.country === val ? "" : val;
    else st[cat] = st[cat].includes(val) ? st[cat].filter(v => v !== val) : [...st[cat], val];
    st.shown = 10; st.viaBtn = true;
  }

  function remember() {
    hist.push(JSON.stringify({ st, open, tab, sh, tc, tshown, dshown }));
    if (hist.length > 30) hist.shift();
  }

  function back() {
    if (!hist.length) return;
    ({ st, open, tab, sh, tc, tshown, dshown } = JSON.parse(hist.pop()));
    Log.clear(); $("hint").textContent = "";
  }

  function act(b) {
    const { act: a, cat, val } = b.dataset;
    if (!SAME.includes(a) && !a.startsWith("log-")) remember();
    if (a === "back") back();
    if (["toggle", "remove", "reset", "tab"].includes(a)) $("hint").textContent = "";  // 조건·탭이 바뀌면 지난 검색 안내는 지움
    if (a === "toggle") { toggle(cat, val); if (b.closest("#sheet")) { sh = null; tab = "find"; scrollTo(0, 0); } }
    if (a === "remove") cat === "country" ? (st.country = "") : (st[cat] = st[cat].filter(v => v !== val));
    if (a === "reset") st = blank();
    if (a === "more") st.shown += 10;
    if (a === "panel") open = !open;
    if (a === "say") return search(b.textContent);
    if (a === "ing") sh = { k: "ing", v: val };
    if (a === "tcard") sh = { k: "trend", v: +val };
    if (a === "prod") { sh = { k: "prod", v: val }; Log.clear(); }
    if (a === "logs") { sh = { k: "log" }; Log.clear(); }
    if (a.startsWith("log-")) Log.act(a, val, st, sh && sh.v);
    if (a === "lang") Sheet.setLang(val);
    if (a === "close") sh = null;
    if (a === "tab") { tab = val; sh = null; scrollTo(0, 0); }
    if (a === "tcountry") { tc = val; tshown = 10; }
    if (a === "tmore") tshown += 10;
    if (a === "dmore") dshown += 10;
    render();
  }

  function search(text) {
    remember();
    const { out, found } = Query.parse(text, OB.syn, names);
    const kept = hasCond() ? " 지금 조건은 그대로 뒀어요." : "";
    $("hint").textContent = found ? "" : `"${text}"는 아직 모르는 말이에요. 고민(여드름)·성분(나이아신아마이드)·제형(크림)으로 써 보세요.${kept}`;
    for (const c of Object.keys(out)) out[c].forEach(v => st[c].includes(v) || st[c].push(v));
    st.said.push(text); st.shown = 10; tab = "find";
    render();
  }

  document.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) act(b); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && sh) { sh = null; render(); }
    if (e.key === "Enter" && e.target.matches("li[data-act]")) act(e.target);
  });
  $("dq").addEventListener("input", () => { dshown = 10; $("dlist").innerHTML = Dict.list($("dq").value, count, dshown); });
  $("form").addEventListener("submit", e => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q) { search(q); $("q").value = ""; $("q").blur(); }
  });
  render();
  Log.start(render);
})();
