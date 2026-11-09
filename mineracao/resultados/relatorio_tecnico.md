# Relatório Técnico: Observatório da Hepatite B

Parâmetros: ano de referência 2022, tendência de 2014 a 2022, limiar de cobertura 90%.

## 1. Síntese para a decisão

1. **7 UFs têm prioridade alta** (cobertura abaixo de 90% e taxa acima da nacional de 11,92 por 100 mil em 2022): RS, SP, SC, PR, MT, AC, RR.
2. **11 UFs têm prioridade média**, com uma das duas condições e tendência desfavorável: GO, RJ, BA, MA, RO, AM, ES, PA, MS, PB, AP.
3. A taxa nacional de hepatites virais caiu de 18,13 (2019) para 11,92 (2022); a queda de 2020 acompanha a pandemia e reflete menos diagnóstico, não necessariamente menos infecção.
4. No benchmarking, o melhor algoritmo foi **Random Forest** com a taxa do ano anterior (RMSE 6,34), mas a regra simples "repetir o ano anterior" errou menos (RMSE 3,53). A cobertura vacinal, sozinha, pouco explica a taxa.

## 2. Critérios de seleção de dados

| Critério | Regra | Leitura para o negócio |
| --- | --- | --- |
| C1 Cobertura baixa | Cobertura de hepatite B até 30 dias < 90% em 2022 | Proteção insuficiente das novas gerações |
| C2 Taxa alta | Taxa de detecção > nacional (11,92) em 2022 | Carga de doença acima da média do país |
| C3 Cobertura caindo | Tendência da cobertura negativa (2014 a 2022) | A proteção tende a piorar |
| C4 Taxa resistente | Taxa cai menos que a nacional (-7,03% ao ano) ou sobe | O problema não acompanha a melhora do país |

Prioridade **Alta** = C1 e C2; **Média** = só C1 ou só C2, com C3 ou C4; **Baixa** = demais.

## 3. UFs selecionadas

| UF | Região | Taxa | Cobertura (%) | Tendência da taxa (% ao ano) | Tendência da cobertura (p.p. ao ano) | Prioridade |
| --- | --- | --- | --- | --- | --- | --- |
| RS | Sul | 30,89 | 83,71 | -6,3 | -0,40 | Alta |
| SP | Sudeste | 18,13 | 74,55 | -5,4 | -4,43 | Alta |
| SC | Sul | 22,12 | 77,24 | -8,6 | -3,24 | Alta |
| PR | Sul | 14,92 | 84,47 | -8,9 | -1,49 | Alta |
| MT | Centro-Oeste | 13,81 | 86,85 | -11,7 | -2,90 | Alta |
| AC | Norte | 42,17 | 76,69 | -15,3 | 2,11 | Alta |
| RR | Norte | 17,67 | 81,80 | -8,3 | 1,35 | Alta |
| GO | Centro-Oeste | 10,25 | 75,80 | 0,1 | -0,86 | Média |
| RJ | Sudeste | 8,56 | 69,48 | -6,3 | -4,75 | Média |
| BA | Nordeste | 6,67 | 78,09 | -4,3 | -1,20 | Média |
| MA | Nordeste | 5,26 | 77,43 | -4,0 | -3,13 | Média |
| RO | Norte | 26,23 | 94,59 | -11,0 | -3,43 | Média |
| AM | Norte | 14,12 | 103,98 | -14,7 | -0,05 | Média |
| ES | Sudeste | 7,80 | 50,61 | -10,4 | -4,01 | Média |
| PA | Norte | 7,25 | 74,39 | -7,4 | -1,92 | Média |
| MS | Centro-Oeste | 5,71 | 77,47 | -10,3 | -5,94 | Média |
| PB | Nordeste | 4,16 | 83,55 | -10,8 | -1,89 | Média |
| AP | Norte | 3,02 | 88,31 | -35,4 | -0,47 | Média |

## 4. Benchmarking: previsão da taxa (regressão)

| Validação | Atributos | Modelo | MAE | RMSE | R² | Tempo (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| Pré-pandemia | Referência | Repetir o ano anterior | 2,23 | 2,92 | 0,96 | 0,0 |
| Pré-pandemia | Sem histórico | Regressão Linear | 8,56 | 10,67 | 0,44 | 6,5 |
| Pré-pandemia | Sem histórico | KNN (k=5) | 6,85 | 9,08 | 0,59 | 6,5 |
| Pré-pandemia | Sem histórico | Árvore de Decisão | 7,99 | 11,62 | 0,33 | 4,6 |
| Pré-pandemia | Sem histórico | Random Forest | 6,75 | 9,69 | 0,54 | 251,8 |
| Pré-pandemia | Sem histórico | Gradient Boosting | 7,31 | 10,63 | 0,44 | 51,3 |
| Pré-pandemia | Com taxa do ano anterior | Regressão Linear | 3,18 | 4,27 | 0,91 | 6,5 |
| Pré-pandemia | Com taxa do ano anterior | KNN (k=5) | 5,00 | 6,12 | 0,82 | 6,4 |
| Pré-pandemia | Com taxa do ano anterior | Árvore de Decisão | 3,25 | 6,35 | 0,80 | 4,6 |
| Pré-pandemia | Com taxa do ano anterior | Random Forest | 3,25 | 5,02 | 0,88 | 248,4 |
| Pré-pandemia | Com taxa do ano anterior | Gradient Boosting | 3,96 | 6,66 | 0,78 | 47,3 |
| Pós-pandemia | Referência | Repetir o ano anterior | 1,94 | 3,53 | 0,85 | 0,0 |
| Pós-pandemia | Sem histórico | Regressão Linear | 7,44 | 8,87 | 0,04 | 6,7 |
| Pós-pandemia | Sem histórico | KNN (k=5) | 5,36 | 7,86 | 0,24 | 6,6 |
| Pós-pandemia | Sem histórico | Árvore de Decisão | 6,60 | 9,78 | -0,17 | 4,9 |
| Pós-pandemia | Sem histórico | Random Forest | 5,79 | 8,54 | 0,11 | 275,6 |
| Pós-pandemia | Sem histórico | Gradient Boosting | 5,36 | 8,16 | 0,18 | 53,1 |
| Pós-pandemia | Com taxa do ano anterior | Regressão Linear | 4,76 | 6,62 | 0,46 | 6,5 |
| Pós-pandemia | Com taxa do ano anterior | KNN (k=5) | 4,47 | 6,95 | 0,41 | 8,1 |
| Pós-pandemia | Com taxa do ano anterior | Árvore de Decisão | 4,96 | 6,78 | 0,44 | 5,1 |
| Pós-pandemia | Com taxa do ano anterior | Random Forest | 4,60 | 6,34 | 0,51 | 298,2 |
| Pós-pandemia | Com taxa do ano anterior | Gradient Boosting | 5,01 | 7,22 | 0,36 | 70,5 |

Sem a taxa do ano anterior, o melhor modelo (KNN (k=5)) alcançou R² de 0,24 no teste pós-pandemia. Com o histórico, o R² sobe para 0,51, mas nenhum algoritmo supera a referência ingênua (R² 0,85), o que indica forte inércia da série.

## 5. Benchmarking: perfis de UFs (agrupamento)

| Algoritmo | Parâmetro | Grupos | Ruído | Silhueta | Davies-Bouldin | Tempo (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| K-Means | k=2 | 2 | 0 | 0,361 | 1,178 | 6,1 |
| Hierárquico (Ward) | k=2 | 2 | 0 | 0,322 | 1,253 | 0,7 |
| K-Means | k=3 | 3 | 0 | 0,320 | 1,029 | 6,8 |
| Hierárquico (Ward) | k=3 | 3 | 0 | 0,348 | 1,017 | 0,4 |
| K-Means | k=4 | 4 | 0 | 0,353 | 0,864 | 7,5 |
| Hierárquico (Ward) | k=4 | 4 | 0 | 0,353 | 0,864 | 0,4 |
| K-Means | k=5 | 5 | 0 | 0,297 | 0,799 | 8,1 |
| Hierárquico (Ward) | k=5 | 5 | 0 | 0,274 | 0,862 | 0,4 |
| DBSCAN | eps=0.8 | 2 | 16 | 0,399 | 0,742 | 1,0 |
| DBSCAN | eps=1.0 | 1 | 13 | sem dado | sem dado | 1,0 |
| DBSCAN | eps=1.2 | 1 | 12 | sem dado | sem dado | 0,9 |

Melhor configuração com até 3 UFs descartadas como ruído: **K-Means (k=2)**, silhueta 0,361.

| Grupo | UFs | Taxa média | Cobertura média (%) |
| --- | --- | --- | --- |
| 1 | AC, AM, AP, RO, RR, RS, TO | 33,23 | 87,50 |
| 2 | AL, BA, CE, DF, ES, GO, MA, MG, MS, MT, PA, PB, PE, PI, PR, RJ, RN, SC, SE, SP | 11,40 | 83,76 |

## 6. Recomendações

1. Concentrar campanhas de vacinação e busca ativa nas UFs de prioridade alta.
2. Monitorar as UFs de prioridade média, sobretudo as com cobertura em queda.
3. Para previsão anual, usar a taxa do ano anterior como linha de base.
4. Obter casos de hepatite B por faixa etária para medir o efeito da vacina em menores de 20 anos.

## 7. Limitações

1. O TabNet não separa os casos por etiologia de 2013 a 2022: a taxa soma todas as hepatites virais.
2. Há coberturas acima de 100% (doses fora da UF de residência ou denominador defasado).
3. Os dados do Espírito Santo de 2020 a 2022 estão incompletos no TabNet.
4. São 27 UFs: amostra pequena para agrupamento.

Fonte: Ministério da Saúde, DATASUS (TabNet): Sinan, SI-PNI, Sinasc e estimativas do IBGE.