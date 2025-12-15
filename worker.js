/**
 * Cloudflare Worker to serve the Babaquinha counter page
 */

const KV_KEY = "babaquinha_count";

function getHtmlTemplate(count) {
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
      <p id="contador" role="status" aria-live="polite">
        Gabriel foi babaquinha: <span id="count">${count}</span> vezes
      </p>
      <button id="addBtn">Adicionar +1</button>
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
      const API_URL = "/api/count";

      // Verifica quantas vezes o usuário já adicionou hoje
      function checkDailyLimit() {
        const today = new Date().toDateString();
        const data = localStorage.getItem("babaquinha_limit");

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

      function updateDailyLimit(count) {
        const today = new Date().toDateString();
        localStorage.setItem(
          "babaquinha_limit",
          JSON.stringify({
            count: count,
            date: today,
          })
        );
      }

      async function incrementCount() {
        const limit = checkDailyLimit();
        const countElement = document.getElementById("count");
        const currentCount = parseInt(countElement.textContent);

        // Sempre incrementa visualmente
        countElement.textContent = currentCount + 1;

        // Só envia ao servidor se não atingiu o limite
        if (limit.count < 2) {
          try {
            const response = await fetch(API_URL, {
              method: "POST",
            });

            if (response.ok) {
              const data = await response.json();
              // Atualiza com o valor real do servidor
              countElement.textContent = data.count;

              const newLimit = limit.count + 1;
              updateDailyLimit(newLimit);
            }
          } catch (error) {
            console.error("Erro ao incrementar contador:", error);
          }
        }
      }

      document
        .getElementById("addBtn")
        .addEventListener("click", incrementCount);

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

    // API endpoint para obter o contador
    if (url.pathname === "/api/count" && request.method === "GET") {
      try {
        const count = await env.babaquinha.get(KV_KEY);
        return new Response(JSON.stringify({ count: parseInt(count) || 0 }), {
          headers: {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar contador" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          }
        );
      }
    }

    // API endpoint para incrementar o contador
    if (url.pathname === "/api/count" && request.method === "POST") {
      try {
        const currentCount = await env.babaquinha.get(KV_KEY);
        const newCount = (parseInt(currentCount) || 0) + 1;
        await env.babaquinha.put(KV_KEY, newCount.toString());

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

    // Serve a página principal com o contador já renderizado
    try {
      const count = await env.babaquinha.get(KV_KEY);
      const html = getHtmlTemplate(parseInt(count) || 0);
      
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    } catch (error) {
      const html = getHtmlTemplate(0);
      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
        },
      });
    }
  },
};
