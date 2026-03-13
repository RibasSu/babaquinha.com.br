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

-- Votos para habilitar um Super Babaquinha (4 votos diferentes)
CREATE TABLE IF NOT EXISTS super_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    voter_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    UNIQUE(person_id, voter_key)
);

-- Registro de pontos especiais "Super Babaquinha"
CREATE TABLE IF NOT EXISTS super_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id TEXT NOT NULL,
    approved_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

-- Foto opcional da pessoa (Data URL em base64)
CREATE TABLE IF NOT EXISTS people_photos (
    person_id TEXT PRIMARY KEY,
    photo_data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_super_votes_person_id ON super_votes(person_id);
CREATE INDEX IF NOT EXISTS idx_super_points_person_id ON super_points(person_id);
