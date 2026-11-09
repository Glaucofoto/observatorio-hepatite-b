"""
Exporta os dados e os resultados da mineração para o dashboard web.

Uso:
    python exportar_dashboard.py

Gera, na pasta resultados/dashboard, um arquivo JSON por conjunto de dados:
  indicadores.json        uma linha por UF e ano (casos, população, taxa, coberturas, natalidade)
  criterios.json          critérios C1 a C4 e prioridade por UF, para cada ano de referência
                          (2016 a 2022) e limiar de cobertura (80, 85, 90 e 95%)
  criterios_resumo.json   contagem de UFs por prioridade, taxa nacional e tendência nacional
  correlacoes.json        correlação de Pearson entre pares de indicadores, por ano e no período
  regressao.json          benchmarking dos algoritmos de regressão
  agrupamento.json        benchmarking dos algoritmos de agrupamento
  grupos.json             perfil e grupo de cada UF na melhor configuração
  importancia.json        peso de cada atributo no Random Forest
"""

import json
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

import observatorio as obs

SAIDA = Path(__file__).parent / "resultados" / "dashboard"
ANOS_REF = range(2016, 2023)          # a tendência precisa de pelo menos 3 anos (2014 em diante)
LIMIARES = (80, 85, 90, 95)
PARES = ["taxa", "cob_hepb", "cob_hepa", "natalidade"]


def gravar(nome, df):
    linhas = json.loads(df.replace({np.nan: None}).to_json(orient="records", force_ascii=False))
    (SAIDA / f"{nome}.json").write_text(json.dumps(linhas, ensure_ascii=False), encoding="utf-8")
    print(f"{nome}.json: {len(linhas)} linhas")


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    base = obs.carregar_base()

    gravar("indicadores", base[["cod_uf", "uf", "nome_uf", "regiao", "ano", "casos", "populacao",
                                "nascidos", "taxa", "cob_hepb", "cob_hepa", "natalidade"]].round(3))

    crit, resumo = [], []
    for ano in ANOS_REF:
        for limiar in LIMIARES:
            t, ref = obs.aplicar_criterios(base, ano, 2014, ano, limiar)
            t = t.assign(ano_ref=ano, limiar=limiar)
            crit.append(t)
            resumo.append({"ano_ref": ano, "limiar": limiar,
                           "taxa_br": ref["taxa_br"], "tend_taxa_br": ref["tend_taxa_br"],
                           "n_alta": int((t["prioridade"] == "Alta").sum()),
                           "n_media": int((t["prioridade"] == "Média").sum()),
                           "n_baixa": int((t["prioridade"] == "Baixa").sum())})
    crit = pd.concat(crit)
    for c in ["C1_cobertura_baixa", "C2_taxa_alta", "C3_cobertura_caindo", "C4_taxa_resistente"]:
        crit[c] = crit[c].map({True: "Sim", False: "Não"})
    gravar("criterios", crit[["ano_ref", "limiar", "uf", "regiao", "taxa", "cob_hepb", "casos",
                              "tend_taxa_rel", "tend_cob_hepb", "C1_cobertura_baixa",
                              "C2_taxa_alta", "C3_cobertura_caindo", "C4_taxa_resistente",
                              "pontuacao", "prioridade"]].round(3))
    gravar("criterios_resumo", pd.DataFrame(resumo).round(3))

    linhas = []
    periodos = [(str(a), base[base["ano"] == a]) for a in range(2014, 2023)]
    periodos.append(("2014-2022", base[base["ano"].between(2014, 2022)]))
    for nome, d in periodos:
        for x, y in combinations(PARES + ["taxa_ano_anterior"], 2):
            par = d[[x, y]].dropna()
            if len(par) >= 5:
                linhas.append({"periodo": nome, "x": x, "y": y,
                               "r": round(float(par[x].corr(par[y])), 3), "n": len(par)})
    gravar("correlacoes", pd.DataFrame(linhas))

    gravar("regressao", obs.benchmark_regressao(base).round(3))
    grp, perfil, rotulos = obs.benchmark_agrupamento(base)
    melhor = obs.melhor_agrupamento(grp)
    grp["melhor"] = np.where((grp["algoritmo"] == melhor["algoritmo"])
                             & (grp["parametro"] == melhor["parametro"]), "Sim", "Não")
    gravar("agrupamento", grp.round(3))
    perfil = perfil.assign(grupo=rotulos[(melhor["algoritmo"], melhor["parametro"])] + 1)
    gravar("grupos", perfil.round(3))
    gravar("importancia", obs.importancia_atributos(base).round(4))


if __name__ == "__main__":
    main()
