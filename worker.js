/**
 * Cloudflare Worker to serve the Babaquinha counter page
 */

const KV_PEOPLE_LIST = "people_list";

/**
 * Busca a lista de pessoas do KV
 */
async function getPeopleList(env) {
  const peopleListJson = await env.babaquinha.get(KV_PEOPLE_LIST);
  return peopleListJson ? JSON.parse(peopleListJson) : [];
}

/**
 * Salva a lista de pessoas no KV
 */
async function savePeopleList(env, peopleList) {
  await env.babaquinha.put(KV_PEOPLE_LIST, JSON.stringify(peopleList));
}

/**
 * Limpa chaves antigas/duplicadas do KV (person_* individuais)
 */
async function cleanupOldKeys(env, peopleList) {
  // Remove chaves individuais antigas que não são mais necessárias
  for (const person of peopleList) {
    try {
      await env.babaquinha.delete(`person_${person.id}`);
    } catch (error) {
      console.error(`Erro ao limpar chave person_${person.id}:`, error);
    }
  }

  // Remove contador legado
  try {
    await env.babaquinha.delete("babaquinha_count");
  } catch (error) {
    console.error("Erro ao limpar chave legada:", error);
  }
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
            <button class="addBtn" data-person="${person.id}">Adicionar +1</button>
          </div>
        `
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
        const currentCount = parseInt(countElement.textContent);

        // Sempre incrementa visualmente
        countElement.textContent = currentCount + 1;

        // Só envia ao servidor se não atingiu o limite
        if (limit.count < 2) {
          try {
            const response = await fetch(\`\${API_URL}/person/\${personId}/increment\`, {
              method: "POST",
            });

            if (response.ok) {
              const data = await response.json();
              // Atualiza com o valor real do servidor
              countElement.textContent = data.count;

              const newLimit = limit.count + 1;
              updateDailyLimit(personId, newLimit);
            }
          } catch (error) {
            console.error("Erro ao incrementar contador:", error);
          }
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
          }
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

        // Gera ID único baseado no nome e timestamp
        const personId =
          name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();

        // Obtém lista atual de pessoas
        const peopleList = await getPeopleList(env);

        // Verifica se já existe pessoa com mesmo nome
        const existingPerson = peopleList.find(
          (p) => p.name.toLowerCase() === name.trim().toLowerCase()
        );

        if (existingPerson) {
          return new Response(
            JSON.stringify({ error: "Pessoa com este nome já existe" }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            }
          );
        }

        // Adiciona nova pessoa
        const newPerson = { id: personId, name: name.trim(), count: 0 };
        peopleList.push(newPerson);

        // Salva lista atualizada (única fonte de verdade)
        await savePeopleList(env, peopleList);

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
          }
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

        // Obtém lista atual
        const peopleList = await getPeopleList(env);

        // Encontra a pessoa
        const personIndex = peopleList.findIndex((p) => p.id === personId);

        if (personIndex === -1) {
          return new Response(
            JSON.stringify({ error: "Pessoa não encontrada" }),
            {
              status: 404,
              headers: { "content-type": "application/json" },
            }
          );
        }

        // Incrementa contador
        peopleList[personIndex].count =
          (peopleList[personIndex].count || 0) + 1;
        const newCount = peopleList[personIndex].count;

        // Salva lista atualizada (única fonte de verdade)
        await savePeopleList(env, peopleList);

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
          }
        );
      }
    }

    // Serve a página principal com todos os contadores
    try {
      let peopleList = await getPeopleList(env);

      // Se não houver ninguém, adiciona Gabriel como padrão
      if (peopleList.length === 0) {
        peopleList = [{ id: "gabriel", name: "Gabriel", count: 0 }];
        await savePeopleList(env, peopleList);
      }

      // Limpa chaves antigas em background (não bloqueia resposta)
      ctx.waitUntil(cleanupOldKeys(env, peopleList));

      const html = getHtmlTemplate(peopleList);

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    } catch (error) {
      const html = getHtmlTemplate([
        { id: "gabriel", name: "Gabriel", count: 0 },
      ]);
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  },
};
