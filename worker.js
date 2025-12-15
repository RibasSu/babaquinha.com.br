/**
 * Cloudflare Worker to serve the Babaquinha counter page
 */

// HTML content from index.html
const HTML_CONTENT = `<h1>Contador de Babaquinha</h1>
<br>
<p>Gabriel foi babaquinha: 5 vezes</p>
`;

export default {
  async fetch(request, env, ctx) {
    return new Response(HTML_CONTENT, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  },
};
