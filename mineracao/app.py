"""
Dashboard customizável - Observatório da Hepatite B (Atividade 6).

Como executar (no terminal, dentro da pasta do projeto):
    pip install -r requirements.txt
    streamlit run app.py

O painel abre no navegador. Na barra lateral, o usuário escolhe os critérios de
seleção de dados; todas as abas e o relatório técnico se atualizam com essas escolhas.
"""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

import observatorio as obs

AZUL, LARANJA, CINZA = "#004A91", "#F28C1E", "#8A96A3"
CORES_PRIORIDADE = {"Alta": "#B03A2E", "Média": LARANJA, "Baixa": AZUL}

st.set_page_config(page_title="Observatório da Hepatite B", layout="wide")


# ---------------------------------------------------------------------------
# Dados e benchmarks (calculados uma vez e guardados em cache)
# ---------------------------------------------------------------------------
@st.cache_data
def dados():
    return obs.carregar_base()


@st.cache_data
def bench_regressao():
    return obs.benchmark_regressao(dados())


@st.cache_data
def bench_agrupamento():
    return obs.benchmark_agrupamento(dados())


base = dados()

# ---------------------------------------------------------------------------
# Barra lateral: critérios de seleção de dados
# ---------------------------------------------------------------------------
st.sidebar.header("Critérios de seleção")
ano_ref = st.sidebar.selectbox("Ano de referência", list(range(2022, 2013, -1)), index=0)
ano_ini, ano_fim = st.sidebar.slider("Período da tendência", 2014, 2022, (2014, 2022))
limiar = st.sidebar.slider("Limiar de cobertura vacinal (%)", 70, 100, 90, step=1,
                           help="C1: UFs com cobertura de hepatite B até 30 dias abaixo deste valor")
regioes = st.sidebar.multiselect("Regiões", list(obs.REGIOES.values()),
                                 default=list(obs.REGIOES.values()))
st.sidebar.subheader("Tratamento dos dados")
excluir_2020 = st.sidebar.checkbox("Excluir 2020 das tendências (pandemia)")
limitar_100 = st.sidebar.checkbox("Limitar coberturas a 100%")
excluir_es = st.sidebar.checkbox("Excluir Espírito Santo 2020 a 2022 (dados incompletos)")
st.sidebar.caption("Fonte: DATASUS (TabNet): Sinan, SI-PNI, Sinasc e IBGE. Casos = todas as "
                   "hepatites virais (o TabNet não separa por etiologia de 2013 a 2022).")

if ano_fim - ano_ini < 2:
    st.sidebar.error("Escolha um período de pelo menos 3 anos para calcular a tendência.")
    st.stop()

crit, ref = obs.aplicar_criterios(base, ano_ref, ano_ini, ano_fim, limiar,
                                  excluir_2020, limitar_100, excluir_es)
crit = crit[crit["regiao"].isin(regioes)]
base_f = base[base["regiao"].isin(regioes)]

st.title("Observatório da Hepatite B")
st.caption(f"Ano de referência {ano_ref} · tendência de {ano_ini} a {ano_fim} · "
           f"limiar de cobertura {limiar}% · {len(crit)} UFs no filtro")

aba1, aba2, aba3, aba4, aba5 = st.tabs(
    ["Visão geral", "Critérios e prioridade", "Tendências", "Benchmarking", "Relatório técnico"])

# ---------------------------------------------------------------------------
# Aba 1: visão geral
# ---------------------------------------------------------------------------
with aba1:
    nac = base_f.groupby("ano").agg(casos=("casos", "sum"), pop=("populacao", "sum"),
                                    cob=("cob_hepb", "mean")).reset_index()
    nac["taxa"] = nac["casos"] * 100_000 / nac["pop"]
    atual = nac[nac["ano"] == ano_ref].iloc[0]
    anterior = nac[nac["ano"] == ano_ref - 1]
    c1, c2, c3, c4 = st.columns(4)
    delta = None if anterior.empty else f"{atual['taxa'] - anterior['taxa'].item():+.2f} vs ano anterior"
    c1.metric("Taxa de detecção (por 100 mil)", obs.br(atual["taxa"]), delta, delta_color="inverse")
    c2.metric("Casos confirmados", obs.br(atual["casos"], 0))
    c3.metric("Cobertura média hepatite B (%)", obs.br(atual["cob"]) if pd.notna(atual["cob"]) else "sem dado")
    c4.metric("UFs de prioridade alta", int((crit["prioridade"] == "Alta").sum()))

    fig = go.Figure()
    fig.add_bar(x=nac["ano"], y=nac["taxa"], name="Taxa por 100 mil", marker_color=AZUL)
    fig.add_scatter(x=nac["ano"], y=nac["cob"], name="Cobertura média (%)", yaxis="y2",
                    mode="lines+markers", line=dict(color=LARANJA, width=3))
    fig.update_layout(title="Taxa de detecção e cobertura vacinal no conjunto selecionado",
                      yaxis=dict(title="Taxa por 100 mil hab."),
                      yaxis2=dict(title="Cobertura (%)", overlaying="y", side="right", range=[0, 110]),
                      legend=dict(orientation="h", y=-0.15), height=430)
    st.plotly_chart(fig, use_container_width=True)
    st.caption("A queda de 2020 coincide com a pandemia de COVID-19: menos diagnóstico e notificação.")

# ---------------------------------------------------------------------------
# Aba 2: critérios e prioridade
# ---------------------------------------------------------------------------
with aba2:
    st.markdown(
        f"**C1** cobertura < {limiar}% · **C2** taxa > nacional ({obs.br(ref['taxa_br'])}) · "
        f"**C3** cobertura em queda · **C4** taxa cai menos que a nacional "
        f"({obs.br(ref['tend_taxa_br'], 1)}% ao ano). "
        "Prioridade **Alta** = C1 e C2; **Média** = uma delas com C3 ou C4.")
    fig = px.scatter(crit, x="cob_hepb", y="taxa", color="prioridade", text="uf",
                     color_discrete_map=CORES_PRIORIDADE, size="casos", size_max=40,
                     category_orders={"prioridade": ["Alta", "Média", "Baixa"]},
                     labels={"cob_hepb": "Cobertura hepatite B até 30 dias (%)",
                             "taxa": "Taxa por 100 mil hab.", "prioridade": "Prioridade"},
                     title=f"Cobertura x taxa de detecção por UF em {ano_ref}")
    fig.add_vline(x=limiar, line_dash="dash", line_color=CINZA,
                  annotation_text=f"limiar {limiar}%")
    fig.add_hline(y=ref["taxa_br"], line_dash="dash", line_color=CINZA,
                  annotation_text="taxa nacional")
    fig.update_traces(textposition="top center")
    fig.update_layout(height=520)
    st.plotly_chart(fig, use_container_width=True)

    tabela = crit[["uf", "regiao", "taxa", "cob_hepb", "tend_taxa_rel", "tend_cob_hepb",
                   "C1_cobertura_baixa", "C2_taxa_alta", "C3_cobertura_caindo",
                   "C4_taxa_resistente", "pontuacao", "prioridade"]].rename(columns={
        "uf": "UF", "regiao": "Região", "taxa": "Taxa", "cob_hepb": "Cobertura (%)",
        "tend_taxa_rel": "Tend. taxa (% ao ano)", "tend_cob_hepb": "Tend. cobertura (p.p./ano)",
        "C1_cobertura_baixa": "C1", "C2_taxa_alta": "C2", "C3_cobertura_caindo": "C3",
        "C4_taxa_resistente": "C4", "pontuacao": "Critérios", "prioridade": "Prioridade"})
    st.dataframe(tabela.round(2), use_container_width=True, hide_index=True)
    st.download_button("Baixar tabela (CSV)", tabela.to_csv(index=False).encode("utf-8-sig"),
                       f"prioridade_ufs_{ano_ref}.csv", "text/csv")

# ---------------------------------------------------------------------------
# Aba 3: tendências por UF
# ---------------------------------------------------------------------------
with aba3:
    padrao = list(crit.loc[crit["prioridade"] == "Alta", "uf"])[:5] or list(crit["uf"])[:3]
    ufs = st.multiselect("UFs para comparar", sorted(base_f["uf"].unique()), default=padrao)
    indicador = st.radio("Indicador", ["Taxa por 100 mil", "Cobertura hepatite B (%)"], horizontal=True)
    col = "taxa" if indicador.startswith("Taxa") else "cob_hepb"
    serie = base_f[base_f["uf"].isin(ufs) & base_f["ano"].between(ano_ini, ano_fim)]
    fig = px.line(serie, x="ano", y=col, color="uf", markers=True,
                  labels={"ano": "Ano", col: indicador, "uf": "UF"},
                  title=f"{indicador}: evolução de {ano_ini} a {ano_fim}")
    if col == "cob_hepb":
        fig.add_hline(y=limiar, line_dash="dash", line_color=CINZA, annotation_text=f"limiar {limiar}%")
    fig.update_layout(height=460)
    st.plotly_chart(fig, use_container_width=True)

    ordem = crit.sort_values("tend_taxa_rel")
    fig = px.bar(ordem, x="uf", y="tend_taxa_rel", color="prioridade",
                 color_discrete_map=CORES_PRIORIDADE,
                 labels={"uf": "UF", "tend_taxa_rel": "Variação média da taxa (% ao ano)",
                         "prioridade": "Prioridade"},
                 title="Tendência da taxa por UF (negativo = queda)")
    fig.add_hline(y=ref["tend_taxa_br"], line_dash="dash", line_color=CINZA,
                  annotation_text="Brasil")
    fig.update_layout(height=420)
    st.plotly_chart(fig, use_container_width=True)

# ---------------------------------------------------------------------------
# Aba 4: benchmarking da mineração
# ---------------------------------------------------------------------------
with aba4:
    st.subheader("Regressão: prever a taxa de detecção")
    reg = bench_regressao()
    validacao = st.selectbox("Validação temporal", list(obs.VALIDACOES))
    r = reg[reg["validacao"] == validacao]
    fig = px.bar(r, x="modelo", y="RMSE", color="atributos", barmode="group",
                 color_discrete_sequence=[CINZA, LARANJA, AZUL],
                 labels={"modelo": "Algoritmo", "RMSE": "RMSE (menor é melhor)",
                         "atributos": "Atributos"},
                 title="Erro de previsão por algoritmo")
    fig.update_layout(height=420)
    st.plotly_chart(fig, use_container_width=True)
    st.dataframe(r.drop(columns="validacao").round(3), use_container_width=True, hide_index=True)
    st.caption("A referência ingênua repete a taxa do ano anterior. Nenhum algoritmo a superou: "
               "a série tem forte inércia e a cobertura vacinal explica pouco da taxa.")

    imp = obs.importancia_atributos(base)
    fig = px.bar(imp, x="importancia", y="atributo", orientation="h",
                 color_discrete_sequence=[AZUL],
                 labels={"importancia": "Importância (Random Forest)", "atributo": "Atributo"},
                 title="Peso de cada atributo na previsão")
    fig.update_layout(height=360, yaxis={"categoryorder": "total ascending"})
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("Agrupamento: perfis de UFs")
    grp, perfil, rotulos = bench_agrupamento()
    st.dataframe(grp.round(3), use_container_width=True, hide_index=True)
    melhor = obs.melhor_agrupamento(grp)
    opcoes = [f"{a} ({p})" for a, p in zip(grp["algoritmo"], grp["parametro"])]
    escolha = st.selectbox("Configuração a visualizar", opcoes,
                           index=opcoes.index(f"{melhor['algoritmo']} ({melhor['parametro']})"))
    alg, par = escolha.rsplit(" (", 1)
    lab = rotulos[(alg, par.rstrip(")"))]
    vis = perfil.assign(grupo=["Ruído" if g == -1 else f"Grupo {g + 1}" for g in lab])
    fig = px.scatter(vis, x="cob_hepb_media", y="taxa_media", color="grupo", text="uf",
                     labels={"cob_hepb_media": "Cobertura média (%)",
                             "taxa_media": "Taxa média por 100 mil", "grupo": "Grupo"},
                     title=f"{escolha}: grupos de UFs (médias 2014 a 2022)")
    fig.update_traces(textposition="top center", marker=dict(size=12))
    fig.update_layout(height=480)
    st.plotly_chart(fig, use_container_width=True)
    st.caption(f"Melhor silhueta com até 3 UFs como ruído: {melhor['algoritmo']} "
               f"({melhor['parametro']}), {melhor['silhueta']:.3f}.")

# ---------------------------------------------------------------------------
# Aba 5: relatório técnico
# ---------------------------------------------------------------------------
with aba5:
    st.write("O relatório usa os critérios escolhidos na barra lateral.")
    texto = obs.gerar_relatorio(base, ano_ref, ano_ini, ano_fim, limiar,
                                excluir_2020, limitar_100, excluir_es)
    st.download_button("Baixar relatório técnico (.md)", texto.encode("utf-8"),
                       f"relatorio_tecnico_{ano_ref}.md", "text/markdown")
    st.markdown(texto)
