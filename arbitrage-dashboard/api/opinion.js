/**
 * Vercel Serverless Function - Opinion API Proxy
 * Proxies requests to Opinion API with API key from environment
 */

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);

  // Extract the path after /api/opinion/
  const pathMatch = url.pathname.match(/^\/api\/opinion\/?(.*)/);
  const apiPath = pathMatch ? pathMatch[1] : '';

  // Build target URL
  const targetUrl = new URL(`https://proxy.opinion.trade:8443/openapi/${apiPath}`);

  // Copy query parameters
  url.searchParams.forEach((value, key) => {
    if (key !== 'path') {
      targetUrl.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers: {
        'apikey': process.env.OPINION_API_KEY || '',
        'Content-Type': 'application/json',
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
