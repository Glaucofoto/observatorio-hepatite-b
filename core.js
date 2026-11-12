// =====================================================================
// Observatório da Hepatite B: formatação, cálculos derivados, navegação
// e funções de desenho reutilizadas pelos gráficos (draw.js).
// =====================================================================

const loc = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['R$ ', ''] });
const FMT = {
  n0: loc.format(',.0f'), n1: loc.format(',.1f'), n2: loc.format(',.2f'), n3: loc.format(',.3f'),
  s1: loc.format('+,.1f'), s2: loc.format('+,.2f'),
};

const COR = {
  azul: '#2C8FD6', verde: '#F7941D', azulC: '#0B5FA5', verdeC: '#FFC27A', teal: '#1BA39C',
  cinza: '#8A99A8', crit: '#D64532', warn: '#E0A800', baixa: '#A9B6C3', texto: '#13283D', muted: '#5A6B7D',
};
const COR_REGIAO = { 'Norte': '#2C8FD6', 'Nordeste': '#F7941D', 'Sudeste': '#1BA39C', 'Sul': '#D9578A', 'Centro-Oeste': '#8E6BBF' };
const COR_PRIOR = { 'Alta': COR.crit, 'Média': COR.warn, 'Baixa': COR.baixa };

const IND = {
  taxa: { nome: 'Taxa de detecção (por 100 mil hab.)', curto: 'Taxa por 100 mil', fmt: FMT.n2 },
  cob_hepb: { nome: 'Cobertura hepatite B até 30 dias (%)', curto: 'Cobertura hepatite B (%)', fmt: FMT.n1 },
  cob_hepa: { nome: 'Cobertura hepatite A (%)', curto: 'Cobertura hepatite A (%)', fmt: FMT.n1 },
  natalidade: { nome: 'Natalidade (nascidos por mil hab.)', curto: 'Natalidade (por mil)', fmt: FMT.n2 },
  casos: { nome: 'Casos confirmados', curto: 'Casos', fmt: FMT.n0 },
  taxa_ano_anterior: { nome: 'Taxa do ano anterior', curto: 'Taxa ano anterior', fmt: FMT.n2 },
};

// Estado da página que não vai para a URL nem para as consultas
window.OB = window.OB || { base: '2015', indCalor: 'taxa', indMapa: 'taxa', x: 'cob_hepb', y: 'taxa', per: 'ano', indTend: 'taxa', ufs: null, val: 'Pós-pandemia (treino 2015-2020, teste 2021-2022)' };
window.OBX = { FMT, COR, COR_REGIAO, COR_PRIOR, IND };

// Ano e limiar escolhidos (filtros da página inteira)
OBX.param = function (nome) {
  const p = dash.params() || {};
  if (nome === 'ano') return Number(p.ano ?? 2022);
  if (nome === 'limiar') return Number(p.limiar ?? 90);
  return p[nome];
};

// ---------------------------------------------------------------------
// Cálculos derivados (aparecem em "Fontes" com a fórmula)
// ---------------------------------------------------------------------
dash.calc('nacional', {
  inputs: ['indicadores'],
  title: 'Brasil por ano',
  description: 'Soma das 27 UFs: casos, nascidos e população; taxa por 100 mil; natalidade por mil; média simples das coberturas das UFs; variação em relação ao ano anterior.',
  fn: (indicadores) => {
    const porAno = d3.groups(indicadores, (linha) => Number(linha.ano)).sort((a, b) => a[0] - b[0]);
    const media = (valores) => { const v = valores.filter((x) => x != null).map(Number); return v.length ? d3.mean(v) : null; };
    const linhas = porAno.map(([ano, ufs]) => {
      const casos = d3.sum(ufs, (u) => Number(u.casos));
      const populacao = d3.sum(ufs, (u) => Number(u.populacao));
      return {
        ano, casos, populacao,
        nascidos: d3.sum(ufs, (u) => Number(u.nascidos)),
        natalidade: Math.round(d3.sum(ufs, (u) => Number(u.nascidos)) * 1000 / populacao * 100) / 100,
        taxa: Math.round(casos * 100000 / populacao * 100) / 100,
        cob_hepb_media: media(ufs.map((u) => u.cob_hepb)) == null ? null : Math.round(media(ufs.map((u) => u.cob_hepb)) * 10) / 10,
        cob_hepa_media: media(ufs.map((u) => u.cob_hepa)) == null ? null : Math.round(media(ufs.map((u) => u.cob_hepa)) * 10) / 10,
      };
    });
    linhas.forEach((linha, i) => {
      const anterior = linhas[i - 1];
      linha.var_taxa = anterior ? Math.round((linha.taxa - anterior.taxa) * 100) / 100 : null;
      linha.var_cob_hepb = anterior && linha.cob_hepb_media != null && anterior.cob_hepb_media != null
        ? Math.round((linha.cob_hepb_media - anterior.cob_hepb_media) * 10) / 10 : null;
    });
    return linhas;
  },
});

dash.calc('regional', {
  inputs: ['indicadores'],
  title: 'Regiões por ano',
  description: 'Soma de casos e população das UFs de cada região; taxa por 100 mil habitantes.',
  fn: (indicadores) => d3.flatGroup(indicadores, (u) => u.regiao, (u) => Number(u.ano)).map(([regiao, ano, ufs]) => {
    const casos = d3.sum(ufs, (u) => Number(u.casos));
    const populacao = d3.sum(ufs, (u) => Number(u.populacao));
    return { regiao, ano, casos, populacao, taxa: Math.round(casos * 100000 / populacao * 100) / 100 };
  }).sort((a, b) => a.ano - b.ano),
});

dash.calc('bruto_tratado_resumo', {
  inputs: ['bruto_tratado_regressao'],
  title: 'Resumo: dados brutos x tratados',
  description: 'Por validação e cenário: melhor algoritmo, menor, médio e maior RMSE e R² médio dos 5 algoritmos (casos por 100 mil).',
  fn: (reg) => d3.groups(reg, (r) => r.validacao, (r) => r.cenario).flatMap(([validacao, cens]) => cens.map(([cenario, rs]) => {
    const melhor = rs.reduce((a, b) => (Number(b.RMSE) < Number(a.RMSE) ? b : a));
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return { validacao, cenario, melhor_modelo: melhor.modelo, RMSE_min: r3(d3.min(rs, (r) => +r.RMSE)),
      RMSE_medio: r3(d3.mean(rs, (r) => +r.RMSE)), RMSE_max: r3(d3.max(rs, (r) => +r.RMSE)), R2_medio: r3(d3.mean(rs, (r) => +r.R2)) };
  })),
});

dash.calc('registros', {
  inputs: ['indicadores'],
  title: 'Registros por tabela do banco',
  description: 'Quantos registros cada tabela do banco PostgreSQL recebe a partir dos arquivos (valores ausentes não são carregados).',
  fn: (indicadores) => {
    const conta = (campo) => indicadores.filter((u) => u[campo] != null).length;
    const tabelas = [
      { tabela: 'regiao', registros: new Set(indicadores.map((u) => u.regiao)).size },
      { tabela: 'uf', registros: new Set(indicadores.map((u) => u.uf)).size },
      { tabela: 'imunobiologico', registros: 2 },
      { tabela: 'caso_hepatite', registros: conta('casos') },
      { tabela: 'cobertura_vacinal', registros: conta('cob_hepb') + conta('cob_hepa') },
      { tabela: 'populacao', registros: conta('populacao') },
      { tabela: 'nascidos_vivos', registros: conta('nascidos') },
    ];
    return tabelas;
  },
});

dash.calc('qualidade', {
  inputs: ['indicadores'],
  title: 'Resumo da qualidade dos dados',
  description: 'Contagens de linhas, ausentes e coberturas acima de 100% na base integrada.',
  fn: (indicadores) => [
    { item: 'Linhas da base integrada (UF e ano)', valor: indicadores.length },
    { item: 'UFs', valor: new Set(indicadores.map((u) => u.uf)).size },
    { item: 'Anos', valor: new Set(indicadores.map((u) => u.ano)).size },
    { item: 'Casos confirmados no período', valor: d3.sum(indicadores, (u) => Number(u.casos)) },
    { item: 'Cobertura hepatite B sem dado', valor: indicadores.filter((u) => u.cob_hepb == null).length },
    { item: 'Cobertura hepatite A sem dado', valor: indicadores.filter((u) => u.cob_hepa == null).length },
    { item: 'Cobertura hepatite B acima de 100%', valor: indicadores.filter((u) => u.cob_hepb > 100).length },
    { item: 'Cobertura hepatite A acima de 100%', valor: indicadores.filter((u) => u.cob_hepa > 100).length },
  ],
});

dash.calc('acima100', {
  inputs: ['indicadores'],
  title: 'Coberturas acima de 100%',
  description: 'UFs e anos em que a cobertura vacinal registrada passa de 100%.',
  fn: (indicadores) => indicadores.flatMap((u) => [
    u.cob_hepb > 100 ? { uf: u.uf, ano: Number(u.ano), vacina: 'Hepatite B até 30 dias', cobertura: u.cob_hepb } : null,
    u.cob_hepa > 100 ? { uf: u.uf, ano: Number(u.ano), vacina: 'Hepatite A', cobertura: u.cob_hepa } : null,
  ]).filter(Boolean).sort((a, b) => b.cobertura - a.cobertura),
});

// ---------------------------------------------------------------------
// Navegação: abas principais e subabas dos painéis
// ---------------------------------------------------------------------
(function () {
  const raiz = document.getElementById('ob');
  if (!raiz) return;

  function abrirAba(id) {
    raiz.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    raiz.querySelectorAll('#trabalho, #passos, #paineis').forEach((s) => { s.hidden = s.id !== id; });
  }
  function abrirSub(id) {
    abrirAba('paineis');
    raiz.querySelectorAll('[data-sub]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sub === id)));
    raiz.querySelectorAll('#paineis > .ob-sub').forEach((s) => { s.hidden = s.id !== id; });
  }
  raiz.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === 'paineis') {
      const ativa = raiz.querySelector('[data-sub][aria-selected="true"]');
      abrirSub(ativa ? ativa.dataset.sub : 'p-visao');
      dash.setLink(ativa ? ativa.dataset.sub : 'p-visao');
    } else { abrirAba(b.dataset.tab); dash.setLink(b.dataset.tab); }
  }));
  raiz.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => { abrirSub(b.dataset.sub); dash.setLink(b.dataset.sub); }));

  const alvo = (location.hash || '').slice(1);
  if (alvo && alvo.startsWith('p-') && raiz.querySelector('#' + CSS.escape(alvo))) abrirSub(alvo);
  else if (alvo === 'paineis') abrirSub('p-visao');
  else if (alvo === 'passos') abrirAba('passos');

  // Filtros da página inteira
  const selAno = raiz.querySelector('#sel-ano');
  const selLim = raiz.querySelector('#sel-limiar');
  if (selAno) { selAno.value = String(OBX.param('ano')); selAno.addEventListener('change', () => { OB.ufs = null; dash.setParams({ ano: Number(selAno.value) }); }); }
  if (selLim) { selLim.value = String(OBX.param('limiar')); selLim.addEventListener('change', () => { OB.ufs = null; dash.setParams({ limiar: Number(selLim.value) }); }); }

  // Controles locais de cada painel
  const liga = (sel, chave, desenhos) => {
    const el = raiz.querySelector(sel);
    if (!el) return;
    el.value = OB[chave];
    el.addEventListener('change', () => { OB[chave] = el.value; desenhos.forEach((d) => dash.draw(d)); });
  };
  liga('#sel-ind-mapa', 'indMapa', ['mapa', 'rank']);
  liga('#sel-x', 'x', ['cruz', 'corr-r', 'corr-leitura']);
  liga('#sel-y', 'y', ['cruz', 'corr-r', 'corr-leitura']);
  liga('#sel-per', 'per', ['cruz', 'corr', 'corr-r', 'corr-leitura']);
  liga('#sel-ind-tend', 'indTend', ['tend']);
  liga('#sel-val', 'val', ['bm-reg', 'bm-tab', 'bt-reg', 'bt-tab']);
  liga('#sel-base', 'base', ['delta']);
  liga('#sel-ind-calor', 'indCalor', ['calor']);
})();

// ---------------------------------------------------------------------
// Ferramentas de desenho
// ---------------------------------------------------------------------

// Estado de um conjunto de fontes: 'ok', 'carregando' ou 'erro'
OBX.estado = function (...ids) {
  const st = ids.map((id) => dash.data(id).status);
  if (st.every((s) => s === 'ok')) return 'ok';
  if (st.some((s) => s === 'error' || s === 'missing' || s === 'declined')) return 'erro';
  return 'carregando';
};
OBX.vazio = function (el, estado, texto) {
  el.replaceChildren();
  const p = document.createElement('p');
  p.className = 'ob-cap';
  p.textContent = estado === 'erro' ? 'Não foi possível carregar.' : (texto || 'Carregando…');
  el.appendChild(p);
};

// Dica (tooltip) dentro do próprio gráfico
OBX.dica = function (caixa) {
  const t = document.createElement('div');
  t.className = 'ob-tip';
  t.hidden = true;
  caixa.appendChild(t);
  return {
    mostrar(evento, linhas) {
      t.replaceChildren(...linhas.map((texto, i) => {
        const d = document.createElement('div');
        d.textContent = texto;
        if (i === 0) d.className = 'ob-tip-t';
        return d;
      }));
      t.hidden = false;
      const r = caixa.getBoundingClientRect();
      let x = evento.clientX - r.left + 14, y = evento.clientY - r.top + 14;
      if (x + t.offsetWidth > r.width) x = Math.max(0, evento.clientX - r.left - t.offsetWidth - 14);
      if (y + t.offsetHeight > r.height) y = Math.max(0, evento.clientY - r.top - t.offsetHeight - 14);
      t.style.left = x + 'px';
      t.style.top = y + 'px';
    },
    esconder() { t.hidden = true; },
  };
};

// Largura do maior rótulo, medida no próprio SVG
OBX.largura = function (svg, textos, classe) {
  const g = svg.append('g').attr('class', classe || 'ob-axis').attr('opacity', 0);
  let w = 0;
  textos.forEach((t) => { const n = g.append('text').text(t).node(); w = Math.max(w, n.getComputedTextLength()); });
  g.remove();
  return w;
};

// Gráfico de linhas por ano
// cfg: { series: [{nome, cor, largura?, pontos: [{x, y}]}], fmt, aria, altura?, ref?: {y, rotulo}, destaque?: ano, anotar?: [{x, rotulo}], yZero? }
OBX.linhas = function (el, cfg) {
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth || 600), H = cfg.altura || 280;
  const pontos = cfg.series.flatMap((s) => s.pontos.filter((p) => p.y != null));
  if (!pontos.length) { OBX.vazio(el, 'ok', 'Sem dados para esta seleção.'); return; }
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', cfg.aria);
  const xs = d3.extent(pontos, (p) => p.x);
  let ymin = cfg.yZero === false ? d3.min(pontos, (p) => p.y) : 0;
  let ymax = d3.max(pontos, (p) => p.y);
  if (cfg.ref) { ymax = Math.max(ymax, cfg.ref.y); ymin = Math.min(ymin, cfg.ref.y); }
  const y = d3.scaleLinear().domain([ymin, ymax]).nice(5);
  const ticks = y.ticks(5);
  const fEixo = cfg.fmtEixo || cfg.fmt;
  const lw = OBX.largura(svg, ticks.map(fEixo));
  const nomes = cfg.series.map((s) => s.nome);
  const ew = cfg.series.length > 1 ? OBX.largura(svg, nomes, 'ob-lbl') : 0;
  const m = { t: 14, r: ew ? ew + 16 : 18, b: 26, l: lw + 12 };
  const x = d3.scaleLinear().domain(xs).range([m.l, W - m.r]);
  y.range([H - m.b, m.t]);

  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(ticks).join('line')
    .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t));
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(${m.l},0)`)
    
    .call(d3.axisLeft(y).tickValues(ticks).tickFormat(fEixo).tickSize(0).tickPadding(8)).call((g) => g.select('.domain').remove());
  const anos = d3.range(xs[0], xs[1] + 1);
  const passo = W < 460 ? 2 : 1;
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(anos.filter((a, i) => i % passo === 0)).tickFormat(d3.format('d')).tickSize(4));

  if (cfg.destaque != null && cfg.destaque >= xs[0] && cfg.destaque <= xs[1]) {
    svg.append('rect').attr('x', x(cfg.destaque) - 14).attr('width', 28).attr('y', m.t).attr('height', H - m.b - m.t)
      .attr('fill', COR.verde).attr('opacity', 0.1);
  }
  (cfg.anotar || []).forEach((a) => {
    if (a.x < xs[0] || a.x > xs[1]) return;
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', x(a.x)).attr('y', m.t + 10).attr('text-anchor', 'middle').text(a.rotulo);
  });
  if (cfg.ref) {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(cfg.ref.y)).attr('y2', y(cfg.ref.y))
      .attr('stroke', COR.muted).attr('stroke-dasharray', '5 4');
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', m.l + 4).attr('y', y(cfg.ref.y) - 5).text(cfg.ref.rotulo);
  }
  const linha = d3.line().defined((p) => p.y != null).x((p) => x(p.x)).y((p) => y(p.y));
  cfg.series.forEach((s) => {
    svg.append('path').datum(s.pontos).attr('fill', 'none').attr('stroke', s.cor).attr('stroke-width', s.largura || 2.2).attr('d', linha);
    svg.append('g').selectAll('circle').data(s.pontos.filter((p) => p.y != null)).join('circle')
      .attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => (p.x === cfg.destaque ? 4.5 : 2.6)).attr('fill', s.cor);
  });
  // Rótulos no fim das linhas, afastados para não se sobreporem
  if (ew) {
    const fins = cfg.series.map((s) => { const u = s.pontos.filter((p) => p.y != null).at(-1); return u ? { nome: s.nome, cor: s.cor, y: y(u.y) } : null; }).filter(Boolean)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 13) fins[i].y = fins[i - 1].y + 13;
    svg.append('g').selectAll('text').data(fins).join('text').attr('class', 'ob-lbl').attr('x', W - m.r + 6).attr('y', (f) => f.y + 4)
      .attr('fill', (f) => f.cor).style('fill', (f) => f.cor).style('font-weight', 700).text((f) => f.nome);
  }
  // Dica ao passar o mouse: todos os valores do ano mais próximo
  const dica = OBX.dica(el);
  const guia = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', COR.cinza).attr('opacity', 0);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const ano = Math.round(x.invert(d3.pointer(ev)[0]));
      guia.attr('x1', x(ano)).attr('x2', x(ano)).attr('opacity', 1);
      const linhas = [String(ano)].concat(cfg.series.map((s) => {
        const p = s.pontos.find((q) => q.x === ano);
        return `${s.nome}: ${p && p.y != null ? cfg.fmt(p.y) : 'sem dado'}`;
      }));
      dica.mostrar(ev, linhas);
    })
    .on('mouseleave', () => { guia.attr('opacity', 0); dica.esconder(); });
};

// Gráfico de dispersão
// cfg: { pontos: [{x, y, r?, cor, rotulo, dica: []}], fx, fy, nomeX, nomeY, aria, altura?, linhasRef?: {x?, y?, rotX?, rotY?}, reta?: bool }
OBX.dispersao = function (el, cfg) {
  el.replaceChildren();
  const W = Math.max(280, el.clientWidth || 600), H = cfg.altura || 420;
  const pts = cfg.pontos.filter((p) => p.x != null && p.y != null);
  if (!pts.length) { OBX.vazio(el, 'ok', 'Sem dados para esta seleção.'); return; }
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', cfg.aria);
  const ext = (acc, ref) => { let [a, b] = d3.extent(pts, acc); if (ref != null) { a = Math.min(a, ref); b = Math.max(b, ref); } const pad = (b - a) * 0.06 || 1; return [a - pad, b + pad]; };
  const x = d3.scaleLinear().domain(ext((p) => p.x, cfg.linhasRef && cfg.linhasRef.x)).nice();
  const y = d3.scaleLinear().domain(ext((p) => p.y, cfg.linhasRef && cfg.linhasRef.y)).nice();
  const ty = y.ticks(6);
  const lw = OBX.largura(svg, ty.map(cfg.fy));
  const m = { t: 16, r: 22, b: 44, l: lw + 34 };
  x.range([m.l, W - m.r]); y.range([H - m.b, m.t]);
  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(ty).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t));
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(ty).tickFormat(cfg.fy).tickSize(0).tickPadding(8)).call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 460 ? 4 : 7).tickFormat(cfg.fx));
  svg.append('text').attr('class', 'ob-lbl-m').attr('x', (m.l + W - m.r) / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(cfg.nomeX);
  svg.append('text').attr('class', 'ob-lbl-m').attr('transform', `translate(12,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(cfg.nomeY);

  const ref = cfg.linhasRef || {};
  if (ref.x != null) {
    svg.append('line').attr('x1', x(ref.x)).attr('x2', x(ref.x)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', COR.muted).attr('stroke-dasharray', '5 4');
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', x(ref.x) + 5).attr('y', m.t + 10).text(ref.rotX);
  }
  if (ref.y != null) {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(ref.y)).attr('y2', y(ref.y)).attr('stroke', COR.muted).attr('stroke-dasharray', '5 4');
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', W - m.r - 4).attr('y', y(ref.y) - 6).attr('text-anchor', 'end').text(ref.rotY);
  }
  if (cfg.reta && pts.length > 2) {
    const mx = d3.mean(pts, (p) => p.x), my = d3.mean(pts, (p) => p.y);
    const b = d3.sum(pts, (p) => (p.x - mx) * (p.y - my)) / d3.sum(pts, (p) => (p.x - mx) ** 2);
    const a = my - b * mx;
    const [x0, x1] = x.domain();
    svg.append('line').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(a + b * x0)).attr('y2', y(a + b * x1))
      .attr('stroke', COR.azul).attr('stroke-width', 1.5).attr('stroke-dasharray', '2 3');
  }
  const dica = OBX.dica(el);
  const g = svg.append('g');
  g.selectAll('circle').data(pts).join('circle')
    .attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => p.r || 5)
    .attr('fill', (p) => p.cor).attr('fill-opacity', 0.78).attr('stroke', '#FFFFFF').attr('stroke-width', 1)
    .on('mousemove', (ev, p) => dica.mostrar(ev, p.dica)).on('mouseleave', () => dica.esconder());
  if (cfg.rotulos !== false) {
    g.selectAll('text').data(pts).join('text').attr('class', 'ob-lbl').attr('x', (p) => x(p.x) + (p.r || 5) + 3).attr('y', (p) => y(p.y) + 4)
      .style('pointer-events', 'none').text((p) => p.rotulo);
  }
};
