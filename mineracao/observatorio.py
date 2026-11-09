"""
Observatório da Hepatite B - núcleo de dados e mineração.

Este módulo é usado pelos dois programas da Atividade 6:
  - benchmark.py : roda o benchmarking dos algoritmos pela linha de comando
  - app.py       : dashboard customizável (Streamlit)

Funções principais:
  carregar_base()            junta os 5 CSV numa tabela UF x ano
  tendencias(base, ...)      inclinação (tendência) de cada indicador por UF
  aplicar_criterios(...)     critérios de seleção de dados definidos pelo negócio
  benchmark_regressao(...)   compara algoritmos de regressão
  benchmark_agrupamento(...) compara algoritmos de agrupamento (clusterização)
"""

from pathlib import Path
import time

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering, DBSCAN, KMeans
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import (
    calinski_harabasz_score, davies_bouldin_score, mean_absolute_error,
    mean_squared_error, r2_score, silhouette_score,
)
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor

PASTA_DADOS = Path(__file__).parent / "dados"
SEMENTE = 42  # garante que os resultados se repetem a cada execução

REGIOES = {1: "Norte", 2: "Nordeste", 3: "Sudeste", 4: "Sul", 5: "Centro-Oeste"}
SIGLAS = {
    11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
    21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL",
    28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR",
    42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
}


# ---------------------------------------------------------------------------
# 1. Base de dados integrada
# ---------------------------------------------------------------------------
def _ler(nome, coluna_valor, novo_nome):
    df = pd.read_csv(PASTA_DADOS / nome)
    return df[["cod_uf", "ano", coluna_valor]].rename(columns={coluna_valor: novo_nome})


def carregar_base():
    """Junta os cinco arquivos pela chave cod_uf + ano e calcula os indicadores."""
    base = pd.read_csv(PASTA_DADOS / "casos_hepatite.csv")
    for nome, col, novo in [
        ("populacao.csv", "qtd_populacao", "populacao"),
        ("nascidos_vivos.csv", "qtd_nascidos", "nascidos"),
        ("cobertura_hepb30.csv", "perc_cobertura", "cob_hepb"),
        ("cobertura_hepa.csv", "perc_cobertura", "cob_hepa"),
    ]:
        base = base.merge(_ler(nome, col, novo), on=["cod_uf", "ano"], how="left")

    base = base.rename(columns={"qtd_casos": "casos"})
    base["uf"] = base["cod_uf"].map(SIGLAS)
    base["regiao"] = (base["cod_uf"] // 10).map(REGIOES)
    base["taxa"] = base["casos"] * 100_000 / base["populacao"]          # por 100 mil hab.
    base["natalidade"] = base["nascidos"] * 1_000 / base["populacao"]  # por mil hab.
    base = base.sort_values(["cod_uf", "ano"]).reset_index(drop=True)
    # taxa do ano anterior (defasagem de 1 ano), usada como atributo preditivo
    base["taxa_ano_anterior"] = base.groupby("cod_uf")["taxa"].shift(1)
    return base


def taxa_nacional(base, ano):
    d = base[base["ano"] == ano]
    return d["casos"].sum() * 100_000 / d["populacao"].sum()


# ---------------------------------------------------------------------------
# 2. Tendência por UF (inclinação da reta de mínimos quadrados)
# ---------------------------------------------------------------------------
def _inclinacao(anos, valores):
    m = ~np.isnan(valores)
    if m.sum() < 3:
        return np.nan
    return float(np.polyfit(anos[m], valores[m], 1)[0])


def tendencias(base, ano_ini, ano_fim, excluir_2020=False):
    """Inclinação anual da taxa e da cobertura de cada UF no período escolhido.

    Inclinação negativa = indicador caindo; positiva = subindo.
    """
    d = base[(base["ano"] >= ano_ini) & (base["ano"] <= ano_fim)]
    if excluir_2020:
        d = d[d["ano"] != 2020]
    linhas = []
    for (cod, uf, reg), g in d.groupby(["cod_uf", "uf", "regiao"]):
        anos = g["ano"].to_numpy(float)
        linhas.append({
            "cod_uf": cod, "uf": uf, "regiao": reg,
            "tend_taxa": _inclinacao(anos, g["taxa"].to_numpy(float)),
            "tend_cob_hepb": _inclinacao(anos, g["cob_hepb"].to_numpy(float)),
            "taxa_media": g["taxa"].mean(),
            "tend_taxa_rel": 100 * _inclinacao(anos, g["taxa"].to_numpy(float)) / g["taxa"].mean(),
            "cob_hepb_media": g["cob_hepb"].mean(),
        })
    return pd.DataFrame(linhas)


# ---------------------------------------------------------------------------
# 3. Critérios de seleção de dados (definidos em função do negócio)
# ---------------------------------------------------------------------------
def aplicar_criterios(base, ano_ref, ano_ini, ano_fim, limiar_cobertura=90.0,
                      excluir_2020=False, limitar_100=False, excluir_es=False):
    """Classifica cada UF segundo os critérios do Observatório.

    C1 cobertura de hepatite B (< 30 dias) abaixo do limiar no ano de referência
    C2 taxa de detecção acima da taxa nacional no ano de referência
    C3 tendência de cobertura em queda no período
    C4 taxa caindo, em % ao ano, menos que a nacional (ou subindo)
    Prioridade: Alta = C1 e C2; Média = só C1 ou só C2, com C3 ou C4; Baixa = demais.
    """
    b = base.copy()
    if limitar_100:
        b["cob_hepb"] = b["cob_hepb"].clip(upper=100)
    if excluir_es:
        b = b[~((b["uf"] == "ES") & (b["ano"] >= 2020))]

    ref = b[b["ano"] == ano_ref][["cod_uf", "uf", "regiao", "taxa", "cob_hepb", "casos"]]
    tend = tendencias(b, ano_ini, ano_fim, excluir_2020)[["cod_uf", "tend_taxa", "tend_taxa_rel", "tend_cob_hepb"]]
    t = ref.merge(tend, on="cod_uf", how="left")

    tx_br = taxa_nacional(b, ano_ref)
    nac = b.groupby("ano").agg(casos=("casos", "sum"), pop=("populacao", "sum")).reset_index()
    nac = nac[(nac["ano"] >= ano_ini) & (nac["ano"] <= ano_fim)]
    if excluir_2020:
        nac = nac[nac["ano"] != 2020]
    serie_br = (nac["casos"] * 100_000 / nac["pop"]).to_numpy(float)
    tend_br = 100 * _inclinacao(nac["ano"].to_numpy(float), serie_br) / serie_br.mean()

    t["C1_cobertura_baixa"] = t["cob_hepb"] < limiar_cobertura
    t["C2_taxa_alta"] = t["taxa"] > tx_br
    t["C3_cobertura_caindo"] = t["tend_cob_hepb"] < 0
    t["C4_taxa_resistente"] = t["tend_taxa_rel"] > tend_br
    crit = ["C1_cobertura_baixa", "C2_taxa_alta", "C3_cobertura_caindo", "C4_taxa_resistente"]
    t["pontuacao"] = t[crit].sum(axis=1)
    # Regra de negócio: as duas condições do problema (C1 e C2) definem a prioridade;
    # as tendências (C3 e C4) indicam se a situação tende a piorar.
    nucleo = t["C1_cobertura_baixa"].astype(int) + t["C2_taxa_alta"].astype(int)
    tendencia = t["C3_cobertura_caindo"] | t["C4_taxa_resistente"]
    t["prioridade"] = np.select(
        [nucleo == 2, (nucleo == 1) & tendencia], ["Alta", "Média"], default="Baixa")
    ordem = {"Alta": 0, "Média": 1, "Baixa": 2}
    t = (t.assign(_o=t["prioridade"].map(ordem))
          .sort_values(["_o", "pontuacao", "taxa"], ascending=[True, False, False])
          .drop(columns="_o").reset_index(drop=True))
    return t, {"taxa_br": tx_br, "tend_taxa_br": tend_br}


# ---------------------------------------------------------------------------
# 4. Benchmarking de regressão: prever a taxa de detecção
# ---------------------------------------------------------------------------
ATRIBUTOS = {
    "Sem histórico": ["cob_hepb", "cob_hepa", "natalidade", "ano", "reg_N", "reg_NE", "reg_SE", "reg_S"],
    "Com taxa do ano anterior": ["cob_hepb", "cob_hepa", "natalidade", "ano", "reg_N", "reg_NE",
                                 "reg_SE", "reg_S", "taxa_ano_anterior"],
}


def _modelos_regressao():
    return {
        "Regressão Linear": make_pipeline(StandardScaler(), LinearRegression()),
        "KNN (k=5)": make_pipeline(StandardScaler(), KNeighborsRegressor(n_neighbors=5)),
        "Árvore de Decisão": DecisionTreeRegressor(max_depth=4, random_state=SEMENTE),
        "Random Forest": RandomForestRegressor(n_estimators=300, random_state=SEMENTE),
        "Gradient Boosting": GradientBoostingRegressor(random_state=SEMENTE),
    }


def _matriz(base):
    d = base.dropna(subset=["cob_hepb", "cob_hepa", "taxa_ano_anterior"]).copy()
    for sigla, nome in [("N", "Norte"), ("NE", "Nordeste"), ("SE", "Sudeste"), ("S", "Sul")]:
        d[f"reg_{sigla}"] = (d["regiao"] == nome).astype(int)
    return d


VALIDACOES = {
    "Pré-pandemia (treino 2015-2018, teste 2019)": ((2015, 2018), (2019, 2019)),
    "Pós-pandemia (treino 2015-2020, teste 2021-2022)": ((2015, 2020), (2021, 2022)),
}


def benchmark_regressao(base):
    """Compara os algoritmos em duas validações temporais (treina no passado, testa no futuro).

    Retorna uma linha por (validação, conjunto de atributos, modelo) com MAE, RMSE, R² e tempo.
    Inclui a referência ingênua: repetir a taxa do ano anterior.
    """
    d = _matriz(base)
    linhas = []
    for validacao, ((tr0, tr1), (te0, te1)) in VALIDACOES.items():
        treino = d[(d["ano"] >= tr0) & (d["ano"] <= tr1)]
        teste = d[(d["ano"] >= te0) & (d["ano"] <= te1)]
        y_tr, y_te = treino["taxa"], teste["taxa"]
        ingenua = teste["taxa_ano_anterior"]
        linhas.append({"validacao": validacao, "atributos": "Referência",
                       "modelo": "Repetir o ano anterior",
                       "MAE": mean_absolute_error(y_te, ingenua),
                       "RMSE": mean_squared_error(y_te, ingenua) ** 0.5,
                       "R2": r2_score(y_te, ingenua), "tempo_ms": 0.0,
                       "n_treino": len(treino), "n_teste": len(teste)})
        for conjunto, cols in ATRIBUTOS.items():
            for nome, modelo in _modelos_regressao().items():
                t0 = time.perf_counter()
                modelo.fit(treino[cols], y_tr)
                pred = modelo.predict(teste[cols])
                linhas.append({
                    "validacao": validacao, "atributos": conjunto, "modelo": nome,
                    "MAE": mean_absolute_error(y_te, pred),
                    "RMSE": mean_squared_error(y_te, pred) ** 0.5,
                    "R2": r2_score(y_te, pred),
                    "tempo_ms": (time.perf_counter() - t0) * 1000,
                    "n_treino": len(treino), "n_teste": len(teste),
                })
    return pd.DataFrame(linhas)


def importancia_atributos(base):
    """Importância dos atributos no Random Forest com histórico (para o relatório)."""
    d = _matriz(base)
    cols = ATRIBUTOS["Com taxa do ano anterior"]
    rf = RandomForestRegressor(n_estimators=300, random_state=SEMENTE).fit(d[cols], d["taxa"])
    return (pd.Series(rf.feature_importances_, index=cols)
            .sort_values(ascending=False).rename("importancia").reset_index()
            .rename(columns={"index": "atributo"}))


# ---------------------------------------------------------------------------
# 5. Benchmarking de agrupamento: perfis de UFs
# ---------------------------------------------------------------------------
VARS_GRUPO = ["taxa_media", "cob_hepb_media", "tend_taxa", "tend_cob_hepb"]


def benchmark_agrupamento(base, ano_ini=2014, ano_fim=2022, ks=(2, 3, 4, 5)):
    """Compara K-Means, Hierárquico (Ward) e DBSCAN sobre o perfil de cada UF."""
    perfil = tendencias(base, ano_ini, ano_fim).dropna(subset=VARS_GRUPO)
    X = StandardScaler().fit_transform(perfil[VARS_GRUPO])
    linhas, rotulos = [], {}

    def avaliar(nome, k, modelo):
        t0 = time.perf_counter()
        lab = modelo.fit_predict(X)
        ms = (time.perf_counter() - t0) * 1000
        n_grupos = len(set(lab) - {-1})
        ruido = int((lab == -1).sum())
        valido = lab != -1
        if n_grupos >= 2 and len(set(lab[valido])) >= 2:
            sil = silhouette_score(X[valido], lab[valido])
            db = davies_bouldin_score(X[valido], lab[valido])
            ch = calinski_harabasz_score(X[valido], lab[valido])
        else:
            sil = db = ch = np.nan
        linhas.append({"algoritmo": nome, "parametro": k, "grupos": n_grupos, "ruido": ruido,
                       "silhueta": sil, "davies_bouldin": db, "calinski_harabasz": ch,
                       "tempo_ms": ms})
        rotulos[(nome, k)] = lab

    for k in ks:
        avaliar("K-Means", f"k={k}", KMeans(n_clusters=k, n_init=20, random_state=SEMENTE))
        avaliar("Hierárquico (Ward)", f"k={k}", AgglomerativeClustering(n_clusters=k, linkage="ward"))
    for eps in (0.8, 1.0, 1.2):
        avaliar("DBSCAN", f"eps={eps}", DBSCAN(eps=eps, min_samples=3))

    res = pd.DataFrame(linhas)
    return res, perfil.reset_index(drop=True), rotulos


def melhor_agrupamento(res):
    validos = res.dropna(subset=["silhueta"])
    validos = validos[validos["ruido"] <= 3]
    return validos.sort_values("silhueta", ascending=False).iloc[0]


# ---------------------------------------------------------------------------
# 6. Cruzamentos de dados (correlações entre indicadores)
# ---------------------------------------------------------------------------
INDICADORES = {
    "taxa": "Taxa de detecção (por 100 mil)",
    "cob_hepb": "Cobertura hepatite B até 30 dias (%)",
    "cob_hepa": "Cobertura hepatite A (%)",
    "natalidade": "Natalidade (por mil hab.)",
    "taxa_ano_anterior": "Taxa do ano anterior",
}


def correlacoes(base, ano_ini=2014, ano_fim=2022):
    """Matriz de correlação de Pearson entre os indicadores (pares UF e ano)."""
    d = base[(base["ano"] >= ano_ini) & (base["ano"] <= ano_fim)]
    return d[list(INDICADORES)].corr().round(3)


# ---------------------------------------------------------------------------
# 7. Relatório técnico para tomadores de decisão (Markdown)
# ---------------------------------------------------------------------------
def br(valor, casas=2):
    """Formata número no padrão brasileiro (vírgula decimal, ponto de milhar)."""
    if valor is None or (isinstance(valor, float) and np.isnan(valor)):
        return "sem dado"
    txt = f"{valor:,.{casas}f}"
    return txt.replace(",", "X").replace(".", ",").replace("X", ".")


def descrever_grupos(perfil, rotulos):
    d = perfil.assign(grupo=rotulos)
    resumo = d.groupby("grupo").agg(
        ufs=("uf", lambda s: ", ".join(sorted(s))), n=("uf", "size"),
        taxa_media=("taxa_media", "mean"), cob_hepb_media=("cob_hepb_media", "mean"),
        tend_taxa=("tend_taxa", "mean"), tend_cob_hepb=("tend_cob_hepb", "mean"),
    ).reset_index()
    return resumo.sort_values("taxa_media", ascending=False).reset_index(drop=True)


def gerar_relatorio(base, ano_ref=2022, ano_ini=2014, ano_fim=2022, limiar_cobertura=90.0,
                    excluir_2020=False, limitar_100=False, excluir_es=False):
    """Monta o relatório técnico com os parâmetros escolhidos no dashboard."""
    crit, ref = aplicar_criterios(base, ano_ref, ano_ini, ano_fim, limiar_cobertura,
                                  excluir_2020, limitar_100, excluir_es)
    reg = benchmark_regressao(base)
    grp, perfil, rot = benchmark_agrupamento(base)
    melhor = melhor_agrupamento(grp)
    grupos = descrever_grupos(perfil, rot[(melhor["algoritmo"], melhor["parametro"])])

    pos = reg[reg["validacao"].str.startswith("Pós")]
    modelos = pos[pos["atributos"] != "Referência"]
    vencedor = modelos.sort_values("RMSE").iloc[0]
    ingenua = pos[pos["atributos"] == "Referência"].iloc[0]
    sem_hist = modelos[modelos["atributos"] == "Sem histórico"].sort_values("RMSE").iloc[0]

    nac = base.groupby("ano").agg(casos=("casos", "sum"), pop=("populacao", "sum"),
                                  cob=("cob_hepb", "mean")).reset_index()
    nac["taxa"] = nac["casos"] * 100_000 / nac["pop"]
    t19 = nac.loc[nac["ano"] == 2019, "taxa"].item()
    t22 = nac.loc[nac["ano"] == 2022, "taxa"].item()

    alta = crit[crit["prioridade"] == "Alta"]
    media = crit[crit["prioridade"] == "Média"]
    L = []
    L += ["# Relatório Técnico: Observatório da Hepatite B", "",
          f"Parâmetros: ano de referência {ano_ref}, tendência de {ano_ini} a {ano_fim}, "
          f"limiar de cobertura {br(limiar_cobertura, 0)}%"
          + (", sem 2020" if excluir_2020 else "")
          + (", coberturas limitadas a 100%" if limitar_100 else "")
          + (", sem Espírito Santo 2020 a 2022" if excluir_es else "") + ".", ""]
    L += ["## 1. Síntese para a decisão", "",
          f"1. **{len(alta)} UFs têm prioridade alta** (cobertura abaixo de "
          f"{br(limiar_cobertura, 0)}% e taxa acima da nacional de {br(ref['taxa_br'])} por 100 mil "
          f"em {ano_ref}): {', '.join(alta['uf'])}.",
          f"2. **{len(media)} UFs têm prioridade média**, com uma das duas condições e tendência "
          f"desfavorável: {', '.join(media['uf'])}.",
          f"3. A taxa nacional de hepatites virais caiu de {br(t19)} (2019) para {br(t22)} (2022); "
          f"a queda de 2020 acompanha a pandemia e reflete menos diagnóstico, não necessariamente "
          f"menos infecção.",
          f"4. No benchmarking, o melhor algoritmo foi **{vencedor['modelo']}** com a taxa do ano "
          f"anterior (RMSE {br(vencedor['RMSE'])}), mas a regra simples \"repetir o ano anterior\" "
          f"errou menos (RMSE {br(ingenua['RMSE'])}). A cobertura vacinal, sozinha, pouco explica a taxa.", ""]
    L += ["## 2. Critérios de seleção de dados", "",
          "| Critério | Regra | Leitura para o negócio |", "| --- | --- | --- |",
          f"| C1 Cobertura baixa | Cobertura de hepatite B até 30 dias < {br(limiar_cobertura, 0)}% em {ano_ref} | Proteção insuficiente das novas gerações |",
          f"| C2 Taxa alta | Taxa de detecção > nacional ({br(ref['taxa_br'])}) em {ano_ref} | Carga de doença acima da média do país |",
          f"| C3 Cobertura caindo | Tendência da cobertura negativa ({ano_ini} a {ano_fim}) | A proteção tende a piorar |",
          f"| C4 Taxa resistente | Taxa cai menos que a nacional ({br(ref['tend_taxa_br'])}% ao ano) ou sobe | O problema não acompanha a melhora do país |",
          "", "Prioridade **Alta** = C1 e C2; **Média** = só C1 ou só C2, com C3 ou C4; **Baixa** = demais.", ""]
    L += ["## 3. UFs selecionadas", "",
          "| UF | Região | Taxa | Cobertura (%) | Tendência da taxa (% ao ano) | Tendência da cobertura (p.p. ao ano) | Prioridade |",
          "| --- | --- | --- | --- | --- | --- | --- |"]
    for _, r in crit[crit["prioridade"] != "Baixa"].iterrows():
        L.append(f"| {r['uf']} | {r['regiao']} | {br(r['taxa'])} | {br(r['cob_hepb'])} | "
                 f"{br(r['tend_taxa_rel'], 1)} | {br(r['tend_cob_hepb'], 2)} | {r['prioridade']} |")
    L += ["", "## 4. Benchmarking: previsão da taxa (regressão)", "",
          "| Validação | Atributos | Modelo | MAE | RMSE | R² | Tempo (ms) |",
          "| --- | --- | --- | --- | --- | --- | --- |"]
    for _, r in reg.iterrows():
        L.append(f"| {r['validacao'].split(' (')[0]} | {r['atributos']} | {r['modelo']} | {br(r['MAE'])} | "
                 f"{br(r['RMSE'])} | {br(r['R2'])} | {br(r['tempo_ms'], 1)} |")
    L += ["", f"Sem a taxa do ano anterior, o melhor modelo ({sem_hist['modelo']}) alcançou R² de "
          f"{br(sem_hist['R2'])} no teste pós-pandemia. Com o histórico, o R² sobe para "
          f"{br(vencedor['R2'])}, mas nenhum algoritmo supera a referência ingênua "
          f"(R² {br(ingenua['R2'])}), o que indica forte inércia da série.", ""]
    L += ["## 5. Benchmarking: perfis de UFs (agrupamento)", "",
          "| Algoritmo | Parâmetro | Grupos | Ruído | Silhueta | Davies-Bouldin | Tempo (ms) |",
          "| --- | --- | --- | --- | --- | --- | --- |"]
    for _, r in grp.iterrows():
        L.append(f"| {r['algoritmo']} | {r['parametro']} | {r['grupos']} | {r['ruido']} | "
                 f"{br(r['silhueta'], 3)} | {br(r['davies_bouldin'], 3)} | {br(r['tempo_ms'], 1)} |")
    L += ["", f"Melhor configuração com até 3 UFs descartadas como ruído: **{melhor['algoritmo']} "
          f"({melhor['parametro']})**, silhueta {br(melhor['silhueta'], 3)}.", "",
          "| Grupo | UFs | Taxa média | Cobertura média (%) |", "| --- | --- | --- | --- |"]
    for i, r in grupos.iterrows():
        L.append(f"| {i + 1} | {r['ufs']} | {br(r['taxa_media'])} | {br(r['cob_hepb_media'])} |")
    L += ["", "## 6. Recomendações", "",
          "1. Concentrar campanhas de vacinação e busca ativa nas UFs de prioridade alta.",
          "2. Monitorar as UFs de prioridade média, sobretudo as com cobertura em queda.",
          "3. Para previsão anual, usar a taxa do ano anterior como linha de base.",
          "4. Obter casos de hepatite B por faixa etária para medir o efeito da vacina em menores de 20 anos.", ""]
    L += ["## 7. Limitações", "",
          "1. O TabNet não separa os casos por etiologia de 2013 a 2022: a taxa soma todas as hepatites virais.",
          "2. Há coberturas acima de 100% (doses fora da UF de residência ou denominador defasado).",
          "3. Os dados do Espírito Santo de 2020 a 2022 estão incompletos no TabNet.",
          "4. São 27 UFs: amostra pequena para agrupamento.", "",
          "Fonte: Ministério da Saúde, DATASUS (TabNet): Sinan, SI-PNI, Sinasc e estimativas do IBGE."]
    return "\n".join(L)
