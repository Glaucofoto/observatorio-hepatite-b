# Observatório da Hepatite B

Trabalho final da disciplina de **Mineração de Dados**, Faculdade Senac Distrito Federal (Atividades Avaliativas 5 e 6).

**Equipe:** Glauco Costa, Mauro Martins e Raquel Pereira.

## O que é

Painel interativo que cruza dados públicos do Ministério da Saúde (DATASUS/TabNet: Sinan, SI-PNI, Sinasc) e do IBGE, de 2013 a 2022, para apontar as UFs em que a vacinação contra a hepatite B precisa ser reforçada.

- **Passo a passo:** cada etapa, dos arquivos brutos ao painel, com o antes e depois do tratamento.
- **O trabalho:** negócio, coleta, higienização, modelagem conceitual, lógica e física, benchmarking e conclusões.
- **Dashboards:** visão geral, mapa por UF, cruzamentos, critérios de prioridade, tendências, mineração e qualidade dos dados.

## Estrutura

| Pasta ou arquivo | Conteúdo |
|---|---|
| `index.html`, `core.js`, `draw.js` | Painel web (HTML, CSS e JavaScript com D3) |
| `dash-shim.js` | Carrega os dados e controla filtros e gráficos |
| `dados/` | Resultados exportados pela mineração (JSON) |
| `mineracao/dados_brutos/` | Os seis arquivos CSV como foram extraídos do TabNet |
| `mineracao/dados/` | Arquivos usados na base tratada |
| `mineracao/` | Código Python (pandas e scikit-learn), script SQL do PostgreSQL e relatório técnico |

## Como reproduzir a mineração

```bash
cd mineracao
pip install -r requirements.txt
python benchmark.py                 # benchmarking de regressão e agrupamento
python benchmark_bruto_tratado.py   # benchmarking: dados brutos x dados tratados
python exportar_dashboard.py   # gera os JSON do painel em resultados/dashboard
streamlit run app.py           # versão Streamlit do painel
```

## Como visualizar localmente

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Fonte

Ministério da Saúde, DATASUS (TabNet): Sinan, SI-PNI e Sinasc; IBGE, estimativas populacionais. Na base do Sinan, o campo de classificação etiológica está em branco de 2013 a 2022; por isso a taxa de casos considera todas as hepatites virais.
