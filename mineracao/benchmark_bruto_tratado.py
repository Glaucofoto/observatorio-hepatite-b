"""
Benchmarking: dados brutos (sem tratamento) x dados tratados.
Observatório da Hepatite B - Mineração de Dados, Faculdade Senac DF

Uso:
    python benchmark_bruto_tratado.py

Pergunta: o tratamento dos dados melhora a mineração?
Os mesmos algoritmos são treinados e testados duas vezes, com a mesma validação temporal:

  Dados brutos      os seis arquivos entregues na extração (pasta dados_brutos), apenas
                    juntados pela chave UF + ano: valores absolutos (casos, população,
                    nascidos), as três coberturas extraídas, células ausentes convertidas
                    em zero (única intervenção para os algoritmos rodarem), coberturas acima
                    de 100% sem marcação, nenhum indicador derivado e nenhuma padronização.
                    O alvo é o número de casos.

  Dados tratados    o resultado das 8 etapas de higienização e modelagem: taxa por 100 mil
                    habitantes, natalidade por mil, ausentes excluídos, região como atributo,
                    padronização das escalas e, no segundo conjunto, a taxa do ano anterior.
                    O alvo é a taxa por 100 mil habitantes.

Para comparar na mesma unidade, a previsão de casos do cenário bruto é convertida em taxa
(casos previstos x 100.000 / população). Assim, MAE e RMSE são sempre em casos por 100 mil.

Saídas em resultados/:
  bruto_tratado_qualidade.csv     perfil de qualidade de cada base
  bruto_tratado_regressao.csv     métricas de cada algoritmo nos dois cenários
  bruto_tratado_agrupamento.csv   K-Means sobre a base bruta e sobre a tratada
e, em resultados/dashboard/, os mesmos conteúdos em JSON para o painel.
"""

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.preprocessing import StandardScaler

import observatorio as obs

PASTA = Path(__file__).parent
BRUTOS = PASTA / "dados_brutos"
SAIDA = PASTA / "resultados"
DASH = SAIDA / "dashboard"

CEN_BRUTO = "Dados brutos"
CEN_SEM = "Dados tratados (sem histórico)"
CEN_COM = "Dados tratados (com taxa do ano anterior)"

# Atributos disponíveis na tabela bruta: só o que vem do TabNet, sem derivar nada
ATRIB_BRUTO = ["cod_uf", "ano", "populacao", "nascidos", "cob_geral", "cob_hepb", "cob_hepa"]
ARQUIVOS_BRUTOS = [
    ("casos_hepatite.csv", "qtd_casos", "casos", "Sinan"),
    ("populacao.csv", "qtd_populacao", "populacao", "IBGE"),
    ("nascidos_vivos.csv", "qtd_nascidos", "nascidos", "Sinasc"),
    ("cobertura.csv", "perc_cobertura", "cob_geral", "SI-PNI"),
    ("cobertura_hepb30.csv", "perc_cobertura", "cob_hepb", "SI-PNI"),
    ("cobertura_hepa.csv", "perc_cobertura", "cob_hepa", "SI-PNI"),
]
COBS = ["cob_geral", "cob_hepb", "cob_hepa"]


# ---------------------------------------------------------------------------
# 1. Montagem das duas bases
# ---------------------------------------------------------------------------
def base_bruta():
    """Junta os seis arquivos entregues, como foram extraídos, sem nenhuma etapa de tratamento."""
    base = None
    for nome, col, novo, _ in ARQUIVOS_BRUTOS:
        d = pd.read_csv(BRUTOS / nome)[["cod_uf", "ano", col]].rename(columns={col: novo})
        base = d if base is None else base.merge(d, on=["cod_uf", "ano"], how="outer")
    base = base.sort_values(["cod_uf", "ano"]).reset_index(drop=True)
    # Leitura ingênua: tudo o que está vazio vira zero
    ausentes = int(base[COBS].isna().sum().sum())
    base[COBS] = base[COBS].fillna(0)
    return base, ausentes


def perfil_arquivos():
    """Perfil de cada arquivo entregue: linhas, anos, ausentes, zeros e valores acima de 100%."""
    linhas = []
    for nome, col, _, sistema in ARQUIVOS_BRUTOS:
        d = pd.read_csv(BRUTOS / nome)
        v = d[col]
        linhas.append({"arquivo": nome, "sistema": sistema, "coluna": col, "linhas": len(d),
                       "ufs": d["cod_uf"].nunique(), "anos": f"{d['ano'].min()} a {d['ano'].max()}",
                       "ausentes": int(v.isna().sum()),
                       "acima_100": int((v > 100).sum()) if col == "perc_cobertura" else None,
                       "uso": "Descartado: substituído pela cobertura de hepatite B até 30 dias"
                       if nome == "cobertura.csv" else "Usado na base tratada"})
    return pd.DataFrame(linhas)


def amostra(bruta, tratada, uf=12, anos=(2013, 2016)):
    """As mesmas linhas antes e depois do tratamento, para demonstrar as transformações."""
    b = bruta[(bruta["cod_uf"] == uf) & bruta["ano"].between(*anos)].copy()
    t = tratada[(tratada["cod_uf"] == uf) & tratada["ano"].between(*anos)].copy()
    t["situacao"] = np.where(t[["cob_hepb", "cob_hepa", "taxa_ano_anterior"]].isna().any(axis=1),
                             "Excluída da modelagem (ausente)", "Usada na modelagem")
    return (b[["cod_uf", "ano", "casos", "populacao", "nascidos", "cob_geral", "cob_hepb", "cob_hepa"]],
            t[["uf", "regiao", "ano", "casos", "populacao", "taxa", "natalidade", "cob_hepb", "cob_hepa",
               "taxa_ano_anterior", "situacao"]])


def perfil_qualidade(bruta, ausentes_zerados, tratada):
    """Compara as duas bases quanto aos problemas que o tratamento resolve."""
    trat = obs._matriz(tratada)
    linhas = [
        ("Registros usados na modelagem", len(bruta), len(trat)),
        ("Células ausentes convertidas em zero", ausentes_zerados, 0),
        ("Arquivos de cobertura (um redundante)", 3, 2),
        ("Coberturas iguais a zero (falsas)", int((bruta[COBS] == 0).sum().sum()),
         int((trat[["cob_hepb", "cob_hepa"]] == 0).sum().sum())),
        ("Coberturas acima de 100% sem marcação", int((bruta[COBS] > 100).sum().sum()), 0),
        ("Atributos disponíveis", len(ATRIB_BRUTO), len(obs.ATRIBUTOS["Com taxa do ano anterior"])),
        ("Indicadores relativos (por habitante)", 0, 3),
        ("Razão entre o maior e o menor valor do alvo",
         round(float(bruta["casos"].max() / bruta.loc[bruta["casos"] > 0, "casos"].min()), 1),
         round(float(trat["taxa"].max() / trat["taxa"].min()), 1)),
    ]
    return pd.DataFrame(linhas, columns=["aspecto", "bruto", "tratado"])


# ---------------------------------------------------------------------------
# 2. Regressão nos dois cenários
# ---------------------------------------------------------------------------
def _sem_padronizacao():
    """Os mesmos algoritmos, mas sem padronizar as escalas (cenário bruto)."""
    from sklearn.linear_model import LinearRegression
    from sklearn.neighbors import KNeighborsRegressor
    from sklearn.tree import DecisionTreeRegressor
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    return {
        "Regressão Linear": LinearRegression(),
        "KNN (k=5)": KNeighborsRegressor(n_neighbors=5),
        "Árvore de Decisão": DecisionTreeRegressor(max_depth=4, random_state=obs.SEMENTE),
        "Random Forest": RandomForestRegressor(n_estimators=300, random_state=obs.SEMENTE),
        "Gradient Boosting": GradientBoostingRegressor(random_state=obs.SEMENTE),
    }


def _metricas(y, pred):
    return {"MAE": mean_absolute_error(y, pred), "RMSE": mean_squared_error(y, pred) ** 0.5,
            "R2": r2_score(y, pred)}


def regressao(bruta, tratada):
    d_trat = obs._matriz(tratada)
    linhas = []
    for validacao, ((tr0, tr1), (te0, te1)) in obs.VALIDACOES.items():
        # Cenário bruto: alvo em casos; mesma janela de treino e de teste dos cenários tratados
        tr = bruta[(bruta["ano"] >= tr0) & (bruta["ano"] <= tr1)]
        te = bruta[(bruta["ano"] >= te0) & (bruta["ano"] <= te1)]
        for nome, modelo in _sem_padronizacao().items():
            t0 = time.perf_counter()
            modelo.fit(tr[ATRIB_BRUTO], tr["casos"])
            casos_prev = modelo.predict(te[ATRIB_BRUTO])
            ms = (time.perf_counter() - t0) * 1000
            taxa_real = te["casos"] * 100_000 / te["populacao"]
            taxa_prev = casos_prev * 100_000 / te["populacao"]
            m = _metricas(taxa_real, taxa_prev)
            linhas.append({"validacao": validacao, "cenario": CEN_BRUTO, "modelo": nome, **m,
                           "R2_unidade_propria": r2_score(te["casos"], casos_prev),
                           "tempo_ms": ms, "n_treino": len(tr), "n_teste": len(te)})

        # Cenários tratados: alvo em taxa; mesmos algoritmos do benchmark principal
        tr = d_trat[(d_trat["ano"] >= tr0) & (d_trat["ano"] <= tr1)]
        te = d_trat[(d_trat["ano"] >= te0) & (d_trat["ano"] <= te1)]
        for cenario, conjunto in [(CEN_SEM, "Sem histórico"), (CEN_COM, "Com taxa do ano anterior")]:
            cols = obs.ATRIBUTOS[conjunto]
            for nome, modelo in obs._modelos_regressao().items():
                t0 = time.perf_counter()
                modelo.fit(tr[cols], tr["taxa"])
                pred = modelo.predict(te[cols])
                ms = (time.perf_counter() - t0) * 1000
                m = _metricas(te["taxa"], pred)
                linhas.append({"validacao": validacao, "cenario": cenario, "modelo": nome, **m,
                               "R2_unidade_propria": m["R2"], "tempo_ms": ms,
                               "n_treino": len(tr), "n_teste": len(te)})
    return pd.DataFrame(linhas)


# ---------------------------------------------------------------------------
# 3. Agrupamento nos dois cenários
# ---------------------------------------------------------------------------
def agrupamento(bruta, tratada, k=2):
    # Bruto: médias de 2014 a 2022 dos valores absolutos, sem padronizar
    b = bruta[bruta["ano"].between(2014, 2022)].groupby("cod_uf")[
        ["casos", "populacao", "nascidos", "cob_hepb", "cob_hepa"]].mean()
    lab_b = KMeans(n_clusters=k, n_init=20, random_state=obs.SEMENTE).fit_predict(b)
    # Tratado: perfil de taxas e tendências, padronizado (configuração vencedora do benchmark)
    perfil = obs.tendencias(tratada, 2014, 2022).dropna(subset=obs.VARS_GRUPO)
    Xt = StandardScaler().fit_transform(perfil[obs.VARS_GRUPO])
    lab_t = KMeans(n_clusters=k, n_init=20, random_state=obs.SEMENTE).fit_predict(Xt)

    sig = obs.SIGLAS
    linhas = []
    for cenario, X, lab, ufs, base_desc in [
        (CEN_BRUTO, b.values, lab_b, [sig[c] for c in b.index], "médias absolutas sem padronização"),
        ("Dados tratados", Xt, lab_t, list(perfil["uf"]), "taxas e tendências padronizadas"),
    ]:
        tamanhos = np.bincount(lab)
        menor = int(np.argmin(tamanhos))
        linhas.append({
            "cenario": cenario, "variaveis": base_desc, "k": k,
            "silhueta": float(silhouette_score(X, lab)),
            "maior_grupo": int(tamanhos.max()), "menor_grupo": int(tamanhos.min()),
            "ufs_menor_grupo": ", ".join(sorted(u for u, l in zip(ufs, lab) if l == menor)),
        })
    return pd.DataFrame(linhas)


# ---------------------------------------------------------------------------
# 4. Execução
# ---------------------------------------------------------------------------
def gravar(df, nome):
    df.to_csv(SAIDA / f"{nome}.csv", index=False)
    DASH.mkdir(parents=True, exist_ok=True)
    linhas = json.loads(df.round(3).replace({np.nan: None}).to_json(orient="records", force_ascii=False))
    (DASH / f"{nome}.json").write_text(json.dumps(linhas, ensure_ascii=False), encoding="utf-8")


def main():
    pd.set_option("display.width", 160)
    bruta, zerados = base_bruta()
    tratada = obs.carregar_base()
    gravar(perfil_arquivos(), "arquivos_brutos")
    am_b, am_t = amostra(bruta, tratada)
    gravar(am_b, "amostra_bruta")
    gravar(am_t, "amostra_tratada")

    qual = perfil_qualidade(bruta, zerados, tratada)
    reg = regressao(bruta, tratada)
    grp = agrupamento(bruta, tratada)
    gravar(qual, "bruto_tratado_qualidade")
    gravar(reg, "bruto_tratado_regressao")
    gravar(grp, "bruto_tratado_agrupamento")

    print("\n1. Qualidade das bases\n")
    print(qual.to_string(index=False))
    print("\n2. Regressão (MAE e RMSE em casos por 100 mil habitantes)\n")
    resumo = reg.groupby(["validacao", "cenario"]).agg(melhor_RMSE=("RMSE", "min"), RMSE_medio=("RMSE", "mean"),
                                                         melhor_R2=("R2", "max")).round(3)
    print(resumo.to_string())
    print("\n3. Agrupamento K-Means (k=2)\n")
    print(grp.round(3).to_string(index=False))


if __name__ == "__main__":
    main()
