/**
 * Cloudflare Worker to serve the Babaquinha counter page
 */

import indexHtml from './index.html';

const KV_KEY = 'babaquinha_count';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // API endpoint para obter o contador
    if (url.pathname === '/api/count' && request.method === 'GET') {
      try {
        const count = await env.babaquinha.get(KV_KEY);
        return new Response(JSON.stringify({ count: parseInt(count) || 0 }), {
          headers: {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro ao buscar contador' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    
    // API endpoint para incrementar o contador
    if (url.pathname === '/api/count' && request.method === 'POST') {
      try {
        const currentCount = await env.babaquinha.get(KV_KEY);
        const newCount = (parseInt(currentCount) || 0) + 1;
        await env.babaquinha.put(KV_KEY, newCount.toString());
        
        return new Response(JSON.stringify({ count: newCount }), {
          headers: {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Erro ao incrementar contador' }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    
    // Serve a página principal
    return new Response(indexHtml, {
      headers: {
        'content-type': 'text/html;charset=UTF-8',
      },
    });
  },
};
