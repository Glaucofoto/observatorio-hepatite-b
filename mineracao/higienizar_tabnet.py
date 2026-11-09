"""
Higienizacao de arquivos CSV exportados do TabNet/DATASUS.
Observatorio da Hepatite B - Atividade Avaliativa 5

Uso:
    python higienizar_tabnet.py entrada.csv saida.csv nome_da_medida

Exemplo:
    python higienizar_tabnet.py casos_tabnet.csv casos_hepb.csv qtd_casos

O que o script faz:
    1. Le o arquivo em Latin-1 (codificacao padrao do TabNet).
    2. Descarta o cabecalho descritivo e o rodape (Fonte, Notas).
    3. Remove a linha e a coluna "Total".
    4. Separa o codigo IBGE do nome da UF ("17 Tocantins" -> 17, Tocantins).
    5. Converte "-" em 0 e "..." em vazio (dado indisponivel).
    6. Converte virgula decimal em ponto.
    7. Transforma o formato largo (anos em colunas) em formato longo
       (uma linha por UF e ano).
    8. Grava o resultado em UTF-8, separado por virgula.
"""

import csv
import io
import re
import sys


def ler_linhas(caminho):
    with open(caminho, encoding="latin-1") as f:
        return f.read().splitlines()


def localizar_tabela(linhas):
    """Retorna apenas as linhas da tabela (cabecalho + dados)."""
    inicio = None
    for i, linha in enumerate(linhas):
        # O cabecalho da tabela e a primeira linha com varios ";"
        if linha.count(";") >= 2:
            inicio = i
            break
    if inicio is None:
        raise ValueError("Nao foi encontrada tabela no arquivo.")

    tabela = []
    for linha in linhas[inicio:]:
        if linha.count(";") < 1:
            break  # chegou ao rodape (Fonte, Notas)
        tabela.append(linha)
    return tabela


def limpar_valor(texto):
    texto = texto.strip().strip('"').strip()
    if texto == "-":
        return "0"
    if texto in ("...", "..", ""):
        return ""
    texto = texto.replace(".", "") if re.fullmatch(r"\d{1,3}(\.\d{3})+", texto) else texto
    return texto.replace(",", ".")


def separar_uf(texto):
    texto = texto.strip().strip('"').strip()
    m = re.match(r"^(\d{2})\s+(.+)$", texto)
    if not m:
        return None, texto
    return int(m.group(1)), m.group(2).strip()


def higienizar(entrada, saida, medida):
    tabela = localizar_tabela(ler_linhas(entrada))
    leitor = csv.reader(io.StringIO("\n".join(tabela)), delimiter=";")
    linhas = list(leitor)

    cabecalho = [c.strip().strip('"') for c in linhas[0]]
    colunas_ano = [
        (i, c) for i, c in enumerate(cabecalho) if re.fullmatch(r"\d{4}", c)
    ]

    registros = []
    descartadas = 0
    for linha in linhas[1:]:
        if not linha or linha[0].strip().strip('"').lower().startswith("total"):
            continue
        cod_uf, nome_uf = separar_uf(linha[0])
        if cod_uf is None:
            descartadas += 1  # linha que nao e UF (ex.: "Ignorado/exterior")
            continue
        for i, ano in colunas_ano:
            valor = limpar_valor(linha[i]) if i < len(linha) else ""
            registros.append(
                {"cod_uf": cod_uf, "nome_uf": nome_uf, "ano": int(ano), medida: valor}
            )

    with open(saida, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=["cod_uf", "nome_uf", "ano", medida])
        escritor.writeheader()
        escritor.writerows(registros)

    print(f"Registros gravados: {len(registros)}")
    print(f"Linhas descartadas (nao UF): {descartadas}")
    vazios = sum(1 for r in registros if r[medida] == "")
    print(f"Valores indisponiveis (vazios): {vazios}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    higienizar(sys.argv[1], sys.argv[2], sys.argv[3])
