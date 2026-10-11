// Yerel test için tüm Edge Function'ları tek Deno sürecinde çalıştırır:
// /<fonksiyon-adı> isteği o fonksiyonun Deno.serve işleyicisine gider.
// SADECE yerel geliştirme ve test içindir.
type Handler = (req: Request) => Response | Promise<Response>;

const names = Deno.args.length ? Deno.args : ['parse-document', 'generate-itinerary', 'replan', 'places', 'translate', 'travel-info', 'trip-report'];
const handlers: Record<string, Handler> = {};
const realServe = Deno.serve.bind(Deno);
let current = '';

// Fonksiyon dosyaları import edilirken Deno.serve'ü çağırır; işleyiciyi yakalıyoruz.
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (handler: Handler) => {
  handlers[current] = handler;
  return { finished: Promise.resolve(), shutdown: () => Promise.resolve() };
};
for (const name of names) {
  current = name;
  await import(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url).href);
}

const port = Number(Deno.env.get('FUNCTIONS_PORT') ?? 8000);
realServe({ port, onListen: () => console.log(`functions on :${port} → ${names.join(', ')}`) }, (req) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean)[0] ?? '';
  const handler = handlers[name];
  return handler ? handler(req) : new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 });
});
