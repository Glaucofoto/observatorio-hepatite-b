"""
Benchmarking da mineração de dados - Observatório da Hepatite B (Atividade 6).

Executa, pela linha de comando:
  1. benchmarking de 5 algoritmos de regressão (prever a taxa de detecção);
  2. benchmarking de 3 algoritmos de agrupamento (perfis de UFs);
  3. critérios de seleção de dados e ranking de prioridade;
  4. relatório técnico em Markdown.

Uso:
    python benchmark.py

Saída: pasta "resultados" com os CSV e o arquivo relatorio_tecnico.md.
"""

from pathlib import Path

import observatorio as obs

SAIDA = Path(__file__).parent / "resultados"


def main():
    SAIDA.mkdir(exist_ok=True)
    base = obs.carregar_base()
    print(f"Base integrada: {len(base)} linhas (27 UFs x {base['ano'].nunique()} anos)")

    print("\n[1/4] Benchmarking de regressão...")
    reg = obs.benchmark_regressao(base)
    reg.to_csv(SAIDA / "benchmark_regressao.csv", index=False)
    print(reg[["validacao", "atributos", "modelo", "MAE", "RMSE", "R2", "tempo_ms"]]
          .round(2).to_string(index=False))

    print("\n[2/4] Benchmarking de agrupamento...")
    grp, perfil, rotulos = obs.benchmark_agrupamento(base)
    grp.to_csv(SAIDA / "benchmark_agrupamento.csv", index=False)
    print(grp.round(3).to_string(index=False))
    melhor = obs.melhor_agrupamento(grp)
    perfil.assign(grupo=rotulos[(melhor["algoritmo"], melhor["parametro"])]) \
          .to_csv(SAIDA / "perfil_ufs_grupos.csv", index=False)
    print(f"Melhor: {melhor['algoritmo']} ({melhor['parametro']}), silhueta {melhor['silhueta']:.3f}")

    print("\n[3/4] Critérios de seleção e prioridade (2022)...")
    crit, ref = obs.aplicar_criterios(base, ano_ref=2022, ano_ini=2014, ano_fim=2022)
    crit.to_csv(SAIDA / "criterios_prioridade.csv", index=False)
    print(crit[["uf", "regiao", "taxa", "cob_hepb", "pontuacao", "prioridade"]]
          .round(2).to_string(index=False))

    print("\n[4/4] Relatório técnico...")
    (SAIDA / "relatorio_tecnico.md").write_text(obs.gerar_relatorio(base), encoding="utf-8")
    print(f"Arquivos gravados em: {SAIDA.resolve()}")


if __name__ == "__main__":
    main()
