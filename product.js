// 제품 설명 시트: 성분 사전에서 이 제품의 주요 성분 효능을 모아 손님에게 할 말로 짧게 보여준다 (한국어·영어)
const Product = (() => {
  const { esc, lab } = View;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const TIME_KO = { 밤: "밤에만 써요", 아침: "아침에 써요", 상관없음: "아침·밤 모두 써요" };

  function top(p, st) {  // 고른 조건과 관련 있는 성분부터 3개
    if (!Array.isArray(p.ingredients)) return [];
    const sel = Score.picked(st);
    const rel = id => (sel.includes(id) ? 4 : 0) + OB.dict[id].concerns.filter(c => st.concern.includes(c)).length + (Score.hotBonus(id) ? 0.5 : 0);
    return [...p.ingredients].sort((a, b) => rel(b) - rel(a)).slice(0, 3);
  }

  function cons(p, st) {  // 손님이 고른 고민을 먼저, 최대 3개
    if (!Array.isArray(p.concerns)) return [];
    return [...p.concerns].sort((a, b) => st.concern.includes(b) - st.concern.includes(a)).slice(0, 3);
  }

  function ko(p, ids, st) {
    if (!ids.length) return `<p class="say">성분 정보가 아직 없어요. 제품 뒷면 전성분을 확인해 주세요.</p>`;
    const d = ids.map(id => OB.dict[id]);
    const c = cons(p, st).join(", ");
    const say = (c ? `<b>${esc(c)}</b> 고민에 도움을 주는 제품이에요.<br>` : "") + `핵심 성분: ${esc(d.map(x => x.name).join(" · "))}`;
    const list = d.map(x => `<li><b>${esc(x.name)}</b> ${esc(x.fx)}</li>`).join("");
    const time = TIME_KO[p.time] ? `<p class="sub">${TIME_KO[p.time]}</p>` : "";
    const warn = p.warn.length ? `<p class="warn">⚠️ ${esc(p.warn.join(", "))} 성분이 있어요. 민감한 피부는 주의, 낮엔 선크림</p>` : "";
    return `<p class="say">${say}</p><ul class="eff">${list}</ul>${time}${warn}`;
  }

  function en(p, ids, st) {
    if (!ids.length) return `<p class="say">No ingredient details yet. Please check the full ingredient list on the back.</p>`;
    const d = ids.map(id => OB.dict[id]);
    const c = cons(p, st).map(x => Sheet.EN[x]).join(", ");
    const say = `It has ${d.map(x => x.en_name).join(", ")}${c ? `, good for <b>${esc(c)}</b>` : ""}.`;
    const list = d.map(x => `<li><b>${esc(x.en_name)}</b> ${esc(cap(x.en))}</li>`).join("");
    const time = Sheet.EN[p.time] ? `<p class="sub">${Sheet.EN[p.time]}</p>` : "";
    const warn = p.warn.length ? `<p class="warn">⚠️ Contains active ingredients. Take care with sensitive skin and use sunscreen by day.</p>` : "";
    return `<p class="say" lang="en">${say}</p><ul class="eff" lang="en">${list}</ul>${time}${warn}`;
  }

  function fit(p, st) {  // 손님 조건 중 이 제품이 맞는 것
    const ok = [...st.concern.filter(c => Array.isArray(p.concerns) && p.concerns.includes(c)),
      ...st.skin.filter(k => Array.isArray(p.skin) && p.skin.includes(k)), ...(st.form.includes(p.form) ? [lab(p.form)] : [])];
    return ok.length ? `<p class="fit">${ok.map(x => `<span>✓ ${esc(x)}</span>`).join("")}</p>` : "";
  }

  function html(id, st) {
    const p = OB.products.find(x => x.id === id), ids = top(p, st);
    const tab = (l, t) => `<button type="button" class="tab${Sheet.lang === l ? " on" : ""}" data-act="lang" data-val="${l}" aria-pressed="${Sheet.lang === l}">${t}</button>`;
    const price = p.price ? ` · ${p.price.toLocaleString("ko-KR")}원` : "";
    return `<div class="tabs">${tab("ko", "한국어")}${tab("en", "English")}</div>
      <p class="sub">📍 ${esc(p.loc.badge)}${p.loc.tier ? ` ${p.loc.tier}단` : ""}${price}</p><h3>${esc(p.name)}</h3>
      ${fit(p, st)}${Sheet.lang === "en" ? en(p, ids, st) : ko(p, ids, st)}${Log.box(p)}`;
  }

  return { html };
})();
