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
    
    CREATE TABLE IF NOT EXISTS site_stats (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );
  `);
}

/**
 * Incrementa e retorna o contador de visitas
 */
async function incrementVisitorCount(env) {
  // Tenta incrementar o contador existente
  await env.DB.prepare(
    "INSERT INTO site_stats (key, value) VALUES ('visitor_count', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1",
  ).run();

  const result = await env.DB.prepare(
    "SELECT value FROM site_stats WHERE key = 'visitor_count'",
  ).first();

  return result?.value || 1;
}

/**
 * Apenas retorna o contador de visitas sem incrementar
 */
async function getVisitorCount(env) {
  const result = await env.DB.prepare(
    "SELECT value FROM site_stats WHERE key = 'visitor_count'",
  ).first();

  return result?.value || 0;
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

function getHtmlTemplate(people, visitorCount = 0) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Contador de Babaquinha</title>
    <style>
      * {
        box-sizing: border-box;
      }

      :root {
        --font-size: 1em;
      }

      body.large-text {
        --font-size: 1.3em;
      }

      body.extra-large-text {
        --font-size: 1.6em;
      }

      body {
        font-size: var(--font-size);
        font-family: 'Comic Sans MS', 'Chalkboard', cursive, sans-serif;
        background: #000080;
        background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffff00' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        color: #ffff00;
        margin: 0;
        padding: 0;
      }

      body.high-contrast {
        background: #000;
        background-image: none;
        color: #fff;
      }

      body.high-contrast button {
        background: #fff;
        color: #000;
      }

      #accessibility-bar {
        position: fixed;
        top: 0;
        right: 0;
        background: #c0c0c0;
        padding: 4px;
        border: 2px outset #fff;
        z-index: 1000;
      }

      #accessibility-bar button {
        padding: 4px 8px;
        cursor: pointer;
        background: #c0c0c0;
        border: 2px outset #fff;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        font-size: 11px;
        margin: 2px;
      }

      #accessibility-bar button:active {
        border-style: inset;
      }

      main {
        max-width: 700px;
        margin: 0 auto;
        padding: 20px 10px;
      }

      h1 {
        text-align: center;
        font-size: 2em;
        color: #ff00ff;
        text-shadow: 2px 2px #00ffff, -1px -1px #ff0000;
        margin: 20px 0;
        animation: blink 1s steps(1) infinite;
      }

      @keyframes blink {
        50% { opacity: 0.5; }
      }

      .marquee-text {
        background: #ff0000;
        color: #ffff00;
        padding: 5px;
        font-weight: bold;
        text-align: center;
        margin-bottom: 20px;
        border: 3px ridge #ffff00;
      }

      .person-card {
        background: #008080;
        border: 3px ridge #c0c0c0;
        padding: 10px;
        margin: 15px 0;
      }

      .person-card h2 {
        margin: 0 0 10px 0;
        font-size: 1.3em;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        text-shadow: 1px 1px #000;
      }

      .person-card .count {
        font-weight: bold;
        color: #00ff00;
        font-size: 1.4em;
        text-shadow: 1px 1px #000;
      }

      .add-person-form {
        background: #800080;
        margin: 20px 0;
        padding: 15px;
        border: 3px ridge #ff00ff;
      }

      .add-person-form h2 {
        margin: 0 0 10px 0;
        font-size: 1.1em;
        color: #ffffff;
      }

      .add-person-form .form-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .add-person-form input {
        flex: 1;
        min-width: 150px;
        padding: 6px;
        font-size: 1em;
        border: 2px inset #c0c0c0;
        font-family: 'Times New Roman', serif;
      }

      .add-person-form button {
        padding: 6px 15px;
        cursor: pointer;
        background: #c0c0c0;
        border: 2px outset #fff;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        font-weight: bold;
      }

      .add-person-form button:active {
        border-style: inset;
      }

      .add-point-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
      }

      .add-point-form input[type="text"] {
        padding: 6px;
        font-size: 0.9em;
        border: 2px inset #c0c0c0;
        font-family: 'Times New Roman', serif;
        width: 100%;
      }

      .add-point-form button {
        padding: 6px 15px;
        cursor: pointer;
        background: #00ff00;
        border: 2px outset #fff;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        font-weight: bold;
        color: #000;
        align-self: flex-start;
      }

      .add-point-form button:active {
        border-style: inset;
      }

      .history-toggle {
        background: none;
        border: none;
        color: #00ffff;
        cursor: pointer;
        font-size: 0.9em;
        padding: 8px 0;
        text-decoration: underline;
      }

      .history-toggle:hover {
        color: #ff00ff;
      }

      .history-list {
        display: none;
        margin-top: 10px;
        padding: 10px;
        background: #000080;
        border: 2px inset #c0c0c0;
        max-height: 200px;
        overflow-y: auto;
      }

      .history-list.show {
        display: block;
      }

      .history-item {
        padding: 5px 0;
        border-bottom: 1px dashed #00ffff;
        font-size: 0.85em;
        color: #ffffff;
      }

      .history-item:last-child {
        border-bottom: none;
      }

      .history-date {
        color: #00ff00;
        font-size: 0.85em;
        font-family: 'Courier New', monospace;
      }

      .history-reason {
        font-style: italic;
        color: #ffff00;
        margin-top: 2px;
      }

      .under-construction {
        text-align: center;
        margin-top: 30px;
        font-size: 0.8em;
        color: #00ffff;
      }

      .under-construction img {
        vertical-align: middle;
      }

      .visitor-counter {
        text-align: center;
        margin-top: 20px;
        font-family: 'Courier New', monospace;
        color: #00ff00;
        background: #000;
        display: inline-block;
        padding: 5px 10px;
        border: 2px ridge #00ff00;
      }

      .guestbook-link {
        text-align: center;
        margin-top: 15px;
      }

      .guestbook-link a {
        color: #ff00ff;
        font-size: 1.1em;
      }

      hr {
        border: none;
        height: 3px;
        background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff);
        margin: 20px 0;
      }

      /* Media queries para responsividade */
      @media (max-width: 600px) {
        main {
          padding: 15px 8px;
        }

        h1 {
          font-size: 1.5em;
        }

        .person-card {
          padding: 10px;
        }

        .person-card h2 {
          font-size: 1.1em;
        }

        .add-person-form .form-row {
          flex-direction: column;
        }

        .add-person-form input {
          min-width: 100%;
        }

        .add-person-form button {
          width: 100%;
        }

        .add-point-form button {
          width: 100%;
          align-self: stretch;
        }
      }

      @media (min-width: 601px) {
        .add-point-form {
          flex-direction: row;
          align-items: center;
        }

        .add-point-form input[type="text"] {
          flex: 1;
        }

        .add-point-form button {
          flex-shrink: 0;
        }
      }

      /* Modal de Ajuda */
      .help-btn {
        display: inline-block;
        width: 30px;
        height: 30px;
        background: #ffff00;
        color: #000080;
        border: 3px outset #fff;
        border-radius: 50%;
        font-weight: bold;
        font-size: 18px;
        cursor: pointer;
        font-family: 'Times New Roman', serif;
        vertical-align: middle;
        margin-left: 10px;
        line-height: 24px;
        text-align: center;
      }

      .help-btn:hover {
        background: #00ffff;
      }

      .help-btn:active {
        border-style: inset;
      }

      .modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 128, 0.8);
        z-index: 2000;
        justify-content: center;
        align-items: center;
        padding: 20px;
      }

      .modal-overlay.show {
        display: flex;
      }

      .modal-window {
        background: #c0c0c0;
        border: 3px outset #fff;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .modal-titlebar {
        background: linear-gradient(to right, #000080, #1084d0);
        color: #fff;
        padding: 4px 8px;
        font-weight: bold;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        font-size: 13px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }

      .modal-close {
        background: #c0c0c0;
        border: 2px outset #fff;
        width: 20px;
        height: 20px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        line-height: 14px;
      }

      .modal-close:active {
        border-style: inset;
      }

      .modal-content {
        padding: 15px;
        color: #000;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .modal-content h3 {
        color: #800080;
        margin: 15px 0 8px 0;
        font-size: 14px;
        border-bottom: 1px solid #808080;
        padding-bottom: 3px;
      }

      .modal-content h3:first-child {
        margin-top: 0;
      }

      .modal-content p {
        margin: 8px 0;
      }

      .modal-content ul {
        margin: 8px 0;
        padding-left: 25px;
      }

      .modal-content li {
        margin: 4px 0;
      }

      .modal-content .destaque {
        background: #ffff00;
        padding: 2px 4px;
        font-weight: bold;
      }

      .modal-content .aviso {
        background: #ff0000;
        color: #fff;
        padding: 8px;
        margin: 10px 0;
        text-align: center;
        border: 2px inset #800000;
      }

      .modal-footer {
        background: #c0c0c0;
        padding: 10px;
        text-align: center;
        border-top: 1px solid #808080;
        flex-shrink: 0;
      }

      .modal-footer button {
        background: #c0c0c0;
        border: 2px outset #fff;
        padding: 5px 25px;
        font-family: 'MS Sans Serif', Arial, sans-serif;
        cursor: pointer;
      }

      .modal-footer button:active {
        border-style: inset;
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
      <div class="marquee-text">
        ★★★ BEM-VINDO AO CONTADOR DE BABAQUINHA!!! ★★★
        <br> ★★★ DESDE 2025 ★★★
      </div>
      
      <h1>~*~ Contador de Babaquinha ~*~ <button class="help-btn" id="helpBtn" title="O que é isso?">?</button></h1>
      
      <hr>
      
      <div class="add-person-form">
        <h2>:: Adicionar Nova Pessoa ::</h2>
        <div class="form-row">
          <input type="text" id="newPersonName" placeholder="Digite o nome aqui..." />
          <button id="addPersonBtn">Adicionar Pessoa</button>
        </div>
      </div>

      <div id="peopleList">
        ${people
          .map(
            (person) => `
          <div class="person-card">
            <h2>
              ${person.name}
              <span class="count" data-person="${person.id}" role="status" aria-live="polite">${person.count} pts</span>
            </h2>
            <div class="add-point-form">
              <input type="text" class="reason-input" data-person="${person.id}" placeholder="Por que está adicionando ponto? (opcional)" />
              <button class="addBtn" data-person="${person.id}">+1 Babaquinha!!</button>
            </div>
            <button class="history-toggle" data-person="${person.id}">[+] Ver histórico</button>
            <div class="history-list" id="history-${person.id}">
              <p>Carregando histórico...</p>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      
      <hr>
      
      <div class="under-construction">
        <p>[!] Site em eterna construção [!]</p>
      </div>
      
      <div style="text-align: center;">
        <div class="visitor-counter">
          Visitante n° ${visitorCount.toString().padStart(6, "0")}
        </div>
      </div>
      
      <div class="guestbook-link">
        <p>[>>] <a href="mailto:andre@ribassu.com">Contato do Webmaster</a> [<<]</p>
      </div>
      
    </main>

    <!-- Modal de Alerta -->
    <div class="modal-overlay" id="alertModal">
      <div class="modal-window" style="max-width: 350px;">
        <div class="modal-titlebar">
          <span id="alertTitle">[i] Aviso</span>
          <button class="modal-close" id="closeAlertModal">X</button>
        </div>
        <div class="modal-content" style="text-align: center;">
          <div id="alertIcon" style="font-size: 32px; margin-bottom: 10px;">[!]</div>
          <p id="alertMessage">Mensagem</p>
        </div>
        <div class="modal-footer">
          <button id="alertOkBtn">OK</button>
        </div>
      </div>
    </div>

    <!-- Modal de Ajuda -->
    <div class="modal-overlay" id="helpModal">
      <div class="modal-window">
        <div class="modal-titlebar">
          <span>[?] Ajuda - Babaquinha.exe</span>
          <button class="modal-close" id="closeModal">X</button>
        </div>
        <div class="modal-content">
          <h3>[i] O que é o Babaquinha?</h3>
          <p>O <span class="destaque">Contador de Babaquinha</span> é um sistema altamente sofisticado de monitoramento comportamental interpessoal, desenvolvido com tecnologia de ponta para rastrear e quantificar momentos de babaquice.</p>
          
          <h3>[*] Para quem é?</h3>
          <p>Este sistema foi projetado para:</p>
          <ul>
            <li>Grupos de amigos que precisam de accountability</li>
            <li>Famílias com membros que "às vezes" passam dos limites</li>
            <li>Escritórios onde certas pessoas merecem ser expostas (com amor)</li>
            <li>Qualquer ambiente onde a babaquice precisa ser documentada para a posteridade</li>
          </ul>
          
          <h3>[#] Como funciona?</h3>
          <p>O processo é extremamente simples e cientificamente comprovado*:</p>
          <ul>
            <li><strong>1.</strong> Adicione o nome do babaquinha em potencial</li>
            <li><strong>2.</strong> Quando a pessoa fizer jus ao título, clique em "+1 Babaquinha!!"</li>
            <li><strong>3.</strong> Opcionalmente, registre o motivo para futuras consultas e constrangimentos</li>
            <li><strong>4.</strong> Acompanhe o ranking em tempo real</li>
          </ul>
          <p style="font-size: 10px;">*Não há comprovação científica alguma.</p>
          
          <h3>[>] Por que foi criado?</h3>
          <p>Este projeto nasceu da necessidade urgente de documentar, de forma oficial e irrefutável, quem são os verdadeiros babaquinhas do grupo. Chega de discussões do tipo "você fez isso" / "não fiz não" - agora temos <strong>DADOS</strong>.</p>
          
          <p>O sistema mantém um histórico completo com data, hora e motivo de cada ponto adicionado, garantindo total transparência e possibilitando futuras sessões de constrangimento público.</p>
          
          <div class="aviso">
            /!\\ AVISO LEGAL: Use com responsabilidade. O desenvolvedor não se responsabiliza por amizades destruídas, brigas familiares ou demissões resultantes do uso deste sistema.
          </div>
          
          <h3>[=] Limite Diário</h3>
          <p>Para evitar abusos e guerras nucleares, cada usuário pode adicionar no máximo <span class="destaque">2 pontos por dia</span> para cada pessoa. Isso garante que apenas os momentos realmente memoráveis sejam registrados.</p>
        </div>
        <div class="modal-footer">
          <button id="closeModalBtn">OK, Entendi!</button>
        </div>
      </div>
    </div>

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

      // Função para mostrar alertas customizados
      function showAlert(message, type = 'info') {
        const alertModal = document.getElementById('alertModal');
        const alertTitle = document.getElementById('alertTitle');
        const alertIcon = document.getElementById('alertIcon');
        const alertMessage = document.getElementById('alertMessage');
        
        alertMessage.textContent = message;
        
        switch(type) {
          case 'error':
            alertTitle.textContent = '[X] Erro';
            alertIcon.textContent = '[X]';
            alertIcon.style.color = '#ff0000';
            break;
          case 'success':
            alertTitle.textContent = '[+] Sucesso';
            alertIcon.textContent = '[OK]';
            alertIcon.style.color = '#00ff00';
            break;
          case 'warning':
            alertTitle.textContent = '[!] Atenção';
            alertIcon.textContent = '/!\\\\';
            alertIcon.style.color = '#ffff00';
            break;
          default:
            alertTitle.textContent = '[i] Aviso';
            alertIcon.textContent = '[i]';
            alertIcon.style.color = '#00ffff';
        }
        
        alertModal.classList.add('show');
      }

      // Fecha modal de alerta
      document.getElementById('closeAlertModal').addEventListener('click', () => {
        document.getElementById('alertModal').classList.remove('show');
      });
      
      document.getElementById('alertOkBtn').addEventListener('click', () => {
        document.getElementById('alertModal').classList.remove('show');
      });
      
      document.getElementById('alertModal').addEventListener('click', (e) => {
        if (e.target.id === 'alertModal') {
          document.getElementById('alertModal').classList.remove('show');
        }
      });

      // Modal de Ajuda
      const helpBtn = document.getElementById('helpBtn');
      const helpModal = document.getElementById('helpModal');
      const closeModal = document.getElementById('closeModal');
      const closeModalBtn = document.getElementById('closeModalBtn');

      helpBtn.addEventListener('click', () => {
        helpModal.classList.add('show');
      });

      closeModal.addEventListener('click', () => {
        helpModal.classList.remove('show');
      });

      closeModalBtn.addEventListener('click', () => {
        helpModal.classList.remove('show');
      });

      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
          helpModal.classList.remove('show');
        }
      });

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
        countElement.textContent = (currentCount + 1) + " pts";

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
              countElement.textContent = data.count + " pts";

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
              historyDiv.innerHTML = history.map(item => {
                // Adiciona 'Z' para indicar UTC e converter para Brasília
                const date = new Date(item.created_at + 'Z');
                const formattedDate = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                return \`
                <div class="history-item">
                  <span class="history-date">\${formattedDate}</span>
                  \${item.reason ? \`<br><span class="history-reason">"\${item.reason}"</span>\` : ''}
                </div>
              \`;
              }).join("");
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
          showAlert("Por favor, insira um nome.", "warning");
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
            showAlert("Erro ao adicionar pessoa.", "error");
          }
        } catch (error) {
          console.error("Erro ao adicionar pessoa:", error);
          showAlert("Erro ao adicionar pessoa.", "error");
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
            e.target.textContent = "[+] Ver histórico";
          } else {
            await loadHistory(personId);
            historyDiv.classList.add("show");
            e.target.textContent = "[-] Ocultar histórico";
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
      let peopleList = await getPeopleList(env);

      // Verifica se o visitante já foi contado (cookie)
      const cookies = request.headers.get("Cookie") || "";
      const hasVisited = cookies.includes("babaquinha_visited=1");

      let visitorCount;
      let setCookieHeader = null;

      if (!hasVisited) {
        // Novo visitante: incrementa e define cookie
        visitorCount = await incrementVisitorCount(env);
        // Cookie expira em 24 horas
        setCookieHeader =
          "babaquinha_visited=1; Path=/; Max-Age=86400; SameSite=Lax";
      } else {
        // Visitante já contado: apenas lê o contador
        visitorCount = await getVisitorCount(env);
      }

      const html = getHtmlTemplate(peopleList, visitorCount);

      const headers = {
        "content-type": "text/html;charset=UTF-8",
      };

      if (setCookieHeader) {
        headers["Set-Cookie"] = setCookieHeader;
      }

      return new Response(html, { headers });
    } catch (error) {
      console.error("Erro ao carregar página:", error);
      const html = getHtmlTemplate([], 0);
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  },
};
