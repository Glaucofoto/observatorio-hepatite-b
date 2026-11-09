// Ambiente mínimo de execução do painel fora do Claude.
// Implementa a mesma interface usada por core.js e draw.js: calc, draw, data, params, setParams e setLink.
(function () {
  const FONTES = ['indicadores', 'criterios', 'criterios_resumo', 'correlacoes', 'regressao', 'agrupamento', 'grupos', 'importancia'];
  const brutos = {}, estado = {}, calcs = {}, desenhos = {}, cache = {};
  const q = new URLSearchParams(location.search);
  const params = { ano: Number(q.get('ano') || 2022), limiar: Number(q.get('limiar') || 90) };

  function rodar(nome) {
    const f = desenhos[nome];
    if (!f) return;
    document.querySelectorAll('[data-draw="' + nome + '"]').forEach((el) => {
      try { f(el); } catch (e) { console.error('Desenho ' + nome + ':', e); }
    });
  }
  function rodarTodos() { Object.keys(desenhos).forEach(rodar); }

  window.dash = {
    calc(nome, spec) { calcs[nome] = spec; },
    draw(nome, fn) { if (typeof fn === 'function') desenhos[nome] = fn; else rodar(nome); },
    data(id) {
      if (FONTES.includes(id)) return { status: estado[id] || 'loading', data: brutos[id] || [] };
      const c = calcs[id];
      if (!c) return { status: 'missing', data: [] };
      const entradas = c.inputs.map((i) => window.dash.data(i));
      if (entradas.some((e) => e.status !== 'ok')) return { status: entradas.some((e) => e.status === 'error') ? 'error' : 'loading', data: [] };
      if (!cache[id]) cache[id] = c.fn(...entradas.map((e) => e.data));
      return { status: 'ok', data: cache[id] };
    },
    params() { return params; },
    setParams(p) {
      Object.assign(params, p);
      const u = new URL(location.href);
      Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
      history.replaceState(null, '', u);
      rodarTodos();
    },
    setLink(id) { history.replaceState(null, '', '#' + id); },
  };

  FONTES.forEach((id) => {
    fetch('dados/' + id + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { brutos[id] = d; estado[id] = 'ok'; })
      .catch(() => { estado[id] = 'error'; })
      .finally(() => { Object.keys(cache).forEach((k) => delete cache[k]); rodarTodos(); });
  });
  window.addEventListener('DOMContentLoaded', rodarTodos);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(rodarTodos, 200); });
})();
