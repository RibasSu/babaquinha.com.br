-- Schema para o banco de dados D1 do Babaquinha

-- Tabela de pessoas
CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico de pontos (cada adição de ponto)
CREATE TABLE IF NOT EXISTS points_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- Tabela de estatísticas do site
CREATE TABLE IF NOT EXISTS site_stats (
    key TEXT PRIMARY KEY,
    value INTEGER DEFAULT 0
);

-- Índice para buscar pontos por pessoa
CREATE INDEX IF NOT EXISTS idx_points_person_id ON points_history(person_id);

-- Índice para ordenar por data
CREATE INDEX IF NOT EXISTS idx_points_created_at ON points_history(created_at);
