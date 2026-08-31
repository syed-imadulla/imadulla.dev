export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/global_scores?id=eq.1&select=high_score`;

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  try {
    if (req.method === 'GET') {
      const response = await fetch(endpoint, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`Supabase GET error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (!data || data.length === 0) {
        return new Response(JSON.stringify({ high_score: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ high_score: data[0].high_score }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const newScore = body.score;

      if (typeof newScore !== 'number' || newScore < 0 || newScore > 10000 || !Number.isInteger(newScore)) {
        return new Response(JSON.stringify({ error: 'Invalid score' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const rpcEndpoint = `${SUPABASE_URL}/rest/v1/rpc/update_global_high_score`;
      const updateRes = await fetch(rpcEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ new_score: newScore })
      });
      
      if (!updateRes.ok) {
        throw new Error(`Supabase RPC error: ${updateRes.status} ${updateRes.statusText}`);
      }
      
      const resultingHighScore = await updateRes.json();
      
      return new Response(JSON.stringify({ high_score: resultingHighScore }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST' },
    });
  } catch (err: unknown) {
    console.error('Highscore API error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
