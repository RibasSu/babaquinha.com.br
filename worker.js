/**
 * Cloudflare Worker to serve the Babaquinha counter page
 * Usando D1 como banco de dados
 */

/**
 * Inicializa as tabelas do banco de dados se não existirem
 */
async function initDatabase(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS points_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );
  `);
}

/**
 * Busca a lista de pessoas do D1 ordenada por pontos (decrescente)
 */
async function getPeopleList(env) {
  const result = await env.DB.prepare(
    `
    SELECT p.id, p.name, COUNT(ph.id) as count
    FROM people p
    LEFT JOIN points_history ph ON p.id = ph.person_id
    GROUP BY p.id, p.name
    ORDER BY count DESC, p.name ASC
  `,
  ).all();

  return result.results || [];
}

/**
 * Busca o histórico de pontos de uma pessoa
 */
async function getPersonHistory(env, personId) {
  const result = await env.DB.prepare(
    `
    SELECT reason, created_at
    FROM points_history
    WHERE person_id = ?
    ORDER BY created_at DESC
  `,
  )
    .bind(personId)
    .all();

  return result.results || [];
}

function getHtmlTemplate(people) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contador de Babaquinha</title>
    <style>
      :root {
        --font-size: 1em;
      }

      body.large-text {
        --font-size: 1.5em;
      }

      body.extra-large-text {
        --font-size: 2em;
      }

      body {
        font-size: var(--font-size);
      }

      body.high-contrast {
        background: #000;
        color: #fff;
      }

      body.high-contrast button {
        background: #fff;
        color: #000;
        border: 2px solid #fff;
      }

      #accessibility-bar {
        position: fixed;
        top: 0;
        right: 0;
        background: #f0f0f0;
        padding: 10px;
        border-bottom-left-radius: 5px;
        z-index: 1000;
      }

      #accessibility-bar button {
        margin: 0 5px;
        padding: 5px 10px;
        cursor: pointer;
      }

      .person-card {
        border: 1px solid #ccc;
        padding: 15px;
        margin: 10px 0;
        border-radius: 5px;
      }

      .person-card h2 {
        margin-top: 0;
      }

      .add-person-form {
        margin: 20px 0;
        padding: 15px;
        border: 2px dashed #ccc;
        border-radius: 5px;
      }

      .add-person-form input {
        padding: 8px;
        margin: 5px;
        font-size: 1em;
      }

      .add-person-form button {
        padding: 8px 16px;
        margin: 5px;
        cursor: pointer;
      }

      body.high-contrast .person-card {
        border-color: #fff;
      }

      body.high-contrast .add-person-form {
        border-color: #fff;
      }

      .add-point-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
      }

      .add-point-form input[type="text"] {
        padding: 8px;
        font-size: 0.9em;
        border: 1px solid #ccc;
        border-radius: 4px;
      }

      .add-point-form button {
        padding: 8px 16px;
        cursor: pointer;
      }

      .history-toggle {
        background: none;
        border: none;
        color: #0066cc;
        cursor: pointer;
        font-size: 0.9em;
        padding: 5px 0;
        text-decoration: underline;
      }

      body.high-contrast .history-toggle {
        color: #66b3ff;
      }

      .history-list {
        display: none;
        margin-top: 10px;
        padding: 10px;
        background: #f9f9f9;
        border-radius: 5px;
        max-height: 200px;
        overflow-y: auto;
      }

      .history-list.show {
        display: block;
      }

      body.high-contrast .history-list {
        background: #222;
      }

      .history-item {
        padding: 5px 0;
        border-bottom: 1px solid #eee;
        font-size: 0.85em;
      }

      body.high-contrast .history-item {
        border-bottom-color: #444;
      }

      .history-item:last-child {
        border-bottom: none;
      }

      .history-date {
        color: #666;
        font-size: 0.8em;
      }

      body.high-contrast .history-date {
        color: #aaa;
      }

      .history-reason {
        font-style: italic;
      }

      body.high-contrast .add-point-form input {
        background: #333;
        color: #fff;
        border-color: #fff;
      }
    </style>
  </head>
  <body>
    <div id="accessibility-bar">
      <button
        id="increaseFont"
        title="Aumentar fonte"
        aria-label="Aumentar tamanho da fonte"
      >
        A+
      </button>
      <button
        id="decreaseFont"
        title="Diminuir fonte"
        aria-label="Diminuir tamanho da fonte"
      >
        A-
      </button>
      <button
        id="toggleContrast"
        title="Alto contraste"
        aria-label="Alternar alto contraste"
      >
        Contraste
      </button>
    </div>

    <main>
      <h1>Contador de Babaquinha</h1>
      
      <div class="add-person-form">
        <h2>Adicionar Nova Pessoa</h2>
        <input type="text" id="newPersonName" placeholder="Nome da pessoa" />
        <button id="addPersonBtn">Adicionar Pessoa</button>
      </div>

      <div id="peopleList">
        ${people
          .map(
            (person) => `
          <div class="person-card">
            <h2>${person.name}</h2>
            <p role="status" aria-live="polite">
              Foi babaquinha: <span class="count" data-person="${person.id}">${person.count}</span> vezes
            </p>
            <div class="add-point-form">
              <input type="text" class="reason-input" data-person="${person.id}" placeholder="Por que está adicionando ponto? (opcional)" />
              <button class="addBtn" data-person="${person.id}">Adicionar +1</button>
            </div>
            <button class="history-toggle" data-person="${person.id}">Ver histórico</button>
            <div class="history-list" id="history-${person.id}">
              <p>Carregando histórico...</p>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </main>

    <!-- VLibras -->
    <div vw class="enabled">
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    </div>
    <script src="https://vlibras.gov.br/app/vlibras-plugin.js"></script>
    <script>
      new window.VLibras.Widget("https://vlibras.gov.br/app");
    </script>

    <script>
      const API_URL = "/api";

      // Verifica quantas vezes o usuário já adicionou hoje para uma pessoa específica
      function checkDailyLimit(personId) {
        const today = new Date().toDateString();
        const key = \`babaquinha_limit_\${personId}\`;
        const data = localStorage.getItem(key);

        if (!data) {
          return { count: 0, date: today };
        }

        const parsed = JSON.parse(data);

        // Se é um novo dia, reseta o contador
        if (parsed.date !== today) {
          return { count: 0, date: today };
        }

        return parsed;
      }

      function updateDailyLimit(personId, count) {
        const today = new Date().toDateString();
        const key = \`babaquinha_limit_\${personId}\`;
        localStorage.setItem(
          key,
          JSON.stringify({
            count: count,
            date: today,
          })
        );
      }

      async function incrementCount(personId) {
        const limit = checkDailyLimit(personId);
        const countElement = document.querySelector(\`.count[data-person="\${personId}"]\`);
        const reasonInput = document.querySelector(\`.reason-input[data-person="\${personId}"]\`);
        const reason = reasonInput ? reasonInput.value.trim() : "";
        const currentCount = parseInt(countElement.textContent);

        // Sempre incrementa visualmente
        countElement.textContent = currentCount + 1;

        // Só envia ao servidor se não atingiu o limite
        if (limit.count < 2) {
          try {
            const response = await fetch(\`\${API_URL}/person/\${personId}/increment\`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ reason }),
            });

            if (response.ok) {
              const data = await response.json();
              // Atualiza com o valor real do servidor
              countElement.textContent = data.count;

              const newLimit = limit.count + 1;
              updateDailyLimit(personId, newLimit);

              // Limpa o campo de razão
              if (reasonInput) {
                reasonInput.value = "";
              }
            }
          } catch (error) {
            console.error("Erro ao incrementar contador:", error);
          }
        }
      }

      async function loadHistory(personId) {
        const historyDiv = document.getElementById(\`history-\${personId}\`);
        try {
          const response = await fetch(\`\${API_URL}/person/\${personId}/history\`);
          if (response.ok) {
            const history = await response.json();
            if (history.length === 0) {
              historyDiv.innerHTML = "<p>Nenhum ponto registrado ainda.</p>";
            } else {
              historyDiv.innerHTML = history.map(item => \`
                <div class="history-item">
                  <span class="history-date">\${new Date(item.created_at).toLocaleString('pt-BR')}</span>
                  \${item.reason ? \`<br><span class="history-reason">"\${item.reason}"</span>\` : ''}
                </div>
              \`).join("");
            }
          }
        } catch (error) {
          console.error("Erro ao carregar histórico:", error);
          historyDiv.innerHTML = "<p>Erro ao carregar histórico.</p>";
        }
      }

      async function addPerson() {
        const nameInput = document.getElementById("newPersonName");
        const name = nameInput.value.trim();

        if (!name) {
          alert("Por favor, insira um nome.");
          return;
        }

        try {
          const response = await fetch(\`\${API_URL}/person\`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
          });

          if (response.ok) {
            // Recarrega a página para mostrar a nova pessoa
            window.location.reload();
          } else {
            alert("Erro ao adicionar pessoa.");
          }
        } catch (error) {
          console.error("Erro ao adicionar pessoa:", error);
          alert("Erro ao adicionar pessoa.");
        }
      }

      // Event listeners para botões de incremento
      document.querySelectorAll(".addBtn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const personId = e.target.dataset.person;
          incrementCount(personId);
        });
      });

      // Event listeners para botões de histórico
      document.querySelectorAll(".history-toggle").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const personId = e.target.dataset.person;
          const historyDiv = document.getElementById(\`history-\${personId}\`);
          
          if (historyDiv.classList.contains("show")) {
            historyDiv.classList.remove("show");
            e.target.textContent = "Ver histórico";
          } else {
            await loadHistory(personId);
            historyDiv.classList.add("show");
            e.target.textContent = "Ocultar histórico";
          }
        });
      });

      // Event listener para adicionar pessoa
      document.getElementById("addPersonBtn").addEventListener("click", addPerson);

      // Permite adicionar pessoa com Enter
      document.getElementById("newPersonName").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          addPerson();
        }
      });

      // Controles de acessibilidade
      let fontLevel = 0; // 0 = normal, 1 = grande, 2 = extra grande

      document.getElementById("increaseFont").addEventListener("click", () => {
        fontLevel = Math.min(2, fontLevel + 1);
        updateFontSize();
      });

      document.getElementById("decreaseFont").addEventListener("click", () => {
        fontLevel = Math.max(0, fontLevel - 1);
        updateFontSize();
      });

      function updateFontSize() {
        document.body.classList.remove("large-text", "extra-large-text");
        if (fontLevel === 1) {
          document.body.classList.add("large-text");
        } else if (fontLevel === 2) {
          document.body.classList.add("extra-large-text");
        }
      }

      document
        .getElementById("toggleContrast")
        .addEventListener("click", () => {
          document.body.classList.toggle("high-contrast");
        });
    </script>
  </body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API endpoint para obter todas as pessoas
    if (url.pathname === "/api/people" && request.method === "GET") {
      try {
        const peopleList = await getPeopleList(env);

        return new Response(JSON.stringify(peopleList), {
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar pessoas" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // API endpoint para adicionar nova pessoa
    if (url.pathname === "/api/person" && request.method === "POST") {
      try {
        const { name } = await request.json();

        if (!name || name.trim() === "") {
          return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const trimmedName = name.trim();

        // Gera ID único baseado no nome e timestamp
        const personId =
          trimmedName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();

        // Verifica se já existe pessoa com mesmo nome
        const existing = await env.DB.prepare(
          "SELECT id FROM people WHERE LOWER(name) = LOWER(?)",
        )
          .bind(trimmedName)
          .first();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "Pessoa com este nome já existe" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          );
        }

        // Adiciona nova pessoa no D1
        await env.DB.prepare("INSERT INTO people (id, name) VALUES (?, ?)")
          .bind(personId, trimmedName)
          .run();

        const newPerson = { id: personId, name: trimmedName, count: 0 };

        return new Response(JSON.stringify(newPerson), {
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao adicionar pessoa" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // API endpoint para incrementar contador de uma pessoa
    if (
      url.pathname.match(/^\/api\/person\/[^\/]+\/increment$/) &&
      request.method === "POST"
    ) {
      try {
        const personId = url.pathname.split("/")[3];

        // Tenta extrair a razão do body
        let reason = "";
        try {
          const body = await request.json();
          reason = body.reason || "";
        } catch (e) {
          // Se não tiver body JSON, apenas continua sem razão
        }

        // Verifica se a pessoa existe
        const person = await env.DB.prepare(
          "SELECT id FROM people WHERE id = ?",
        )
          .bind(personId)
          .first();

        if (!person) {
          return new Response(
            JSON.stringify({ error: "Pessoa não encontrada" }),
            {
              status: 404,
              headers: { "content-type": "application/json" },
            },
          );
        }

        // Adiciona um ponto no histórico (com razão e timestamp)
        await env.DB.prepare(
          "INSERT INTO points_history (person_id, reason) VALUES (?, ?)",
        )
          .bind(personId, reason || null)
          .run();

        // Conta o total de pontos
        const countResult = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM points_history WHERE person_id = ?",
        )
          .bind(personId)
          .first();

        const newCount = countResult?.count || 0;

        return new Response(JSON.stringify({ count: newCount }), {
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao incrementar contador" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // API endpoint para obter histórico de uma pessoa
    if (
      url.pathname.match(/^\/api\/person\/[^\/]+\/history$/) &&
      request.method === "GET"
    ) {
      try {
        const personId = url.pathname.split("/")[3];
        const history = await getPersonHistory(env, personId);

        return new Response(JSON.stringify(history), {
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar histórico" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    // Serve a página principal com todos os contadores
    try {
      // Inicializa o banco de dados se necessário
      await initDatabase(env);

      let peopleList = await getPeopleList(env);

      const html = getHtmlTemplate(peopleList);

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    } catch (error) {
      const html = getHtmlTemplate([]);
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  },
};
