{
// =====================================================================
// Observatório da Hepatite B: desenhos dos painéis
// =====================================================================
const { FMT, COR, COR_REGIAO, COR_PRIOR, IND } = window.OBX;

// Codifica um valor para data-where / data-key
const cod = (v) => String(v).replace(/%/g, '%25').replace(/&/g, '%26').replace(/=/g, '%3D').replace(/,/g, '%2C');
const preencher = (tpl) => tpl.replace(/\{ano\}/g, OBX.param('ano')).replace(/\{limiar\}/g, OBX.param('limiar'));
const pares = (onde) => onde.split('&').filter(Boolean).map((p) => { const i = p.indexOf('='); return [p.slice(0, i), p.slice(i + 1)]; });
const achar = (linhas, onde) => { const ps = pares(onde); return linhas.find((r) => ps.every(([k, v]) => String(r[k]) === v)); };
const ondeCod = (onde) => pares(onde).map(([k, v]) => `${cod(k)}=${cod(v)}`).join('&');
const fmtV = (v, f) => (v == null ? 'sem dado' : FMT[f](v));
const td = (tr, texto, classe) => { const c = tr.insertCell(); c.textContent = texto; if (classe) c.className = classe; return c; };
const PALETA = [COR.azul, COR.verde, COR.crit, COR.warn, COR.teal, COR.azulC, COR.verdeC, '#6C4AB6', '#8C6D1F', '#D35D8A'];

// ---------------------------------------------------------------------
// Números em frases e cartões
// ---------------------------------------------------------------------
dash.draw('p', (el) => { el.textContent = String(OBX.param(el.dataset.param)); });

dash.draw('val', (el) => {
  const src = el.dataset.src, campo = el.dataset.campo, onde = preencher(el.dataset.onde || '');
  el.setAttribute('data-source', src);
  el.setAttribute('data-field', campo);
  el.setAttribute('data-where', ondeCod(onde));
  el.classList.remove('ob-good', 'ob-bad');
  const d = dash.data(src);
  if (d.status !== 'ok') { el.textContent = '—'; return; }
  const linha = achar(d.data, onde);
  const v = linha ? linha[campo] : null;
  el.textContent = fmtV(v, el.dataset.fmt || 'n2');
  if (el.dataset.bom && v != null && v !== 0) {
    const bom = el.dataset.bom === 'neg' ? v < 0 : v > 0;
    el.classList.add(bom ? 'ob-good' : 'ob-bad');
  }
});

// ---------------------------------------------------------------------
// Visão geral
// ---------------------------------------------------------------------
dash.draw('g-nacional', (el) => {
  const est = OBX.estado('nacional');
  if (est !== 'ok') return OBX.vazio(el, est);
  const linhas = dash.data('nacional').data;
  OBX.linhas(el, {
    series: [{ nome: 'Brasil', cor: COR.azul, largura: 3, pontos: linhas.map((r) => ({ x: r.ano, y: r.taxa })) }],
    fmt: FMT.n2, fmtEixo: FMT.n0, destaque: OBX.param('ano'), anotar: [{ x: 2020, rotulo: 'pandemia' }],
    aria: 'Linha da taxa nacional de hepatites virais por 100 mil habitantes, de 2013 a 2022',
  });
});

dash.draw('g-cobertura', (el) => {
  const est = OBX.estado('nacional');
  if (est !== 'ok') return OBX.vazio(el, est);
  const linhas = dash.data('nacional').data;
  OBX.linhas(el, {
    series: [
      { nome: 'Hepatite B', cor: COR.azul, pontos: linhas.map((r) => ({ x: r.ano, y: r.cob_hepb_media })) },
      { nome: 'Hepatite A', cor: COR.verde, pontos: linhas.map((r) => ({ x: r.ano, y: r.cob_hepa_media })) },
    ],
    fmt: FMT.n1, fmtEixo: FMT.n0, destaque: OBX.param('ano'),
    ref: { y: OBX.param('limiar'), rotulo: `limiar ${OBX.param('limiar')}%` },
    aria: 'Linhas da cobertura vacinal média das UFs contra hepatite B e hepatite A, de 2013 a 2022',
  });
});

dash.draw('g-regional', (el) => {
  const est = OBX.estado('regional', 'nacional');
  if (est !== 'ok') return OBX.vazio(el, est);
  const reg = dash.data('regional').data, nac = dash.data('nacional').data;
  const series = Object.keys(COR_REGIAO).map((nome) => ({
    nome, cor: COR_REGIAO[nome], pontos: reg.filter((r) => r.regiao === nome).map((r) => ({ x: r.ano, y: r.taxa })),
  }));
  series.push({ nome: 'Brasil', cor: COR.texto, largura: 3.2, pontos: nac.map((r) => ({ x: r.ano, y: r.taxa })) });
  OBX.linhas(el, { series, fmt: FMT.n2, fmtEixo: FMT.n0, destaque: OBX.param('ano'), altura: 320,
    aria: 'Linhas da taxa de hepatites virais por região e do Brasil, de 2013 a 2022' });
});

// ---------------------------------------------------------------------
// Mapa por UF (mapa em quadrados)
// ---------------------------------------------------------------------
const GRADE = {
  RR: [1, 0], AP: [3, 0],
  AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
  AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [1, 3], GO: [2, 3], DF: [3, 3], BA: [4, 3], AL: [5, 3],
  MS: [1, 4], MG: [2, 4], ES: [3, 4], SE: [5, 4],
  PR: [1, 5], SP: [2, 5], RJ: [3, 5],
  SC: [1, 6],
  RS: [1, 7],
};
const COR_IND = { taxa: COR.azul, casos: COR.azul, cob_hepb: COR.verde, cob_hepa: COR.verde, natalidade: COR.teal };

dash.draw('mapa', (el) => {
  const ind = OB.indMapa, ano = OBX.param('ano'), limiar = OBX.param('limiar');
  const fontes = ind === 'prioridade' ? ['indicadores', 'criterios'] : ['indicadores'];
  const est = OBX.estado(...fontes);
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const linhas = dash.data('indicadores').data.filter((r) => Number(r.ano) === ano);
  const crit = ind === 'prioridade' ? dash.data('criterios').data.filter((r) => r.ano_ref === ano && r.limiar === limiar) : [];
  const porUf = new Map(linhas.map((r) => [r.uf, r]));
  const priUf = new Map(crit.map((r) => [r.uf, r]));
  const W = Math.max(280, el.clientWidth || 500);
  const s = Math.min(64, (W - 8) / 7);
  const H = s * 8 + 46;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Mapa em quadrados das 27 UFs: ${ind === 'prioridade' ? 'prioridade' : IND[ind].nome}, ${ano}`);
  const valores = linhas.map((r) => r[ind]).filter((v) => v != null);
  const esc = ind === 'prioridade' ? null : d3.scaleLinear().domain(d3.extent(valores)).range([0.12, 0.95]);
  const dica = OBX.dica(el);
  const g = svg.append('g').attr('transform', `translate(${(W - 7 * s) / 2},4)`);
  Object.entries(GRADE).forEach(([uf, [c, r]]) => {
    const linha = porUf.get(uf);
    const v = linha ? linha[ind] : null;
    const pr = priUf.get(uf);
    let cor, opac;
    if (ind === 'prioridade') { cor = pr ? COR_PRIOR[pr.prioridade] : COR.baixa; opac = 0.9; }
    else { cor = COR_IND[ind]; opac = v == null ? 0.05 : esc(v); }
    const escuro = ind === 'prioridade' ? (pr && pr.prioridade !== 'Baixa') : opac > 0.55;
    const tile = g.append('g').attr('class', 'ob-tile').attr('transform', `translate(${c * s},${r * s})`);
    tile.append('rect').attr('width', s - 3).attr('height', s - 3).attr('fill', cor).attr('fill-opacity', opac)
      .attr('stroke', cor).attr('stroke-opacity', 0.5);
    tile.append('text').attr('x', (s - 3) / 2).attr('y', s * 0.42).attr('text-anchor', 'middle')
      .style('fill', escuro ? '#FFFFFF' : COR.texto).style('font-weight', 700).style('font-size', `${Math.max(10, s * 0.24)}px`).text(uf);
    const t = tile.append('text').attr('x', (s - 3) / 2).attr('y', s * 0.72).attr('text-anchor', 'middle')
      .style('fill', escuro ? '#FFFFFF' : COR.texto).style('font-size', `${Math.max(9, s * 0.17)}px`);
    if (ind === 'prioridade') {
      t.text(pr ? pr.prioridade : '').attr('data-source', 'criterios').attr('data-field', 'prioridade')
        .attr('data-where', `ano_ref=${ano}&limiar=${limiar}&uf=${uf}`);
    } else {
      t.text(v == null ? 's/d' : (ind === 'casos' ? FMT.n0(v) : FMT.n1(v))).attr('data-source', 'indicadores').attr('data-field', ind)
        .attr('data-where', `uf=${uf}&ano=${ano}`);
    }
    tile.on('mousemove', (ev) => {
      const l = linha || {};
      const txt = [`${l.nome_uf || uf} (${l.regiao || ''}), ${ano}`,
        `Taxa: ${fmtV(l.taxa, 'n2')} por 100 mil`, `Casos: ${fmtV(l.casos, 'n0')}`,
        `Cobertura hepatite B: ${fmtV(l.cob_hepb, 'n1')}%`, `Cobertura hepatite A: ${fmtV(l.cob_hepa, 'n1')}%`,
        `Natalidade: ${fmtV(l.natalidade, 'n2')} por mil`];
      if (pr) txt.push(`Prioridade: ${pr.prioridade}`);
      dica.mostrar(ev, txt);
    }).on('mouseleave', () => dica.esconder());
  });
  // Legenda
  const ly = 8 * s + 14, lx = (W - 7 * s) / 2;
  if (ind === 'prioridade') {
    ['Alta', 'Média', 'Baixa'].forEach((p, i) => {
      svg.append('rect').attr('x', lx + i * 90).attr('y', ly).attr('width', 12).attr('height', 12).attr('fill', COR_PRIOR[p]);
      svg.append('text').attr('class', 'ob-lbl-m').attr('x', lx + i * 90 + 18).attr('y', ly + 10).text(p);
    });
  } else {
    const [a, b] = d3.extent(valores);
    const id = 'grad-' + ind;
    const grad = svg.append('defs').append('linearGradient').attr('id', id);
    grad.append('stop').attr('offset', '0%').attr('stop-color', COR_IND[ind]).attr('stop-opacity', 0.12);
    grad.append('stop').attr('offset', '100%').attr('stop-color', COR_IND[ind]).attr('stop-opacity', 0.95);
    const lw = Math.min(220, 7 * s - 120);
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', lx).attr('y', ly + 10).text(ind === 'casos' ? FMT.n0(a) : FMT.n1(a));
    const x0 = lx + OBX.largura(svg, [ind === 'casos' ? FMT.n0(a) : FMT.n1(a)], 'ob-lbl-m') + 8;
    svg.append('rect').attr('x', x0).attr('y', ly).attr('width', lw).attr('height', 12).attr('fill', `url(#${id})`);
    svg.append('text').attr('class', 'ob-lbl-m').attr('x', x0 + lw + 8).attr('y', ly + 10).text(ind === 'casos' ? FMT.n0(b) : FMT.n1(b));
  }
});

dash.draw('rank', (el) => {
  const ind = OB.indMapa, ano = OBX.param('ano'), limiar = OBX.param('limiar');
  el.replaceChildren();
  const prior = ind === 'prioridade';
  const fonte = prior ? 'criterios' : 'indicadores';
  el.setAttribute('data-source', fonte);
  el.setAttribute('data-row-key', prior ? 'ano_ref,limiar,uf' : 'uf,ano');
  const cab = el.createTHead().insertRow();
  [['Posição', null], ['UF', 'uf'], ['Região', 'regiao'], [prior ? 'Prioridade' : IND[ind].curto, prior ? 'prioridade' : ind]].forEach(([t, f], i) => {
    const th = document.createElement('th');
    th.textContent = t;
    if (f) th.setAttribute('data-field', f);
    if (i === 3 && !prior) th.className = 'n';
    cab.appendChild(th);
  });
  const corpo = el.createTBody();
  if (dash.data(fonte).status !== 'ok') return;
  let linhas;
  if (prior) {
    linhas = dash.data('criterios').data.filter((r) => r.ano_ref === ano && r.limiar === limiar);
  } else {
    linhas = dash.data('indicadores').data.filter((r) => Number(r.ano) === ano)
      .sort((a, b) => (b[ind] ?? -Infinity) - (a[ind] ?? -Infinity));
  }
  linhas.forEach((r, i) => {
    const tr = corpo.insertRow();
    tr.setAttribute('data-key', prior ? `${r.ano_ref},${r.limiar},${r.uf}` : `${r.uf},${r.ano}`);
    td(tr, `${i + 1}º`);
    td(tr, r.uf); td(tr, r.regiao);
    if (prior) { const c = tr.insertCell(); const sp = document.createElement('span'); sp.className = `ob-pill ${r.prioridade}`; sp.textContent = r.prioridade; c.appendChild(sp); }
    else td(tr, fmtV(r[ind], ind === 'casos' ? 'n0' : (ind === 'taxa' || ind === 'natalidade' ? 'n2' : 'n1')), 'n');
  });
});

// ---------------------------------------------------------------------
// Cruzamentos
// ---------------------------------------------------------------------
const periodo = () => (OB.per === 'ano' ? String(OBX.param('ano')) : '2014-2022');
const linhaCorr = (x, y) => {
  const d = dash.data('correlacoes');
  if (d.status !== 'ok') return null;
  const p = periodo();
  return d.data.find((r) => r.periodo === p && ((r.x === x && r.y === y) || (r.x === y && r.y === x))) || null;
};

dash.draw('cruz', (el) => {
  const est = OBX.estado('indicadores');
  if (est !== 'ok') return OBX.vazio(el, est);
  const ano = OBX.param('ano');
  const todos = OB.per !== 'ano';
  const linhas = dash.data('indicadores').data.filter((r) => (todos ? Number(r.ano) >= 2014 : Number(r.ano) === ano));
  const ix = IND[OB.x], iy = IND[OB.y];
  OBX.dispersao(el, {
    pontos: linhas.map((r) => ({
      x: r[OB.x], y: r[OB.y], cor: COR_REGIAO[r.regiao], r: todos ? 4 : 6, rotulo: r.uf,
      dica: [`${r.nome_uf} (${r.uf}), ${r.ano}`, `${ix.curto}: ${fmtV(r[OB.x], 'n2')}`, `${iy.curto}: ${fmtV(r[OB.y], 'n2')}`, `Região: ${r.regiao}`],
    })),
    fx: FMT.n0, fy: FMT.n0, nomeX: ix.nome, nomeY: iy.nome, reta: true, rotulos: !todos,
    aria: `Dispersão por UF: ${iy.nome} em função de ${ix.nome}, ${todos ? '2014 a 2022' : ano}`,
  });
});

dash.draw('leg-regiao', (el) => {
  el.replaceChildren(...Object.entries(COR_REGIAO).map(([nome, cor]) => {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor;
    s.append(i, nome); return s;
  }));
});

dash.draw('corr-r', (el) => {
  const r = OB.x === OB.y ? null : linhaCorr(OB.x, OB.y);
  if (r) el.setAttribute('data-where', `periodo=${cod(r.periodo)}&x=${r.x}&y=${r.y}`);
  else el.removeAttribute('data-where');
  el.textContent = r ? FMT.n3(r.r) : '—';
});

dash.draw('corr-leitura', (el) => {
  if (OB.x === OB.y) { el.textContent = '(escolha dois indicadores diferentes)'; return; }
  const r = linhaCorr(OB.x, OB.y);
  if (!r) { el.textContent = ''; return; }
  const a = Math.abs(r.r);
  const forca = a < 0.2 ? 'praticamente nula' : a < 0.4 ? 'fraca' : a < 0.7 ? 'moderada' : 'forte';
  el.textContent = `(relação ${forca}${a >= 0.2 ? (r.r > 0 ? ' e positiva' : ' e negativa') : ''}; ${OB.per === 'ano' ? 'ano ' + r.periodo : 'todos os anos de 2014 a 2022'})`;
});

dash.draw('corr', (el) => {
  const est = OBX.estado('correlacoes');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const ordem = ['taxa', 'taxa_ano_anterior', 'cob_hepb', 'cob_hepa', 'natalidade'];
  const curto = { taxa: 'Taxa', taxa_ano_anterior: 'Taxa ano anterior', cob_hepb: 'Cobertura hep. B', cob_hepa: 'Cobertura hep. A', natalidade: 'Natalidade' };
  const W = Math.max(280, el.clientWidth || 600);
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', `Matriz de correlação entre indicadores, ${periodo()}`);
  const lw = OBX.largura(svg, Object.values(curto), 'ob-lbl') + 12;
  const cel = Math.min(86, (W - lw) / 5);
  const H = 34 + cel * 5 + 4;
  svg.attr('width', W).attr('height', H);
  const dica = OBX.dica(el);
  ordem.forEach((a, j) => {
    svg.append('text').attr('class', 'ob-lbl').attr('x', lw + j * cel + cel / 2).attr('y', 22).attr('text-anchor', 'middle')
      .style('font-size', cel < 70 ? '10px' : null).text(cel < 70 ? curto[a].replace('Cobertura ', 'Cob. ') : curto[a]);
  });
  ordem.forEach((a, i) => {
    svg.append('text').attr('class', 'ob-lbl').attr('x', lw - 8).attr('y', 34 + i * cel + cel / 2 + 4).attr('text-anchor', 'end').text(curto[a]);
    ordem.forEach((b, j) => {
      const r = a === b ? null : linhaCorr(a, b);
      const v = a === b ? 1 : (r ? r.r : null);
      const gx = lw + j * cel, gy = 34 + i * cel;
      svg.append('rect').attr('x', gx + 1).attr('y', gy + 1).attr('width', cel - 2).attr('height', cel - 2)
        .attr('fill', v == null ? '#EEF2F6' : (v >= 0 ? COR.azul : COR.teal)).attr('fill-opacity', v == null ? 1 : Math.max(0.06, Math.abs(v) * 0.9))
        .on('mousemove', (ev) => dica.mostrar(ev, [`${curto[a]} x ${curto[b]}`, v == null ? 'sem dado' : `r = ${FMT.n3(v)}`, r ? `${r.n} pares UF e ano` : '']))
        .on('mouseleave', () => dica.esconder());
      const t = svg.append('text').attr('x', gx + cel / 2).attr('y', gy + cel / 2 + 4).attr('text-anchor', 'middle').style('pointer-events', 'none')
        .style('font-weight', 700).style('font-size', '12px').style('fill', v != null && Math.abs(v) > 0.55 ? '#FFFFFF' : COR.texto)
        .text(v == null ? '' : (a === b ? '1' : FMT.n2(v)));
      if (r) t.attr('data-source', 'correlacoes').attr('data-field', 'r').attr('data-where', `periodo=${cod(r.periodo)}&x=${r.x}&y=${r.y}`);
    });
  });
});

// ---------------------------------------------------------------------
// Critérios e prioridade
// ---------------------------------------------------------------------
const critAtual = () => {
  const ano = OBX.param('ano'), limiar = OBX.param('limiar');
  return dash.data('criterios').data.filter((r) => r.ano_ref === ano && r.limiar === limiar);
};
const resumoAtual = () => {
  const ano = OBX.param('ano'), limiar = OBX.param('limiar');
  return dash.data('criterios_resumo').data.find((r) => r.ano_ref === ano && r.limiar === limiar);
};

dash.draw('crit-sc', (el) => {
  const est = OBX.estado('criterios', 'criterios_resumo');
  if (est !== 'ok') return OBX.vazio(el, est);
  const linhas = critAtual(), res = resumoAtual();
  const raio = d3.scaleSqrt().domain([0, d3.max(linhas, (r) => r.casos) || 1]).range([4, 18]);
  const sim = (r) => ['C1', 'C2', 'C3', 'C4'].filter((c, i) => r[['C1_cobertura_baixa', 'C2_taxa_alta', 'C3_cobertura_caindo', 'C4_taxa_resistente'][i]] === 'Sim');
  OBX.dispersao(el, {
    pontos: linhas.map((r) => ({
      x: r.cob_hepb, y: r.taxa, r: raio(r.casos), cor: COR_PRIOR[r.prioridade], rotulo: r.uf,
      dica: [`${r.uf} (${r.regiao}): prioridade ${r.prioridade}`, `Taxa: ${fmtV(r.taxa, 'n2')} por 100 mil`, `Cobertura hepatite B: ${fmtV(r.cob_hepb, 'n1')}%`,
        `Casos: ${fmtV(r.casos, 'n0')}`, `Critérios atendidos: ${sim(r).join(', ') || 'nenhum'}`],
    })),
    fx: FMT.n0, fy: FMT.n0, nomeX: IND.cob_hepb.nome, nomeY: IND.taxa.nome,
    linhasRef: { x: OBX.param('limiar'), y: res ? res.taxa_br : null, rotX: `limiar ${OBX.param('limiar')}%`, rotY: 'taxa nacional' },
    aria: `Dispersão das UFs: taxa de detecção em função da cobertura de hepatite B, ${OBX.param('ano')}, coloridas pela prioridade`,
  });
});

dash.draw('crit-tab', (el) => {
  el.replaceChildren();
  if (dash.data('criterios').status !== 'ok') return;
  critAtual().forEach((r) => {
    const tr = el.insertRow();
    tr.setAttribute('data-key', `${r.ano_ref},${r.limiar},${r.uf}`);
    td(tr, r.uf); td(tr, r.regiao);
    td(tr, fmtV(r.taxa, 'n2'), 'n'); td(tr, fmtV(r.cob_hepb, 'n1'), 'n');
    td(tr, fmtV(r.tend_taxa_rel, 'n1'), 'n'); td(tr, fmtV(r.tend_cob_hepb, 'n2'), 'n');
    ['C1_cobertura_baixa', 'C2_taxa_alta', 'C3_cobertura_caindo', 'C4_taxa_resistente'].forEach((c) => td(tr, r[c]));
    const c = tr.insertCell(); const sp = document.createElement('span'); sp.className = `ob-pill ${r.prioridade}`; sp.textContent = r.prioridade; c.appendChild(sp);
  });
});

// ---------------------------------------------------------------------
// Tendências
// ---------------------------------------------------------------------
const ufsPadrao = () => {
  if (OB.ufs) return OB.ufs;
  if (dash.data('criterios').status !== 'ok') return ['SP', 'RS', 'AC'];
  const altas = critAtual().filter((r) => r.prioridade === 'Alta').map((r) => r.uf);
  OB.ufs = (altas.length ? altas : ['SP', 'RS', 'AC']).slice(0, 8);
  return OB.ufs;
};

dash.draw('tend-ufs', (el) => {
  el.replaceChildren();
  const d = dash.data('indicadores');
  if (d.status !== 'ok') return;
  const ufs = Array.from(new Set(d.data.map((r) => r.uf))).sort();
  const sel = ufsPadrao();
  ufs.forEach((uf) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ob-chip'; b.textContent = uf;
    b.setAttribute('aria-pressed', String(sel.includes(uf)));
    b.addEventListener('click', () => {
      const atual = ufsPadrao();
      OB.ufs = atual.includes(uf) ? atual.filter((u) => u !== uf) : atual.concat(uf);
      dash.draw('tend-ufs'); dash.draw('tend');
    });
    el.appendChild(b);
  });
});

dash.draw('tend', (el) => {
  const est = OBX.estado('indicadores', 'nacional');
  if (est !== 'ok') return OBX.vazio(el, est);
  const ind = OB.indTend;
  const ufs = ufsPadrao();
  const dados = dash.data('indicadores').data;
  const series = ufs.map((uf, i) => ({
    nome: uf, cor: PALETA[i % PALETA.length], largura: 1.8,
    pontos: dados.filter((r) => r.uf === uf).map((r) => ({ x: Number(r.ano), y: r[ind] })),
  }));
  const campoBr = { taxa: 'taxa', cob_hepb: 'cob_hepb_media', cob_hepa: 'cob_hepa_media', natalidade: 'natalidade' }[ind];
  series.push({ nome: 'Brasil', cor: COR.texto, largura: 3.4, pontos: dash.data('nacional').data.map((r) => ({ x: r.ano, y: r[campoBr] })) });
  OBX.linhas(el, {
    series, fmt: ind === 'taxa' || ind === 'natalidade' ? FMT.n2 : FMT.n1, fmtEixo: FMT.n0, destaque: OBX.param('ano'), altura: 400,
    ref: ind.startsWith('cob') ? { y: OBX.param('limiar'), rotulo: `limiar ${OBX.param('limiar')}%` } : null,
    aria: `Linhas de ${IND[ind].nome} das UFs ${ufs.join(', ')} e do Brasil, 2013 a 2022`,
  });
});

dash.draw('tend-bar', (el) => {
  const est = OBX.estado('criterios', 'criterios_resumo');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const linhas = critAtual().slice().sort((a, b) => a.tend_taxa_rel - b.tend_taxa_rel);
  const res = resumoAtual();
  const W = Math.max(280, el.clientWidth || 600), H = 380;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', 'Barras da tendência da taxa de detecção por UF, em % ao ano, ordenadas da maior queda para a menor');
  const vals = linhas.map((r) => r.tend_taxa_rel).concat(res ? [res.tend_taxa_br] : []);
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(vals)), Math.max(0, d3.max(vals))]).nice();
  const ticks = y.ticks(6);
  const lw = OBX.largura(svg, ticks.map(FMT.n0));
  const m = { t: 14, r: 12, b: 30, l: lw + 14 };
  const x = d3.scaleBand().domain(linhas.map((r) => r.uf)).range([m.l, W - m.r]).padding(0.18);
  y.range([H - m.b, m.t]);
  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t));
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(ticks).tickFormat(FMT.n0).tickSize(0).tickPadding(8)).call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSize(0).tickPadding(8))
    .call((g) => g.select('.domain').remove()).selectAll('text').style('font-size', x.bandwidth() < 16 ? '9px' : null);
  const dica = OBX.dica(el);
  svg.append('g').selectAll('rect').data(linhas).join('rect')
    .attr('x', (r) => x(r.uf)).attr('width', x.bandwidth())
    .attr('y', (r) => y(Math.max(0, r.tend_taxa_rel))).attr('height', (r) => Math.abs(y(r.tend_taxa_rel) - y(0)))
    .attr('fill', (r) => COR_PRIOR[r.prioridade])
    .on('mousemove', (ev, r) => dica.mostrar(ev, [`${r.uf}: prioridade ${r.prioridade}`, `Tendência da taxa: ${FMT.n1(r.tend_taxa_rel)}% ao ano`, `Brasil: ${res ? FMT.n1(res.tend_taxa_br) : 'sem dado'}% ao ano`]))
    .on('mouseleave', () => dica.esconder());
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', COR.muted);
  if (res) {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(res.tend_taxa_br)).attr('y2', y(res.tend_taxa_br)).attr('stroke', COR.azul).attr('stroke-dasharray', '5 4').attr('stroke-width', 1.5);
    svg.append('text').attr('class', 'ob-lbl').attr('x', W - m.r - 4).attr('y', y(res.tend_taxa_br) + 14).attr('text-anchor', 'end').style('fill', COR.azul).style('font-weight', 700)
      .text(`Brasil: ${FMT.n1(res.tend_taxa_br)}% ao ano`);
  }
});

// ---------------------------------------------------------------------
// Mineração (benchmarking)
// ---------------------------------------------------------------------
const MODELOS = ['Repetir o ano anterior', 'Regressão Linear', 'KNN (k=5)', 'Árvore de Decisão', 'Random Forest', 'Gradient Boosting'];
const ATRIB = { 'Referência': COR.cinza, 'Sem histórico': COR.verde, 'Com taxa do ano anterior': COR.azul };

dash.draw('leg-atrib', (el) => {
  el.replaceChildren(...Object.entries(ATRIB).map(([nome, cor]) => {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor;
    s.append(i, nome === 'Referência' ? 'Referência (repetir o ano anterior)' : nome); return s;
  }));
});

dash.draw('bm-reg', (el) => {
  const est = OBX.estado('regressao');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const linhas = dash.data('regressao').data.filter((r) => r.validacao === OB.val);
  const W = Math.max(280, el.clientWidth || 600), H = 320;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Barras do RMSE por algoritmo e conjunto de atributos, validação ${OB.val}`);
  const y = d3.scaleLinear().domain([0, d3.max(linhas, (r) => r.RMSE) * 1.12]).nice();
  const ticks = y.ticks(5);
  const lw = OBX.largura(svg, ticks.map(FMT.n0));
  const m = { t: 18, r: 10, b: 46, l: lw + 14 };
  const x0 = d3.scaleBand().domain(MODELOS).range([m.l, W - m.r]).paddingInner(0.2).paddingOuter(0.05);
  y.range([H - m.b, m.t]);
  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(ticks).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', (t) => y(t)).attr('y2', (t) => y(t));
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(ticks).tickFormat(FMT.n0).tickSize(0).tickPadding(8)).call((g) => g.select('.domain').remove());
  // Rótulos do eixo em duas linhas
  MODELOS.forEach((mod) => {
    const t = svg.append('text').attr('class', 'ob-axis').attr('text-anchor', 'middle').attr('x', x0(mod) + x0.bandwidth() / 2).attr('y', H - m.b + 16);
    const p = mod.split(' ');
    const meio = Math.ceil(p.length / 2);
    [p.slice(0, meio).join(' '), p.slice(meio).join(' ')].filter(Boolean).forEach((txt, i) => {
      t.append('tspan').attr('x', x0(mod) + x0.bandwidth() / 2).attr('dy', i ? 13 : 0).style('fill', COR.muted).style('font-size', '11px').text(txt);
    });
  });
  const dica = OBX.dica(el);
  MODELOS.forEach((mod) => {
    const doModelo = linhas.filter((r) => r.modelo === mod);
    const x1 = d3.scaleBand().domain(doModelo.map((r) => r.atributos)).range([0, x0.bandwidth()]).padding(0.08);
    doModelo.forEach((r) => {
      const bx = x0(mod) + x1(r.atributos), bw = x1.bandwidth();
      svg.append('rect').attr('x', bx).attr('width', bw).attr('y', y(r.RMSE)).attr('height', y(0) - y(r.RMSE)).attr('fill', ATRIB[r.atributos])
        .on('mousemove', (ev) => dica.mostrar(ev, [`${r.modelo} (${r.atributos})`, `RMSE: ${FMT.n2(r.RMSE)}`, `MAE: ${FMT.n2(r.MAE)}`, `R²: ${FMT.n2(r.R2)}`, `Teste: ${r.n_teste} pares UF e ano`]))
        .on('mouseleave', () => dica.esconder());
      if (bw >= 22) {
        svg.append('text').attr('class', 'ob-lbl').attr('x', bx + bw / 2).attr('y', y(r.RMSE) - 4).attr('text-anchor', 'middle').style('font-size', '10.5px')
          .attr('data-source', 'regressao').attr('data-field', 'RMSE')
          .attr('data-where', `validacao=${cod(r.validacao)}&atributos=${cod(r.atributos)}&modelo=${cod(r.modelo)}`)
          .text(FMT.n1(r.RMSE));
      }
    });
  });
});

dash.draw('bm-tab', (el) => {
  el.replaceChildren();
  if (dash.data('regressao').status !== 'ok') return;
  const linhas = dash.data('regressao').data.filter((r) => r.validacao === OB.val);
  const melhor = linhas.filter((r) => r.atributos !== 'Referência').sort((a, b) => a.RMSE - b.RMSE)[0];
  linhas.forEach((r) => {
    const tr = el.insertRow();
    tr.setAttribute('data-key', `${cod(r.validacao)},${cod(r.atributos)},${cod(r.modelo)}`);
    if (r === melhor || r.atributos === 'Referência') tr.className = 'ob-hl';
    td(tr, r.atributos); td(tr, r.modelo);
    td(tr, FMT.n2(r.MAE), 'n'); td(tr, FMT.n2(r.RMSE), 'n'); td(tr, FMT.n2(r.R2), 'n'); td(tr, FMT.n1(r.tempo_ms), 'n');
  });
});

const NOME_ATRIB = { cob_hepb: 'Cobertura hepatite B', cob_hepa: 'Cobertura hepatite A', natalidade: 'Natalidade', ano: 'Ano', reg_N: 'Região Norte',
  reg_NE: 'Região Nordeste', reg_SE: 'Região Sudeste', reg_S: 'Região Sul', taxa_ano_anterior: 'Taxa do ano anterior' };

dash.draw('bm-imp', (el) => {
  const est = OBX.estado('importancia');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const linhas = dash.data('importancia').data.slice().sort((a, b) => b.importancia - a.importancia);
  const W = Math.max(280, el.clientWidth || 500), bh = 24, H = linhas.length * bh + 24;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', 'Barras da importância de cada atributo no Random Forest');
  const lw = OBX.largura(svg, linhas.map((r) => NOME_ATRIB[r.atributo] || r.atributo), 'ob-lbl') + 12;
  const vw = OBX.largura(svg, ['0,000'], 'ob-lbl') + 10;
  const x = d3.scaleLinear().domain([0, d3.max(linhas, (r) => r.importancia)]).range([lw, W - vw]);
  linhas.forEach((r, i) => {
    const yy = i * bh + 4;
    svg.append('text').attr('class', 'ob-lbl').attr('x', lw - 8).attr('y', yy + 14).attr('text-anchor', 'end').text(NOME_ATRIB[r.atributo] || r.atributo);
    svg.append('rect').attr('x', lw).attr('y', yy + 2).attr('width', Math.max(1, x(r.importancia) - lw)).attr('height', bh - 8)
      .attr('fill', r.atributo === 'taxa_ano_anterior' ? COR.azul : COR.verde);
    svg.append('text').attr('class', 'ob-lbl').attr('x', x(r.importancia) + 5).attr('y', yy + 14)
      .attr('data-source', 'importancia').attr('data-field', 'importancia').attr('data-where', `atributo=${r.atributo}`).text(FMT.n3(r.importancia));
  });
});

const COR_GRUPO = (g) => (g === 1 ? COR.azul : g === 2 ? COR.verde : PALETA[(g + 2) % PALETA.length]);

dash.draw('bm-grp', (el) => {
  const est = OBX.estado('grupos');
  if (est !== 'ok') return OBX.vazio(el, est);
  const linhas = dash.data('grupos').data;
  OBX.dispersao(el, {
    pontos: linhas.map((r) => ({
      x: r.cob_hepb_media, y: r.taxa_media, cor: COR_GRUPO(r.grupo), r: 6, rotulo: r.uf,
      dica: [`${r.uf}: grupo ${r.grupo}`, `Taxa média: ${FMT.n2(r.taxa_media)}`, `Cobertura média: ${FMT.n1(r.cob_hepb_media)}%`, `Tendência da taxa: ${FMT.n1(r.tend_taxa_rel)}% ao ano`],
    })),
    fx: FMT.n0, fy: FMT.n0, nomeX: 'Cobertura hepatite B média (%)', nomeY: 'Taxa média por 100 mil', altura: 340,
    aria: 'Dispersão das UFs pelo perfil médio de 2014 a 2022, coloridas pelo grupo do K-Means',
  });
});

dash.draw('grp-lista', (el) => {
  el.replaceChildren();
  if (dash.data('grupos').status !== 'ok') return;
  d3.groups(dash.data('grupos').data, (r) => r.grupo).sort((a, b) => a[0] - b[0]).forEach(([g, ufs]) => {
    const p = document.createElement('p'); p.className = 'ob-cap';
    const b = document.createElement('b'); b.textContent = `Grupo ${g}: `; b.style.color = COR_GRUPO(g);
    p.append(b, ufs.map((u) => u.uf).sort().join(', '));
    el.appendChild(p);
  });
});

dash.draw('bm-grp-tab', (el) => {
  el.replaceChildren();
  if (dash.data('agrupamento').status !== 'ok') return;
  dash.data('agrupamento').data.forEach((r) => {
    const tr = el.insertRow();
    tr.setAttribute('data-key', `${cod(r.algoritmo)},${cod(r.parametro)}`);
    if (r.melhor === 'Sim') tr.className = 'ob-hl';
    td(tr, r.algoritmo); td(tr, r.parametro); td(tr, FMT.n0(r.grupos), 'n'); td(tr, FMT.n0(r.ruido), 'n');
    td(tr, fmtV(r.silhueta, 'n3'), 'n'); td(tr, fmtV(r.davies_bouldin, 'n3'), 'n'); td(tr, FMT.n1(r.tempo_ms), 'n');
  });
});

// ---------------------------------------------------------------------
// Banco de dados e qualidade
// ---------------------------------------------------------------------
dash.draw('registros', (el) => {
  el.replaceChildren();
  if (dash.data('registros').status !== 'ok') return;
  dash.data('registros').data.forEach((r) => {
    const tr = el.insertRow(); tr.setAttribute('data-key', cod(r.tabela));
    td(tr, r.tabela); td(tr, FMT.n0(r.registros), 'n');
  });
});

dash.draw('q-tab', (el) => {
  el.replaceChildren();
  if (dash.data('qualidade').status !== 'ok') return;
  dash.data('qualidade').data.forEach((r) => {
    const tr = el.insertRow(); tr.setAttribute('data-key', cod(r.item));
    td(tr, r.item); td(tr, FMT.n0(r.valor), 'n');
  });
});

dash.draw('q-acima', (el) => {
  el.replaceChildren();
  if (dash.data('acima100').status !== 'ok') return;
  dash.data('acima100').data.forEach((r) => {
    const tr = el.insertRow(); tr.setAttribute('data-key', `${cod(r.uf)},${r.ano},${cod(r.vacina)}`);
    td(tr, r.uf); td(tr, String(r.ano)); td(tr, r.vacina); td(tr, FMT.n2(r.cobertura), 'n');
  });
});

// =====================================================================
// Cruzamentos adicionais
// =====================================================================
const ORDEM_REG = ['Norte', 'Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste'];
const mediaN = (v) => { const a = v.filter((x) => x != null).map(Number); return a.length ? d3.mean(a) : null; };

// Cobertura hepatite B média por região
dash.draw('reg-cob', (el) => {
  const est = OBX.estado('indicadores');
  if (est !== 'ok') return OBX.vazio(el, est);
  const ind = dash.data('indicadores').data.filter((r) => Number(r.ano) >= 2014);
  const series = ORDEM_REG.map((nome) => ({
    nome, cor: COR_REGIAO[nome],
    pontos: d3.groups(ind.filter((r) => r.regiao === nome), (r) => Number(r.ano)).sort((a, b) => a[0] - b[0])
      .map(([ano, ufs]) => ({ x: ano, y: mediaN(ufs.map((u) => u.cob_hepb)) })),
  }));
  OBX.linhas(el, { series, fmt: FMT.n1, fmtEixo: FMT.n0, destaque: OBX.param('ano'), altura: 320,
    ref: { y: OBX.param('limiar'), rotulo: `limiar ${OBX.param('limiar')}%` },
    aria: 'Linhas da cobertura média contra hepatite B até 30 dias por região, de 2014 a 2022' });
});

// Participação de cada região nos casos, na população e nos nascidos
dash.draw('participacao', (el) => {
  const est = OBX.estado('indicadores');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const ano = OBX.param('ano');
  const ind = dash.data('indicadores').data.filter((r) => Number(r.ano) === ano);
  const tot = { casos: d3.sum(ind, (r) => +r.casos), populacao: d3.sum(ind, (r) => +r.populacao), nascidos: d3.sum(ind, (r) => +r.nascidos) };
  const MED = [['casos', 'Casos', COR.azul], ['populacao', 'População', '#1BA39C'], ['nascidos', 'Nascidos vivos', '#D9578A']];
  const linhas = ORDEM_REG.map((reg) => {
    const u = ind.filter((r) => r.regiao === reg);
    const o = { reg };
    MED.forEach(([k]) => { o[k] = tot[k] ? d3.sum(u, (r) => +r[k]) / tot[k] * 100 : 0; });
    return o;
  });
  const W = Math.max(280, el.clientWidth || 600), bh = 13, gap = 16, m = { t: 8, r: 54, b: 26, l: 104 };
  const H = m.t + m.b + linhas.length * (bh * 3 + gap);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Barras: participação de cada região nos casos, na população e nos nascidos vivos do país, ${ano}`);
  const x = d3.scaleLinear().domain([0, d3.max(linhas, (l) => Math.max(l.casos, l.populacao, l.nascidos))]).nice().range([m.l, W - m.r]);
  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(x.ticks(5)).join('line').attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', m.t).attr('y2', H - m.b);
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((t) => `${FMT.n0(t)}%`));
  const dica = OBX.dica(el);
  linhas.forEach((l, i) => {
    const y0 = m.t + i * (bh * 3 + gap);
    svg.append('text').attr('class', 'ob-lbl').attr('x', m.l - 8).attr('y', y0 + bh * 1.5 + 4).attr('text-anchor', 'end').style('font-weight', 700).text(l.reg);
    MED.forEach(([k, nome, cor], j) => {
      const y = y0 + j * bh;
      svg.append('rect').attr('x', m.l).attr('y', y).attr('width', Math.max(1, x(l[k]) - m.l)).attr('height', bh - 2).attr('fill', cor)
        .on('mousemove', (ev) => dica.mostrar(ev, [`${l.reg}, ${ano}`, `${nome}: ${FMT.n1(l[k])}% do país`])).on('mouseleave', () => dica.esconder());
      svg.append('text').attr('class', 'ob-lbl-m').attr('x', x(l[k]) + 4).attr('y', y + bh - 4).text(`${FMT.n1(l[k])}%`);
    });
  });
});
dash.draw('leg-part', (el) => {
  el.replaceChildren(...[['Casos', COR.azul], ['População', '#1BA39C'], ['Nascidos vivos', '#D9578A']].map(([nome, cor]) => {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor; s.append(i, nome); return s;
  }));
});

// Variação entre o ano base e o ano de referência: cobertura x taxa
dash.draw('delta', (el) => {
  const est = OBX.estado('indicadores');
  if (est !== 'ok') return OBX.vazio(el, est);
  const ano = OBX.param('ano'), base = Number(OB.base || 2015);
  if (base >= ano) return OBX.vazio(el, 'ok', 'Escolha um ano base anterior ao ano de referência.');
  const ind = dash.data('indicadores').data;
  const de = new Map(ind.filter((r) => Number(r.ano) === base).map((r) => [r.uf, r]));
  const pts = ind.filter((r) => Number(r.ano) === ano).map((r) => {
    const a = de.get(r.uf);
    if (!a || a.cob_hepb == null || r.cob_hepb == null || !a.taxa) return null;
    const dx = r.cob_hepb - a.cob_hepb, dy = (r.taxa - a.taxa) / a.taxa * 100;
    return { x: dx, y: dy, cor: COR_REGIAO[r.regiao], r: 6, rotulo: r.uf,
      dica: [`${r.nome_uf} (${r.uf}), ${base} a ${ano}`, `Cobertura HB: ${FMT.n1(a.cob_hepb)}% para ${FMT.n1(r.cob_hepb)}% (${FMT.s1(dx)} p.p.)`, `Taxa: ${FMT.n2(a.taxa)} para ${FMT.n2(r.taxa)} (${FMT.s1(dy)}%)`] };
  }).filter(Boolean);
  OBX.dispersao(el, { pontos: pts, fx: (v) => FMT.s1(v), fy: (v) => `${FMT.s1(v)}%`, altura: 400,
    nomeX: `Variação da cobertura hepatite B, ${base} a ${ano} (p.p.)`, nomeY: `Variação da taxa, ${base} a ${ano} (%)`,
    linhasRef: { x: 0, y: 0, rotX: 'cobertura estável', rotY: 'taxa estável' }, reta: true,
    aria: `Dispersão por UF: variação da taxa em função da variação da cobertura de hepatite B entre ${base} e ${ano}` });
});

// Mapa de calor UF x ano
dash.draw('calor', (el) => {
  const est = OBX.estado('indicadores');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const k = OB.indCalor || 'taxa';
  const ind = dash.data('indicadores').data.filter((r) => r[k] != null);
  const anos = [...new Set(ind.map((r) => Number(r.ano)))].sort((a, b) => a - b);
  const ufs = d3.groups(ind, (r) => r.uf).map(([uf, rs]) => ({ uf, regiao: rs[0].regiao, nome: rs[0].nome_uf }))
    .sort((a, b) => ORDEM_REG.indexOf(a.regiao) - ORDEM_REG.indexOf(b.regiao) || a.uf.localeCompare(b.uf));
  const val = new Map(ind.map((r) => [`${r.uf}|${r.ano}`, Number(r[k])]));
  const W = Math.max(300, el.clientWidth || 700), m = { t: 22, r: 4, b: 4, l: 40 };
  const cw = (W - m.l - m.r) / anos.length, ch = 22, H = m.t + m.b + ufs.length * ch;
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Mapa de calor: ${IND[k].nome} por UF e ano`);
  const ext = d3.extent(ind, (r) => Number(r[k]));
  const op = d3.scaleLinear().domain(ext).range([0.08, 1]);
  const cor = k === 'taxa' ? COR.azul : k === 'natalidade' ? '#1BA39C' : '#F7941D';
  const destaque = OBX.param('ano');
  anos.forEach((a, j) => svg.append('text').attr('class', 'ob-lbl-m').attr('x', m.l + j * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle')
    .style('font-weight', a === destaque ? 700 : 400).style('fill', a === destaque ? COR.azul : null).text(cw < 40 ? String(a).slice(2) : a));
  const dica = OBX.dica(el);
  ufs.forEach((u, i) => {
    const y = m.t + i * ch;
    if (i > 0 && ufs[i - 1].regiao !== u.regiao) svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y - 1).attr('y2', y - 1).attr('stroke', COR.muted).attr('stroke-width', 1);
    svg.append('text').attr('class', 'ob-lbl').attr('x', m.l - 8).attr('y', y + ch / 2 + 4).attr('text-anchor', 'end').text(u.uf);
    anos.forEach((a, j) => {
      const v = val.get(`${u.uf}|${a}`);
      const o = v == null ? 0 : op(v);
      svg.append('rect').attr('x', m.l + j * cw + 1).attr('y', y + 1).attr('width', cw - 2).attr('height', ch - 2)
        .attr('fill', v == null ? '#EEF2F6' : cor).attr('fill-opacity', v == null ? 1 : o)
        .on('mousemove', (ev) => dica.mostrar(ev, [`${u.nome} (${u.uf}), ${a}`, `${IND[k].curto}: ${v == null ? 'sem dado' : IND[k].fmt(v)}`, `Região: ${u.regiao}`]))
        .on('mouseleave', () => dica.esconder());
      if (cw >= 46 && v != null) svg.append('text').attr('x', m.l + j * cw + cw / 2).attr('y', y + ch / 2 + 4).attr('text-anchor', 'middle')
        .style('font-size', '10.5px').style('pointer-events', 'none').style('fill', o > 0.55 ? '#FFFFFF' : COR.texto).text(k === 'taxa' || k === 'natalidade' ? FMT.n1(v) : FMT.n0(v));
    });
  });
});

// Prioridade por região
dash.draw('reg-prior', (el) => {
  const est = OBX.estado('criterios');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const ano = OBX.param('ano'), limiar = OBX.param('limiar');
  const crit = dash.data('criterios').data.filter((r) => r.ano_ref === ano && r.limiar === limiar);
  const NIV = ['Alta', 'Média', 'Baixa'];
  const linhas = ORDEM_REG.map((reg) => {
    const u = crit.filter((r) => r.regiao === reg);
    const o = { reg, total: u.length, ufs: {} };
    NIV.forEach((n) => { const s = u.filter((r) => r.prioridade === n); o[n] = s.length; o.ufs[n] = s.map((r) => r.uf).join(', '); });
    return o;
  });
  const W = Math.max(280, el.clientWidth || 600), bh = 30, gap = 12, m = { t: 6, r: 16, b: 26, l: 104 };
  const H = m.t + m.b + linhas.length * (bh + gap);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Barras empilhadas: número de UFs por prioridade em cada região, ${ano}, limiar ${limiar}%`);
  const x = d3.scaleLinear().domain([0, d3.max(linhas, (l) => l.total)]).range([m.l, W - m.r]);
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(d3.max(linhas, (l) => l.total)).tickFormat(FMT.n0));
  const dica = OBX.dica(el);
  linhas.forEach((l, i) => {
    const y = m.t + i * (bh + gap);
    svg.append('text').attr('class', 'ob-lbl').attr('x', m.l - 8).attr('y', y + bh / 2 + 4).attr('text-anchor', 'end').style('font-weight', 700).text(l.reg);
    let acc = 0;
    NIV.forEach((n) => {
      if (!l[n]) return;
      const x0 = x(acc), x1 = x(acc + l[n]);
      svg.append('rect').attr('x', x0).attr('y', y).attr('width', Math.max(1, x1 - x0 - 2)).attr('height', bh).attr('fill', COR_PRIOR[n])
        .on('mousemove', (ev) => dica.mostrar(ev, [`${l.reg}: prioridade ${n.toLowerCase()}`, `${l[n]} UF(s): ${l.ufs[n]}`])).on('mouseleave', () => dica.esconder());
      if (x1 - x0 > 40) svg.append('text').attr('x', (x0 + x1) / 2 - 1).attr('y', y + bh / 2 + 4).attr('text-anchor', 'middle').style('font-size', '11px').style('font-weight', 700)
        .style('pointer-events', 'none').style('fill', n === 'Alta' ? '#FFFFFF' : COR.texto).text(l.ufs[n]);
      acc += l[n];
    });
  });
});
dash.draw('leg-prior', (el) => {
  el.replaceChildren(...Object.entries(COR_PRIOR).map(([nome, cor]) => {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor; s.append(i, `Prioridade ${nome.toLowerCase()}`); return s;
  }));
});

// =====================================================================
// Benchmarking: dados brutos x dados tratados
// =====================================================================
const CEN_BT = [
  ['Dados brutos', '#A9B6C3'],
  ['Dados tratados (sem histórico)', '#9FD0F5'],
  ['Dados tratados (com taxa do ano anterior)', '#F7941D'],
];
dash.draw('leg-bt', (el) => {
  el.replaceChildren(...CEN_BT.map(([nome, cor]) => {
    const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = cor; s.append(i, nome); return s;
  }));
});

dash.draw('bt-reg', (el) => {
  const est = OBX.estado('bruto_tratado_regressao');
  if (est !== 'ok') return OBX.vazio(el, est);
  el.replaceChildren();
  const linhas = dash.data('bruto_tratado_regressao').data.filter((r) => r.validacao === OB.val);
  const modelos = [...new Set(linhas.map((r) => r.modelo))];
  const W = Math.max(300, el.clientWidth || 700), bh = 12, gap = 14, m = { t: 6, r: 150, b: 28, l: 136 };
  const H = m.t + m.b + modelos.length * (bh * 3 + gap);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', H).attr('role', 'img')
    .attr('aria-label', `Barras: RMSE de cada algoritmo com dados brutos e tratados, ${OB.val}`);
  const teto = Math.ceil(d3.max(linhas.filter((r) => !(r.cenario === 'Dados brutos' && r.modelo === 'Regressão Linear')), (r) => +r.RMSE) * 1.15);
  const x = d3.scaleLinear().domain([0, teto]).range([m.l, W - m.r]);
  svg.append('g').attr('class', 'ob-gridl').selectAll('line').data(x.ticks(6)).join('line').attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', m.t).attr('y2', H - m.b);
  svg.append('g').attr('class', 'ob-axis').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(FMT.n0));
  const dica = OBX.dica(el);
  modelos.forEach((mod, i) => {
    const y0 = m.t + i * (bh * 3 + gap);
    svg.append('text').attr('class', 'ob-lbl').attr('x', m.l - 8).attr('y', y0 + bh * 1.5 + 4).attr('text-anchor', 'end').style('font-weight', 700).text(mod);
    CEN_BT.forEach(([cen, cor], j) => {
      const r = linhas.find((l) => l.modelo === mod && l.cenario === cen);
      if (!r) return;
      const v = +r.RMSE, fora = v > teto, y = y0 + j * bh;
      svg.append('rect').attr('x', m.l).attr('y', y).attr('width', Math.max(1, x(Math.min(v, teto)) - m.l)).attr('height', bh - 2).attr('fill', cor)
        .on('mousemove', (ev) => dica.mostrar(ev, [`${mod}: ${cen}`, `RMSE ${FMT.n2(v)} · MAE ${FMT.n2(+r.MAE)} · R² ${FMT.n3(+r.R2)}`, `Treino ${r.n_treino} · teste ${r.n_teste} registros`]))
        .on('mouseleave', () => dica.esconder());
      svg.append('text').attr('class', 'ob-lbl-m').attr('x', x(Math.min(v, teto)) + 4).attr('y', y + bh - 3)
        .style('font-weight', fora ? 700 : 400).text(fora ? `${FMT.n1(v)} (fora da escala)` : FMT.n2(v));
    });
  });
});

dash.draw('bt-tab', (el) => {
  const est = OBX.estado('bruto_tratado_resumo');
  el.replaceChildren();
  if (est !== 'ok') { const tr = el.insertRow(); td(tr, est === 'erro' ? 'Não foi possível carregar.' : 'Carregando…'); return; }
  const ordem = CEN_BT.map(([c]) => c);
  dash.data('bruto_tratado_resumo').data.filter((r) => r.validacao === OB.val)
    .sort((a, b) => ordem.indexOf(a.cenario) - ordem.indexOf(b.cenario)).forEach((r) => {
      const tr = el.insertRow();
      tr.dataset.key = `${cod(r.validacao)},${cod(r.cenario)}`;
      if (r.cenario === ordem[2]) tr.className = 'ob-hl';
      td(tr, r.cenario); td(tr, r.melhor_modelo); td(tr, FMT.n2(r.RMSE_min), 'n'); td(tr, FMT.n2(r.RMSE_medio), 'n'); td(tr, FMT.n2(r.RMSE_max), 'n'); td(tr, FMT.n3(r.R2_medio), 'n');
    });
});

dash.draw('bt-qual', (el) => {
  const est = OBX.estado('bruto_tratado_qualidade');
  el.replaceChildren();
  if (est !== 'ok') { const tr = el.insertRow(); td(tr, est === 'erro' ? 'Não foi possível carregar.' : 'Carregando…'); return; }
  dash.data('bruto_tratado_qualidade').data.forEach((r) => {
    const tr = el.insertRow();
    tr.dataset.key = cod(r.aspecto);
    const f = (v) => (Number.isInteger(+v) ? FMT.n0(+v) : FMT.n1(+v));
    td(tr, r.aspecto); td(tr, f(r.bruto), 'n'); td(tr, f(r.tratado), 'n');
  });
});

dash.draw('bt-grp', (el) => {
  const est = OBX.estado('bruto_tratado_agrupamento');
  el.replaceChildren();
  if (est !== 'ok') { const tr = el.insertRow(); td(tr, est === 'erro' ? 'Não foi possível carregar.' : 'Carregando…'); return; }
  dash.data('bruto_tratado_agrupamento').data.forEach((r) => {
    const tr = el.insertRow();
    tr.dataset.key = cod(r.cenario);
    td(tr, r.cenario); td(tr, r.variaveis); td(tr, FMT.n3(+r.silhueta), 'n'); td(tr, `${r.maior_grupo} UFs`, 'n'); td(tr, r.ufs_menor_grupo);
  });
});

// =====================================================================
// Passo a passo: tabela genérica a partir de uma fonte
// data-cols="campo|Rótulo|formato;..." (formato: n0, n1, n2, n3 ou t para texto)
// =====================================================================
dash.draw('tab', (el) => {
  const tbody = el.tBodies[0] || el.createTBody();
  const src = el.dataset.src;
  const cols = el.dataset.cols.split(';').map((c) => c.split('|'));
  if (!el.tHead) {
    const tr = el.createTHead().insertRow();
    cols.forEach(([campo, rot, f]) => { const th = document.createElement('th'); th.textContent = rot; th.dataset.field = campo; if (f !== 't') th.className = 'n'; tr.appendChild(th); });
  }
  el.setAttribute('data-source', src);
  tbody.replaceChildren();
  const est = OBX.estado(src);
  if (est !== 'ok') { td(tbody.insertRow(), est === 'erro' ? 'Não foi possível carregar.' : 'Carregando…'); return; }
  const chave = (el.dataset.rowKey || '').split(',').filter(Boolean);
  dash.data(src).data.forEach((r) => {
    const tr = tbody.insertRow();
    if (chave.length) tr.dataset.key = chave.map((k) => cod(r[k])).join(',');
    if (r.situacao && String(r.situacao).startsWith('Excluída')) tr.className = 'ob-off';
    cols.forEach(([campo, , f]) => {
      const v = r[campo];
      const ehDado = /^(cob|taxa)/.test(campo);
      const c = td(tr, v == null || v === '' ? (ehDado ? 'vazio' : '—') : (f === 't' ? String(v) : FMT[f](+v)), f === 't' ? '' : 'n');
      if (v == null && ehDado) c.classList.add('ob-vazio');
      if (campo.startsWith('cob') && v != null && +v > 100) c.classList.add('ob-acima');
      if (campo.startsWith('cob') && v === 0) c.classList.add('ob-vazio');
    });
  });
});

}
