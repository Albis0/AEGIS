// ============================================================================
// Phase 55 — Tool-Selection Eval Cases (labeled, scorable)
//
// Each case: { user, expect, kind }
//   user   - the real user input
//   expect - the CORRECT tool for this input (getAllToolSchemas must offer it +
//            for resolver cases, reference-resolver must produce exactly this)
//   kind   - "offer"    : must be present in the offered-tools list (so the LLM can pick it)
//            "resolver" : the deterministic resolver must produce exactly this tool
//            "negative" : NO tool should be selected for this input (chitchat/greeting)
//   args   - (for resolver/negative) expected arguments (optional)
//   seed   - (resolver cases) prior calls that prime STM beforehand
//
// Scoring: pass/fail binary. Output = tool-selection accuracy %. Below threshold → warning.
// ============================================================================

export const EVAL_CASES = [
  // ── Spotify ────────────────────────────────────────────────────────────
  {user: "Spotify aç",                       expect: "spotify_open",     kind: "offer"},
  {user: "müzik çal",                        expect: "spotify_play",     kind: "offer"},
  {user: "şarkıyı duraklat",                 expect: "spotify_pause",    kind: "offer"},
  {user: "sonraki şarkı",                    expect: "spotify_next",     kind: "offer"},
  {user: "sesi 40 yap",                      expect: "spotify_volume",   kind: "offer"},
  {user: "şu an ne çalıyor",                 expect: "spotify_now_playing", kind: "offer"},

  // ── Steam ──────────────────────────────────────────────────────────────
  {user: "CS2 oyununu başlat",               expect: "steam_launch",     kind: "offer"},
  {user: "steam oyunlarımı listele",         expect: "steam_list",       kind: "offer"},

  // ── File ───────────────────────────────────────────────────────────────
  {user: "masaüstüne not.txt dosyası oluştur", expect: "write_file",     kind: "offer"},
  {user: "not.txt dosyasını oku",            expect: "read_file",        kind: "offer"},
  {user: "şu dosyayı sil",                   expect: "delete_file",      kind: "offer"},
  {user: "klasördeki dosyaları listele",     expect: "list_directory",   kind: "offer"},

  // ── System ─────────────────────────────────────────────────────────────
  {user: "ekran parlaklığını 70 yap",        expect: "set_brightness",   kind: "offer"},
  {user: "sistem sesini 30 yap",             expect: "set_volume",       kind: "offer"},
  {user: "ekran görüntüsü al",               expect: "screenshot",       kind: "offer"},
  {user: "panoya kopyaladığımı oku",         expect: "read_clipboard",   kind: "offer"},
  {user: "cpu kullanımı ne durumda",         expect: "system_report",    kind: "offer"},

  // ── Web & knowledge ──────────────────────────────────────────────────────
  {user: "internette react hooks ara",       expect: "web_search",       kind: "offer"},
  {user: "şu siteyi özetle https://x.com",   expect: "fetch_url",        kind: "offer"},
  {user: "bugün hava nasıl",                 expect: "weather_station",  kind: "offer"},

  // ── Memory & profile ─────────────────────────────────────────────────────
  {user: "şunu hatırla: doğum günüm 5 mayıs", expect: "remember_fact",   kind: "offer"},
  {user: "kaydettiğim bilgileri göster",     expect: "list_facts",       kind: "offer"},
  {user: "bana not al: süt almayı unutma",   expect: "save_note",        kind: "offer"},

  // ── Network ────────────────────────────────────────────────────────────
  {user: "google.com'a ping at",             expect: "ping_host",        kind: "offer"},
  {user: "ağdaki cihazları tara",            expect: "local_devices_scan", kind: "offer"},

  // ── Git & development ────────────────────────────────────────────────────
  {user: "git durumunu göster",              expect: "git_status",       kind: "offer"},
  {user: "son commitleri göster",            expect: "git_log",          kind: "offer"},

  // ── Smart home ────────────────────────────────────────────────────────────
  {user: "salonun ışığını aç",               expect: "smart_home_control", kind: "offer"},
  {user: "evdeki cihazları göster",          expect: "smart_home_devices", kind: "offer"},

  // ── Time & reminders ──────────────────────────────────────────────────────
  {user: "10 dakika sonra hatırlat",         expect: "remind_in",        kind: "offer"},
  {user: "pomodoro başlat",                  expect: "pomodoro_start",   kind: "offer"},

  // ── Email ────────────────────────────────────────────────────────────────
  {user: "e-posta gönder",                   expect: "email_send",       kind: "offer"},

  // ── Notification ─────────────────────────────────────────────────────────
  {user: "bildirim göster başlık merhaba",   expect: "show_notification", kind: "offer"},

  // ── Resolver cases (deterministic, no LLM) ──────────────────────────────
  {
    user: "onu tekrar yap", expect: "spotify_volume", kind: "resolver", args: {level: 50},
    seed: [{tool: "spotify_volume", args: {level: 50}, result: "OK"}],
  },
  {
    user: "biraz azalt", expect: "spotify_volume", kind: "resolver", args: {level: "40"},
    seed: [{tool: "spotify_volume", args: {level: 45}, result: "OK"}],
  },
  {
    user: "az önce yaptığını tekrarla", expect: "spotify_pause", kind: "resolver", args: {},
    seed: [{tool: "spotify_pause", args: {}, result: "OK"}],
  },

  // ── Negative cases (no tool should be selected — pure chitchat) ─────────
  {user: "merhaba nasılsın",                 expect: null,               kind: "negative"},
  {user: "teşekkür ederim",                  expect: null,               kind: "negative"},
  {user: "bana bir fıkra anlat",             expect: null,               kind: "negative"},
  {user: "Fransa'nın başkenti neresi",       expect: null,               kind: "negative"},
];
