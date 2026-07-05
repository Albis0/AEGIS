// Maintainer tool — read error_reports from Supabase.
// The table is insert-only for clients (RLS); reading requires the
// service_role key, which is NEVER committed — pass it via env:
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/fetch-reports.mjs [--days 7] [--source user|ai]
//
const URL_BASE = process.env.AEGIS_SUPABASE_URL ?? "https://wnpgyalsymoqeengtsbi.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
    console.error("Set SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Settings → API).");
    process.exit(1);
}

const args = process.argv.slice(2);
const days = Number(args[args.indexOf("--days") + 1]) || 7;
const srcIdx = args.indexOf("--source");
const source = srcIdx >= 0 ? args[srcIdx + 1] : null;

const since = new Date(Date.now() - days * 86_400_000).toISOString();
let q = `${URL_BASE}/rest/v1/error_reports?created_at=gte.${since}&order=created_at.desc&limit=200`;
if (source) q += `&source=eq.${source}`;

const res = await fetch(q, {headers: {apikey: KEY, Authorization: `Bearer ${KEY}`}});
if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
}
const rows = await res.json();
console.log(`${rows.length} report(s) in the last ${days} day(s)${source ? ` (source=${source})` : ""}\n`);
const fs = await import("fs");
for (const r of rows) {
    console.log(`── [${r.source}] ${r.created_at}  v${r.app_version || "?"}  user=${String(r.user_id).slice(0, 8)}`);
    console.log(`   ${r.title}`);
    if (r.description) console.log(`   ${r.description.split("\n").join("\n   ")}`);
    const {screenshot, ...ctx} = r.context ?? {};
    if (screenshot) {
        // Data URL → file next to the script, so the image is viewable.
        const m = String(screenshot).match(/^data:image\/(\w+);base64,(.+)$/s);
        if (m) {
            fs.mkdirSync("report-media", {recursive: true});
            const file = `report-media/${r.id}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
            fs.writeFileSync(file, Buffer.from(m[2], "base64"));
            console.log(`   screenshot: ${file}`);
        }
    }
    if (Object.keys(ctx).length) console.log(`   context: ${JSON.stringify(ctx)}`);
    console.log();
}
