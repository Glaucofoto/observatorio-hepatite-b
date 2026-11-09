-- =====================================================================
-- OBSERVATORIO DA HEPATITE B - Atividade Avaliativa 5
-- Modelagem fisica: DDL e DML com os DADOS REAIS extraidos do DATASUS
-- SGBD: PostgreSQL 14 ou superior
--
-- Arquivos carregados (UTF-8, separados por virgula, ja higienizados):
--   casos_hepatite.csv    Sinan    casos confirmados de hepatites virais
--                                  (todas as etiologias), UF de residencia, 2013-2022
--   cobertura_hepb30.csv  SI-PNI   cobertura vacinal hepatite B em < 30 dias (%)
--   cobertura_hepa.csv    SI-PNI   cobertura vacinal hepatite A (%), 2014-2022
--   populacao.csv         IBGE     populacao residente
--   nascidos_vivos.csv    Sinasc   nascidos vivos
--
-- Execucao (no psql, a partir da pasta onde estao os CSV):
--   psql -d <banco> -f observatorio_hepb.sql
-- =====================================================================


-- =====================================================================
-- 1. DDL - CRIACAO DA ESTRUTURA
-- =====================================================================

DROP VIEW  IF EXISTS vw_indicadores_uf;
DROP TABLE IF EXISTS caso_hepatite, cobertura_vacinal, populacao, nascidos_vivos,
                     imunobiologico, uf, regiao CASCADE;

CREATE TABLE regiao (
    id_regiao   SMALLINT     PRIMARY KEY,
    nome        VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE uf (
    cod_uf      SMALLINT     PRIMARY KEY,
    sigla       CHAR(2)      NOT NULL UNIQUE,
    nome        VARCHAR(30)  NOT NULL,
    id_regiao   SMALLINT     NOT NULL REFERENCES regiao (id_regiao)
);

CREATE TABLE imunobiologico (
    id_imuno    SMALLINT     PRIMARY KEY,
    nome        VARCHAR(60)  NOT NULL UNIQUE
);

-- Casos confirmados de hepatites virais (Sinan), por UF de residencia e ano
CREATE TABLE caso_hepatite (
    cod_uf      SMALLINT  NOT NULL REFERENCES uf (cod_uf),
    ano         SMALLINT  NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
    qtd_casos   INTEGER   NOT NULL CHECK (qtd_casos >= 0),
    PRIMARY KEY (cod_uf, ano)
);

-- Cobertura vacinal (SI-PNI), por UF, ano e imunobiologico
CREATE TABLE cobertura_vacinal (
    cod_uf          SMALLINT      NOT NULL REFERENCES uf (cod_uf),
    ano             SMALLINT      NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
    id_imuno        SMALLINT      NOT NULL REFERENCES imunobiologico (id_imuno),
    perc_cobertura  NUMERIC(6,2)  CHECK (perc_cobertura >= 0),
    PRIMARY KEY (cod_uf, ano, id_imuno)
);

CREATE TABLE populacao (
    cod_uf          SMALLINT  NOT NULL REFERENCES uf (cod_uf),
    ano             SMALLINT  NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
    qtd_populacao   INTEGER   NOT NULL CHECK (qtd_populacao > 0),
    PRIMARY KEY (cod_uf, ano)
);

CREATE TABLE nascidos_vivos (
    cod_uf          SMALLINT  NOT NULL REFERENCES uf (cod_uf),
    ano             SMALLINT  NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
    qtd_nascidos    INTEGER   NOT NULL CHECK (qtd_nascidos > 0),
    PRIMARY KEY (cod_uf, ano)
);

CREATE INDEX idx_cobertura_imuno ON cobertura_vacinal (id_imuno, ano);


-- =====================================================================
-- 2. DML - TABELAS DE DOMINIO
-- =====================================================================

INSERT INTO regiao (id_regiao, nome) VALUES
    (1, 'Norte'), (2, 'Nordeste'), (3, 'Sudeste'), (4, 'Sul'), (5, 'Centro-Oeste');

INSERT INTO uf (cod_uf, sigla, nome, id_regiao) VALUES
    (11, 'RO', 'Rondônia', 1),          (12, 'AC', 'Acre', 1),
    (13, 'AM', 'Amazonas', 1),          (14, 'RR', 'Roraima', 1),
    (15, 'PA', 'Pará', 1),              (16, 'AP', 'Amapá', 1),
    (17, 'TO', 'Tocantins', 1),         (21, 'MA', 'Maranhão', 2),
    (22, 'PI', 'Piauí', 2),             (23, 'CE', 'Ceará', 2),
    (24, 'RN', 'Rio Grande do Norte', 2), (25, 'PB', 'Paraíba', 2),
    (26, 'PE', 'Pernambuco', 2),        (27, 'AL', 'Alagoas', 2),
    (28, 'SE', 'Sergipe', 2),           (29, 'BA', 'Bahia', 2),
    (31, 'MG', 'Minas Gerais', 3),      (32, 'ES', 'Espírito Santo', 3),
    (33, 'RJ', 'Rio de Janeiro', 3),    (35, 'SP', 'São Paulo', 3),
    (41, 'PR', 'Paraná', 4),            (42, 'SC', 'Santa Catarina', 4),
    (43, 'RS', 'Rio Grande do Sul', 4), (50, 'MS', 'Mato Grosso do Sul', 5),
    (51, 'MT', 'Mato Grosso', 5),       (52, 'GO', 'Goiás', 5),
    (53, 'DF', 'Distrito Federal', 5);

INSERT INTO imunobiologico (id_imuno, nome) VALUES
    (1, 'Hepatite B em crianças até 30 dias'),
    (2, 'Hepatite A');


-- =====================================================================
-- 3. DML - CARGA DOS CSV REAIS (tabelas de staging + \copy)
-- =====================================================================

CREATE TEMP TABLE stg (cod_uf SMALLINT, nome_uf TEXT, ano SMALLINT, valor NUMERIC);

\copy stg FROM 'casos_hepatite.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO caso_hepatite SELECT cod_uf, ano, valor FROM stg;
TRUNCATE stg;

\copy stg FROM 'populacao.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO populacao SELECT cod_uf, ano, valor FROM stg;
TRUNCATE stg;

\copy stg FROM 'nascidos_vivos.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO nascidos_vivos SELECT cod_uf, ano, valor FROM stg;
TRUNCATE stg;

-- Linhas sem valor (2013 da hepatite B < 30 dias) ficam fora: dado indisponivel
\copy stg FROM 'cobertura_hepb30.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO cobertura_vacinal SELECT cod_uf, ano, 1, valor FROM stg WHERE valor IS NOT NULL;
TRUNCATE stg;

\copy stg FROM 'cobertura_hepa.csv' WITH (FORMAT csv, HEADER true)
INSERT INTO cobertura_vacinal SELECT cod_uf, ano, 2, valor FROM stg WHERE valor IS NOT NULL;
DROP TABLE stg;


-- =====================================================================
-- 4. VISAO ANALITICA
-- =====================================================================

CREATE VIEW vw_indicadores_uf AS
SELECT r.nome                                             AS regiao,
       u.sigla                                            AS uf,
       p.ano,
       c.qtd_casos                                        AS casos,
       p.qtd_populacao                                    AS populacao,
       ROUND(c.qtd_casos * 100000.0 / p.qtd_populacao, 2) AS taxa_100mil,
       cb.perc_cobertura                                  AS cobertura_hepb30
  FROM populacao p
  JOIN uf u      ON u.cod_uf = p.cod_uf
  JOIN regiao r  ON r.id_regiao = u.id_regiao
  JOIN caso_hepatite c ON c.cod_uf = p.cod_uf AND c.ano = p.ano
  LEFT JOIN cobertura_vacinal cb
         ON cb.cod_uf = p.cod_uf AND cb.ano = p.ano AND cb.id_imuno = 1;


-- =====================================================================
-- 5. CONSULTAS ANALITICAS
-- =====================================================================

-- Q1. Contagem de registros carregados (controle da carga)
SELECT 'caso_hepatite' AS tabela, COUNT(*) FROM caso_hepatite
UNION ALL SELECT 'populacao', COUNT(*) FROM populacao
UNION ALL SELECT 'nascidos_vivos', COUNT(*) FROM nascidos_vivos
UNION ALL SELECT 'cobertura_vacinal', COUNT(*) FROM cobertura_vacinal;

-- Q2. Ranking de UFs prioritarias em 2022:
--     cobertura hepatite B < 30 dias abaixo de 90% e taxa acima da nacional
WITH nac AS (
  SELECT SUM(casos) * 100000.0 / SUM(populacao) AS taxa_br
    FROM vw_indicadores_uf WHERE ano = 2022)
SELECT uf, regiao, taxa_100mil, cobertura_hepb30
  FROM vw_indicadores_uf, nac
 WHERE ano = 2022 AND cobertura_hepb30 < 90 AND taxa_100mil > nac.taxa_br
 ORDER BY taxa_100mil DESC;

-- Q3. Evolucao nacional: casos, taxa e cobertura media por ano
SELECT ano, SUM(casos) AS casos,
       ROUND(SUM(casos) * 100000.0 / SUM(populacao), 2) AS taxa_100mil,
       ROUND(AVG(cobertura_hepb30), 2) AS cobertura_media_ufs
  FROM vw_indicadores_uf
 GROUP BY ano ORDER BY ano;

-- Q4. Indicadores por regiao em 2022
SELECT regiao, SUM(casos) AS casos,
       ROUND(SUM(casos) * 100000.0 / SUM(populacao), 2) AS taxa_100mil,
       ROUND(AVG(cobertura_hepb30), 2) AS cobertura_media
  FROM vw_indicadores_uf WHERE ano = 2022
 GROUP BY regiao ORDER BY taxa_100mil DESC;

-- Q5. Variacao da taxa entre 2019 (pre-pandemia) e 2022, por UF
SELECT uf,
       MAX(taxa_100mil) FILTER (WHERE ano = 2019) AS taxa_2019,
       MAX(taxa_100mil) FILTER (WHERE ano = 2022) AS taxa_2022,
       ROUND(MAX(taxa_100mil) FILTER (WHERE ano = 2022)
           - MAX(taxa_100mil) FILTER (WHERE ano = 2019), 2) AS variacao
  FROM vw_indicadores_uf
 GROUP BY uf ORDER BY variacao;

-- Q6. Correlacao de Pearson entre cobertura e taxa (todas as UFs e anos)
SELECT ROUND(CORR(cobertura_hepb30, taxa_100mil)::numeric, 3) AS correlacao,
       COUNT(cobertura_hepb30) AS pares
  FROM vw_indicadores_uf;

-- Q7. Controle de qualidade: coberturas acima de 100%
SELECT u.sigla, cv.ano, i.nome, cv.perc_cobertura
  FROM cobertura_vacinal cv
  JOIN uf u ON u.cod_uf = cv.cod_uf
  JOIN imunobiologico i ON i.id_imuno = cv.id_imuno
 WHERE cv.perc_cobertura > 100
 ORDER BY cv.perc_cobertura DESC;
