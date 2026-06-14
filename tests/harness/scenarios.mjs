// ============================================================================
// 55 multi-step conversation scenarios for the deterministic harness.
//
// Each step:
//   user        - the user's message (drives real getAllToolSchemas selection)
//   intent      - human label
//   tool        - the tool the assistant SHOULD select (asserted to be OFFERED)
//   args        - the args the assistant SHOULD produce (after reference resolution)
//   ref         - (optional) string(s) that MUST appear in the injected STM block
//                 before this step — proves the reference target is available
//   expectSTM   - (optional) asserted STM snapshot fields after stmRecord
//   expectResult- (optional) regex the tool result must match
//   mockResult  - (optional) result to record for non-safe-to-execute tools
//
// seed (scenario-level) - prior tool calls to prime STM (simulate earlier turns)
// ============================================================================

export const SCENARIOS = [
  // ── 1. The canonical example from the brief ──────────────────────────────
  {
    name: "Spotify aç → ses 50 → biraz azalt → tekrar yap",
    steps: [
      {user: "Spotify aç", intent: "Spotify aç", tool: "spotify_open", args: {}, expectSTM: {lastTool: "spotify_open"}},
      {user: "Sesini 50 yap", intent: "ses ayarla", tool: "spotify_volume", args: {level: 50}, expectSTM: {lastTool: "spotify_volume"}},
      {user: "biraz azalt", intent: "sesi azalt (referans)", tool: "spotify_volume", args: {level: 35}, ref: "spotify_volume(level=50)", expectSTM: {lastTool: "spotify_volume"}},
      {user: "az önce yaptığını tekrar yap", intent: "son işlemi tekrarla", tool: "spotify_volume", args: {level: 35}, ref: "spotify_volume"},
    ],
  },
  // ── 2. Volume up/down chain ──────────────────────────────────────────────
  {
    name: "Müzik çal → sesi artır → biraz daha → çok oldu azalt",
    steps: [
      {user: "müzik çal", intent: "çal", tool: "spotify_play", args: {}, expectSTM: {lastTool: "spotify_play"}},
      {user: "sesi artır", intent: "ses artır", tool: "spotify_volume", args: {level: 70}},
      {user: "biraz daha artır", intent: "ses artır (ref)", tool: "spotify_volume", args: {level: 85}, ref: "spotify_volume(level=70)"},
      {user: "çok oldu biraz azalt", intent: "ses azalt (ref)", tool: "spotify_volume", args: {level: 70}, ref: "spotify_volume"},
    ],
  },
  // ── 3. Steam game by full name ───────────────────────────────────────────
  {
    name: "Dead by Daylight oyununu aç → kapat → tekrar aç",
    steps: [
      // Gerçek kullanım: kullanıcı oyun adıyla birlikte "oyun" der ya da bağlam steam'dir.
      {user: "Dead by Daylight oyununu aç", intent: "oyun başlat", tool: "steam_launch", args: {game: "Dead by Daylight"}, mockResult: "Başlatıldı: Dead by Daylight"},
      {user: "oyunu kapat", intent: "oyun kapat", tool: "steam_close", args: {}, ref: "steam_launch", mockResult: "Steam kapatıldı"},
      {user: "az önce açtığım oyunu tekrar aç", intent: "tekrar başlat (ref)", tool: "steam_launch", args: {game: "Dead by Daylight"}, ref: "steam_launch", mockResult: "Başlatıldı"},
    ],
  },
  // ── 4. Cyberpunk başlat ──────────────────────────────────────────────────
  {
    name: "Cyberpunk oyununu başlat → çalışan oyun?",
    steps: [
      {user: "Cyberpunk oyununu başlat", intent: "oyun başlat", tool: "steam_launch", args: {game: "Cyberpunk 2077"}, mockResult: "Başlatıldı"},
      {user: "şu an hangi oyun çalışıyor", intent: "çalışan oyun", tool: "steam_game_running", args: {}},
    ],
  },
  // ── 5. Brightness ────────────────────────────────────────────────────────
  {
    name: "Parlaklığı arttır → biraz daha → yarıya indir",
    steps: [
      {user: "parlaklığı arttır", intent: "parlaklık artır", tool: "set_brightness", args: {level: 80}, mockResult: "Parlaklık %80"},
      {user: "biraz daha", intent: "parlaklık artır (ref)", tool: "set_brightness", args: {level: 100}, ref: "set_brightness"},
      {user: "yarıya indir", intent: "parlaklık azalt (ref)", tool: "set_brightness", args: {level: 50}, ref: "set_brightness", mockResult: "Parlaklık %50"},
    ],
  },
  // ── 6. Spotify search + play + like ──────────────────────────────────────
  {
    name: "Şarkı ara çal → beğen → sıraya ekle",
    steps: [
      {user: "Tarkan Kuzu Kuzu çal", intent: "ara ve çal", tool: "spotify_search", args: {query: "Tarkan Kuzu Kuzu"}, mockResult: "Çalınıyor: Kuzu Kuzu"},
      {user: "bu şarkıyı beğen", intent: "beğen (ref)", tool: "spotify_like", args: {}, ref: "spotify_search"},
      {user: "sıraya bir şarkı daha ekle", intent: "kuyruğa ekle", tool: "spotify_queue", args: {uri: "spotify:track:abc"}, expectSTM: {lastSpotifyTrack: "spotify:track:abc"}},
    ],
  },
  // ── 7. Now playing → audio features ──────────────────────────────────────
  {
    name: "Ne çalıyor → bu şarkının özellikleri",
    steps: [
      {user: "şu an ne çalıyor", intent: "now playing", tool: "spotify_now_playing", args: {}},
      {user: "bu şarkının tempo ve enerjisi ne", intent: "audio features (ref)", tool: "spotify_audio_features", args: {id: "track123"}, ref: "spotify_now_playing"},
    ],
  },
  // ── 8. Next/prev navigation ──────────────────────────────────────────────
  {
    name: "Çal → sonraki → önceki → tekrar sonraki",
    steps: [
      {user: "spotify çal", intent: "çal", tool: "spotify_play", args: {}},
      {user: "sonraki şarkı", intent: "next", tool: "spotify_next", args: {}, expectSTM: {lastTool: "spotify_next"}},
      {user: "önceki şarkıya dön", intent: "prev", tool: "spotify_prev", args: {}},
      {user: "yine sonrakine geç", intent: "next (ref)", tool: "spotify_next", args: {}, ref: "spotify_next"},
    ],
  },
  // ── 9. Shuffle + repeat ──────────────────────────────────────────────────
  {
    name: "Karıştır aç → tekrar moduna al → karıştırmayı kapat",
    steps: [
      {user: "karıştır", intent: "shuffle on", tool: "spotify_shuffle", args: {state: "true"}},
      {user: "tekrar moduna al", intent: "repeat", tool: "spotify_repeat", args: {state: "context"}},
      {user: "karıştırmayı kapat", intent: "shuffle off (ref)", tool: "spotify_shuffle", args: {state: "false"}, ref: "spotify_shuffle"},
    ],
  },
  // ── 10. File create → read → delete (guarded) ────────────────────────────
  {
    name: "Dosya oluştur → oku → sil",
    steps: [
      {user: "masaüstüne notlar.txt diye dosya oluştur içine merhaba yaz", intent: "dosya yaz", tool: "write_file", args: {path: "~/Desktop/notlar.txt", content: "merhaba"}, mockResult: "Yazıldı"},
      {user: "az önce oluşturduğun dosyayı oku", intent: "oku (ref)", tool: "read_file", args: {path: "~/Desktop/notlar.txt"}, ref: "write_file", mockResult: "merhaba"},
      {user: "o dosyayı sil", intent: "sil (ref)", tool: "delete_file", args: {path: "~/Desktop/notlar.txt"}, ref: "write_file", expectResult: /ENGELLENDI|Silindi|HATA/},
    ],
  },
];

// ── Bulk-generated single/double-step scenarios to reach 50+ ───────────────
// Each is a realistic standalone or short chain; keeps coverage broad.
const MORE = [
  ["Pomodoro başlat", "pomodoro_start", {}, "pomodoro"],
  ["pomodoroyu durdur", "pomodoro_stop", {}, null],
  ["bir şeyi hatırlat: 5 dakika sonra su iç", "schedule_task", {when: "5 dakika sonra", what: "su iç"}, "hatirlat"],
  ["zamanlanmış görevleri listele", "list_scheduled_tasks", {}, null],
  ["beni Ahmet olarak tanı", "remember_fact", {fact: "kullanıcı adı Ahmet"}, "remember"],
  ["hakkımda ne biliyorsun", "list_facts", {}, null],
  ["makro kaydet", "start_macro", {name: "test"}, "makro"],
  ["makroları listele", "list_macros", {}, null],
  ["bilgi tabanına şu dosyayı indeksle", "index_file", {path: "~/doc.pdf"}, "index"],
  ["indekslenmiş dosyaları göster", "list_indexed_files", {}, null],
  ["şifremi kasaya kaydet", "vault_store", {key: "gmail", value: "xxx"}, "vault"],
  ["kasadakileri listele", "vault_list", {}, null],
  ["git durumunu göster", "git_status", {repo_path: "."}, "git"],
  ["son commitleri göster", "git_log", {repo_path: "."}, "git"],
  ["bugünkü zaman raporumu göster", "time_track_report", {period: "today"}, "zaman"],
  ["bu haftaki süre raporu", "time_track_report", {period: "week"}, "hafta"],
  ["takvimde bu haftaki etkinlikleri göster", "calendar_get_events", {}, "takvim"],
  ["bir kişilik oluştur: korsan", "add_persona", {name: "korsan", prompt: "korsan gibi konuş"}, "kisilik"],
  ["kişilikleri listele", "list_personas", {}, null],
  ["google.com'a ping at", "ping_host", {host: "google.com"}, "ping"],
  ["cpu %90 olunca uyar", "watch_condition", {metric: "cpu", threshold: "90", direction: "above"}, "uyar"],
  ["izleme koşullarını listele", "list_watch_conditions", {}, null],
  ["bir flashcard ekle", "card_add", {front: "soru", back: "cevap"}, "flashcard"],
  ["günlük rapor çıkar", "daily_report", {}, "rapor"],
  ["bu resmi yeniden boyutlandır", "resize_image", {path: "~/a.png", width: "800"}, "resim"],
  ["interpolasyonla şu resmi jpg'ye dönüştür", "convert_image", {path: "~/a.png", format: "jpg"}, "donustur"],
  ["bir otomasyon kur: ekran kilitlenince müziği durdur", "if_then", {condition: "ekran kilit", action: "müzik durdur"}, "otomasyon"],
  ["otomasyonları listele", "list_automations", {}, null],
  ["spotify cihazlarını listele", "spotify_devices", {}, "spotify"],
  ["telefona aktar", "spotify_transfer", {device_id: "phone"}, "spotify"],
  ["çalma listelerimi göster", "spotify_playlists", {}, "playlist"],
  ["en son dinlediklerimi göster", "spotify_recently_played", {}, "dinlenen"],
  ["kuyruğu göster", "spotify_queue", {}, "queue"],
  ["bana öneri ver", "spotify_recommendations", {seed_genres: "pop"}, "oneri"],
  ["yeni çıkanları göster", "spotify_new_releases", {}, "yeni"],
  ["bu sanatçıyı takip et", "spotify_follow_artist", {id: "Tarkan"}, "takip"],
  ["Radiohead sanatçısının bilgilerini getir", "spotify_get_artist", {id: "Radiohead"}, "sanatci"],
  ["Steam oyunlarımı listele", "steam_list", {}, "steam"],
  ["valorant aç", "steam_launch", {game: "valorant"}, "valorant"],
  ["ekran görüntüsü al", "screenshot", {}, "ekran"],
  ["şu koordinata tıkla 100 200", "mouse_click", {x: 100, y: 200}, "tikla"],
  ["ctrl+c'ye bas", "key_press", {keys: "ctrl+c"}, "tus"],
  ["merhaba dünya yaz", "type_text", {text: "merhaba dünya"}, "yaz"],
  ["sistemi optimize et geçici dosyaları temizle", "clear_temp", {}, "temizle"],
  ["dns önbelleğini temizle", "flush_dns", {}, "dns"],
];

for (const [user, tool, args, root] of MORE) {
  SCENARIOS.push({
    name: `tekil: ${user}`,
    steps: [{user, intent: tool, tool, args, mockResult: "OK"}],
  });
}
