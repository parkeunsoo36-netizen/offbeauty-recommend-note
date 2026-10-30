// 체험판(깃허브 사이트)용 기록 저장소: 비공개 페이지 저장소(db)와 같은 모양으로, 이 휴대폰 브라우저에만 저장한다
const Local = (() => {
  const KEY = "ob-log";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  const subs = [];

  function fire() {
    const docs = read().sort((a, b) => a.v.t < b.v.t ? 1 : -1).map(d => ({ id: d.id, data: () => d.v }));
    subs.forEach(f => f({ docs }));
  }

  async function add(v) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    write([...read(), { id, v }]); fire();
    return { delete: async () => { write(read().filter(d => d.id !== id)); fire(); } };
  }

  const col = { orderBy: () => col, onSnapshot: f => { subs.push(f); fire(); return () => {}; }, add };

  async function save({ filename, data }) {  // CSV 파일 내려받기
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
    a.download = filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { db: { collection: () => col }, dl: { save } };
})();
