// 구매 기록: 제품 시트의 구매/구매 안 함 → 비공개 페이지 저장소(db)에 남기고, 기록 시트에서 모아 보고 CSV로 내보낸다
// 저장소가 없는 곳(깃허브 체험판·인터넷 끊김)에서는 버튼을 숨긴다
const Log = (() => {
  const { esc } = View;
  const REASONS = ["가격", "원하는 게 아님", "더 둘러볼게요", "재고 없음", "기타"];
  const PATHS = ["검색", "버튼", "검색+버튼", "조건 없음", "앱 없이"];
  const COLS = [["day", "날짜"], ["time", "시간"], ["path", "추천 경로"], ["said", "검색어"], ["conds", "조건"], ["country", "손님 국적"],
    ["n", "결과 수"], ["top5", "추천 상위 5개"], ["pname", "제품"], ["rank", "순위"], ["buy", "구매"], ["qty", "수량"], ["amount", "금액"], ["reason", "미구매 사유"]];
  let db = null, dl = null, rows = [], draft = null, last = null, ask = null, demo = false, msg = "", redraw = () => {};

  async function start(cb) {
    redraw = cb;
    const inClaude = !!(window.claude && window.claude.use);
    db = inClaude ? await window.claude.use("db") : Local.db;  // 깃허브 체험판은 이 휴대폰에만 저장
    if (!db) return;
    demo = !inClaude;
    db.collection("logs").orderBy("t", "desc").onSnapshot(s => { rows = s.docs.map(d => ({ id: d.id, ...d.data() })); redraw(); }, () => {});
    dl = inClaude ? await window.claude.use("downloads") : Local.dl;
    redraw();
  }

  function path(st) {
    const said = st.said.length > 0, btn = st.viaBtn;
    return said && btn ? "검색+버튼" : said ? "검색" : btn ? "버튼" : "조건 없음";
  }

  function conds(st) {  // 고른 조건을 사람이 읽는 글로
    return [...st.concern, ...st.skin, ...st.form, ...st.time, ...st.ingredient.map(i => OB.dict[i].name), ...st.word.map(w => `"${w}"`)].join(", ");
  }

  function stamp() {  // 한국 시간 "2026-10-30 15:38"
    const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
    return { t: new Date().toISOString(), day: s.slice(0, 10), time: s.slice(11, 16) };
  }

  function record(st, p) {
    const list = Score.products(OB.products, st, OB.trend);
    const buy = draft.buy, qty = buy ? draft.qty : 0;
    return { ...stamp(), path: path(st), said: st.said.join(" / "), conds: conds(st), country: draft.country, n: list.length,
      top5: list.slice(0, 5).map(r => r.p.name).join(" | "), pid: p.id, pname: p.name, rank: list.findIndex(r => r.p.id === p.id) + 1 || "",
      buy: buy ? "구매" : "안 함", qty, amount: buy ? (p.price || 0) * qty : 0, reason: buy ? "" : draft.reason };
  }

  function baseline(buy) {  // 앱 없이 응대한 손님 (비교용)
    return { ...stamp(), path: "앱 없이", said: "", conds: "", country: "", n: "", top5: "", pid: "", pname: "", rank: "",
      buy: buy ? "구매" : "안 함", qty: "", amount: "", reason: "" };
  }

  async function save(row) {
    msg = "저장 중…"; redraw();
    try { last = await db.collection("logs").add(row); msg = "✓ 저장했어요"; draft = null; }
    catch (e) { msg = "저장 실패: 인터넷 연결을 확인하고 다시 눌러 주세요"; }
    redraw();
  }

  async function undo() {
    if (!last) return;
    try { await last.delete(); last = null; msg = "방금 기록을 지웠어요"; } catch (e) { msg = "지우기 실패: 다시 눌러 주세요"; }
    redraw();
  }

  function csv() {
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [COLS.map(c => cell(c[1])).join(","), ...[...rows].reverse().map(r => COLS.map(c => cell(r[c[0]])).join(","))];
    return "﻿" + lines.join("\r\n");  // 엑셀에서 한글이 안 깨지게 BOM
  }

  async function exportCsv() {
    if (!dl) { msg = "이 화면에서는 내보내기를 쓸 수 없어요"; return redraw(); }
    try { await dl.save({ filename: `offbeauty_purchase_log_${stamp().day}.csv`, data: csv() }); msg = "✓ CSV를 내보냈어요"; }
    catch (e) { msg = e && e.code === "declined" ? "" : "내보내기 실패: 다시 눌러 주세요"; }
    redraw();
  }

  function act(a, val, st, pid) {  // 버튼 처리. 저장·내보내기는 끝나면 다시 그린다
    if (a === "log-buy") { draft = { pid, buy: val === "1", qty: 1, reason: "", country: OB.countries[st.country] || "" }; msg = ""; }
    if (a === "log-qty") draft.qty = Math.max(1, draft.qty + +val);
    if (a === "log-reason") draft.reason = draft.reason === val ? "" : val;
    if (a === "log-country") draft.country = draft.country === val ? "" : val;
    if (a === "log-cancel") draft = null;
    if (a === "log-save") ask = record(st, OB.products.find(p => p.id === pid));  // 바로 저장하지 않고 확인 창부터
    if (a === "log-base") ask = baseline(val === "1");
    if (a === "log-yes") { save(ask); ask = null; }
    if (a === "log-no") ask = null;
    if (a === "log-undo") undo();
    if (a === "log-csv") exportCsv();
  }

  const chip = (a, v, on) => `<button type="button" class="chip${on ? " on" : ""}" data-act="${a}" data-val="${esc(v)}" aria-pressed="${!!on}">${esc(v)}</button>`;
  const note = () => msg ? `<p class="lmsg">${esc(msg)}${last && msg.startsWith("✓ 저장") ? ` <button type="button" data-act="log-undo">방금 기록 취소</button>` : ""}</p>` : "";

  function form(p) {  // 구매/구매 안 함을 고른 뒤: 수량 또는 사유 + 국적 (모두 안 눌러도 저장됨)
    const d = draft, won = n => n.toLocaleString("ko-KR") + "원";
    const top = d.buy
      ? `<div class="lrow"><span>수량</span><button type="button" class="step" data-act="log-qty" data-val="-1" aria-label="하나 빼기">−</button><b>${d.qty}</b><button type="button" class="step" data-act="log-qty" data-val="1" aria-label="하나 더">+</button><em>${p.price ? won(p.price * d.qty) : ""}</em></div>`
      : `<div class="lrow wrap"><span>사유</span>${REASONS.map(r => chip("log-reason", r, d.reason === r)).join("")}</div>`;
    const ctry = `<div class="lrow wrap"><span>국적</span>${[...Object.values(OB.countries), "기타"].map(c => chip("log-country", c, d.country === c)).join("")}</div>`;
    return `${top}${ctry}<div class="lact"><button type="button" class="lsave" data-act="log-save">${d.buy ? "구매" : "구매 안 함"} 저장</button><button type="button" class="lcancel" data-act="log-cancel">취소</button></div>`;
  }

  function box(p) {  // 제품 시트 맨 아래
    if (!db) return "";
    const body = draft && draft.pid === p.id ? form(p)
      : `<div class="lact"><button type="button" class="lbuy" data-act="log-buy" data-val="1">구매</button><button type="button" class="lno" data-act="log-buy" data-val="0">구매 안 함</button></div>`;
    return `<section class="logbox"><h4>손님 구매 기록</h4>${body}${note()}</section>`;
  }

  function stats() {  // 추천 경로별 건수·구매율·금액
    const by = PATHS.map(k => [k, rows.filter(r => r.path === k)]).filter(x => x[1].length);
    const line = ([k, rs]) => {
      const b = rs.filter(r => r.buy === "구매"), sum = b.reduce((a, r) => a + (+r.amount || 0), 0);
      return `<tr><th>${k}</th><td>${rs.length}</td><td>${Math.round(b.length / rs.length * 100)}%</td><td>${sum ? sum.toLocaleString("ko-KR") : "-"}</td></tr>`;
    };
    return by.length ? `<table class="ltab"><tr><th>경로</th><td>건수</td><td>구매율</td><td>금액(원)</td></tr>${by.map(line).join("")}</table>` : `<p class="empty">아직 기록이 없어요.</p>`;
  }

  function recent() {
    const one = r => `<li><span>${esc(r.day.slice(5))} ${esc(r.time)}</span><b class="${r.buy === "구매" ? "y" : "n"}">${esc(r.buy)}</b>${esc(r.pname || "(앱 없이 응대)")}<small>${esc([r.path, r.conds, r.reason, r.country].filter(Boolean).join(" · "))}</small></li>`;
    return rows.length ? `<h4>최근 기록</h4><ol class="lrecent">${rows.slice(0, 10).map(one).join("")}</ol>` : "";
  }

  function page() {
    if (!db) return `<h3>구매 기록</h3><p class="sub">이 화면에서는 기록을 쓸 수 없어요. 비공개 페이지에서 열어 주세요.</p>`;
    const today = rows.filter(r => r.day === stamp().day).length;
    return `<h3>구매 기록</h3><p class="sub">전체 ${rows.length}건 · 오늘 ${today}건${demo ? " · 체험판: 이 휴대폰에만 저장돼요" : ""}</p>${stats()}
      <h4>앱 없이 응대한 손님 <small>비교용으로 가끔 눌러 주세요</small></h4>
      <div class="lact">${`<button type="button" class="lbuy" data-act="log-base" data-val="1">구매</button><button type="button" class="lno" data-act="log-base" data-val="0">구매 안 함</button>`}</div>
      ${note()}<button type="button" class="go" data-act="log-csv">CSV 내보내기</button>${recent()}`;
  }

  function dialog() {  // 저장 전 확인 창: 예일 때만 저장
    if (!ask) return "";
    const what = ask.pname ? `${ask.pname}${ask.qty ? ` ${ask.qty}개` : ""}` : "앱 없이 응대한 손님";
    return `<div class="ldim"></div><div class="lask" role="alertdialog" aria-modal="true" aria-labelledby="lask-t">
      <p id="lask-t"><b>${ask.buy === "구매" ? "구매" : "구매 안 함"}</b>으로 확정하시겠습니까?</p><p class="sub">${esc(what)}</p>
      <div class="lact"><button type="button" class="lno" data-act="log-no">아니오</button><button type="button" class="lbuy" data-act="log-yes">예</button></div></div>`;
  }

  const clear = () => { draft = null; ask = null; msg = ""; };  // 다른 시트를 열면 지난 안내는 지움

  return { start, act, box, page, dialog, clear, on: () => !!db, count: () => rows.length };
})();
