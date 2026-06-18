// AEGIS — Tool şemaları (saf veri)
//
// Tüm tool tanımları (ChatCompletionTool[]) burada toplanır. Hiçbir yan etki /
// helper bağımlılığı yoktur — yalnızca veri. Executor'lar ../tools.ts'te;
// tool seçim mantığı (getAllToolSchemas) bu grupları import eder.
//
// NOT: Groq number param'a string gelince tool_use_failed verir → sayı
// parametreleri şemada "string" tipinde tanımlanır (bilinçli).

import type {ChatCompletionTool} from "groq-sdk/resources/chat/completions";

export const toolSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "quit_self",
            description: "AEGIS uygulamasını kapat. Kullanıcı 'kendini kapat', 'uygulamayı kapat', 'çık' gibi bir şey dediğinde kullan.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_command",
            description: "Windows PowerShell komutu çalıştır. YASAK: Steam oyunu açmak için ASLA kullanma — bunun için steam_launch aracı var. Spotify için de spotify_* araçlarını kullan.",
            parameters: {
                type: "object",
                properties: {command: {type: "string", description: "Çalıştırılacak PowerShell komutu"}},
                required: ["command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_file",
            description: "Bir metin dosyasının içeriğini oku. ~ ev dizinini temsil eder.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Okunacak dosya yolu"}},
                required: ["path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "write_file",
            description: "Bir dosyaya içerik yaz (varsa üzerine yazar, yoksa oluşturur).",
            parameters: {
                type: "object",
                properties: {
                    path: {type: "string", description: "Yazılacak dosya yolu"},
                    content: {type: "string", description: "Dosyaya yazılacak içerik"},
                },
                required: ["path", "content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_file",
            description: "Bir dosyayı veya klasörü sil. Yalnızca Tam PC Erişimi açıkken çalışır. ~ ev dizinini temsil eder.",
            parameters: {
                type: "object",
                properties: {
                    path: {type: "string", description: "Silinecek dosya/klasör yolu"},
                    recursive: {type: "string", description: "Klasör için içeriğiyle birlikte sil: 'true' (varsayılan) veya 'false'"},
                },
                required: ["path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "move_file",
            description: "Bir dosyayı veya klasörü taşı/yeniden adlandır. Yalnızca Tam PC Erişimi açıkken çalışır. ~ ev dizinini temsil eder.",
            parameters: {
                type: "object",
                properties: {
                    source: {type: "string", description: "Kaynak dosya/klasör yolu"},
                    destination: {type: "string", description: "Hedef yol"},
                },
                required: ["source", "destination"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_directory",
            description: "Bir klasördeki dosya ve klasörleri listele.",
            parameters: {
                type: "object",
                properties: {path: {type: "string", description: "Listelenecek klasör yolu (opsiyonel)"}},
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "İnternette güncel bilgi ara. Tavily kullanır.",
            parameters: {
                type: "object",
                properties: {query: {type: "string", description: "Arama sorgusu"}},
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_profile",
            description: "Kullanıcı hakkında bir bilgi kaydet. Örn: isim, meslek, tercihler, alışkanlıklar.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Bilgi anahtarı (örn: 'isim', 'meslek', 'kahve_tercihi')"},
                    value: {type: "string", description: "Bilgi değeri"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_profile",
            description: "Kaydedilmiş kullanıcı bilgilerini getir.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "save_note",
            description: "Bir not veya hatırlatıcı kaydet. Tarih/saat belirtilirse o zaman hatırlatır.",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Not içeriği"},
                    remind_at: {type: "string", description: "ISO 8601 tarih/saat (opsiyonel, örn: '2026-06-01T09:00:00')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_notes",
            description: "Bekleyen notları ve hatırlatıcıları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "done_note",
            description: "Bir notu tamamlandı olarak işaretle.",
            parameters: {
                type: "object",
                properties: {id: {type: "string", description: "Not ID'si"}},
                required: ["id"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "read_clipboard",
            description: "Panodaki metni oku. 'Panoyu oku', 'Panoda ne var?' gibi.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "write_clipboard",
            description: "Metni panoya kopyala. 'Bunu kopyala', 'Panoya yaz' gibi.",
            parameters: {
                type: "object",
                properties: {text: {type: "string", description: "Panoya yazılacak metin"}},
                required: ["text"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_windows",
            description: "Şu an açık olan pencereleri listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "focus_window",
            description: "Belirtilen pencereyi öne getir / odakla. 'Chrome'u öne getir', 'VSCode'u aç' gibi.",
            parameters: {
                type: "object",
                properties: {title: {type: "string", description: "Pencere başlığı veya uygulama adı (kısmi eşleşme yeterli)"}},
                required: ["title"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_volume",
            description: "Sistem ses seviyesini ayarla (0-100). 'Sesi %50 yap', 'Sesi aç/kapat' gibi.",
            parameters: {
                type: "object",
                properties: {level: {type: "string", description: "Ses seviyesi 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_brightness",
            description: "Ekran parlaklığını ayarla (0-100). Dahili ekranlarda çalışır.",
            parameters: {
                type: "object",
                properties: {level: {type: "string", description: "Parlaklık 0-100"}},
                required: ["level"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "remind_in",
            description: "X dakika sonra kullanıcıya sesli/yazılı hatırlatıcı gönder. '10 dakika sonra hatırlat', 'Yarım saat sonra...' gibi.",
            parameters: {
                type: "object",
                properties: {
                    message: {type: "string", description: "Hatırlatıcı mesajı"},
                    minutes: {type: "string", description: "Kaç dakika sonra (ondalık da olabilir, örn: 0.5 = 30 saniye)"},
                },
                required: ["message", "minutes"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "save_app_profile",
            description: "Bir uygulama profili kaydet. Her satırda bir PowerShell komutu. 'Oyun modunu kaydet', 'Çalışma profili oluştur' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Profil adı (örn: oyun_modu, calisma_modu)"},
                    commands: {type: "string", description: "Her satırda bir PowerShell komutu (örn: Start-Process chrome\\nStart-Process code)"},
                },
                required: ["name", "commands"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "run_app_profile",
            description: "Kaydedilmiş uygulama profilini çalıştır. 'Oyun modunu aç', 'Çalışma moduna geç' gibi.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Çalıştırılacak profil adı"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_app_profiles",
            description: "Kayıtlı uygulama profillerini listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "screenshot",
            description: "Ekranın anlık görüntüsünü al ve analiz et. 'Ekranımda ne var?', 'Bu hata ne?', 'Ekranı analiz et' gibi sorularda kullan. question parametresi ile ne sormak istediğini belirt.",
            parameters: {
                type: "object",
                properties: {
                    question: {type: "string", description: "Ekran hakkında sorulacak soru veya yapılacak analiz (örn: 'Ekranda ne var?', 'Bu hata mesajı ne anlama geliyor?', 'Hangi uygulama açık?')"},
                },
                required: ["question"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "set_language",
            description: "Switch the interface and response language. Call when user asks to change language (e.g. 'switch to English', 'Türkçeye geç', 'Auf Deutsch wechseln', 'en français', 'cambia a español').",
            parameters: {
                type: "object",
                properties: {
                    language: {
                        type: "string",
                        enum: ["tr", "en", "de", "fr", "es"],
                        description: "Language code: tr=Turkish, en=English, de=German, fr=French, es=Spanish",
                    },
                },
                required: ["language"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "fetch_url",
            description: "Bir web sayfasının içeriğini getir ve düz metin olarak döndür. 'Bu sayfada ne yazıyor?', 'URL'yi oku', 'Haberi özetle' gibi.",
            parameters: {
                type: "object",
                properties: {
                    url: {type: "string", description: "Okunacak web sayfasının URL'si (örn: https://example.com)"},
                },
                required: ["url"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "show_notification",
            description: "Windows'ta sistem bildirim balonu göster. 'Bildirim gönder', 'Bana bildir', 'Toast bildirim' gibi.",
            parameters: {
                type: "object",
                properties: {
                    title: {type: "string", description: "Bildirim başlığı"},
                    body: {type: "string", description: "Bildirim içeriği / mesaj"},
                },
                required: ["title", "body"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_plugins",
            description: "Yüklü plugin'leri ve sağladıkları araçları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "reload_plugins",
            description: "Plugin'leri ~/.aegis/plugins/ klasöründen yeniden yükle. Yeni plugin eklendikten sonra kullan.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
];

export const schedulerSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "schedule_task",
            description: "Tekrarlayan zamanlanmış görev oluştur. 'Her sabah hava durumunu söyle', 'Her saat başı CPU kullanımını kontrol et' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name:     {type: "string", description: "Görev adı (benzersiz, kısa)"},
                    schedule: {type: "string", description: "Zamanlama: 'every 30 minutes', 'every 2 hours', 'daily at 09:00', 'hourly'"},
                    command:  {type: "string", description: "AEGIS'e gönderilecek doğal dil komutu (örn: 'hava durumunu söyle')"},
                },
                required: ["name", "schedule", "command"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_scheduled_tasks",
            description: "Tüm zamanlanmış görevleri listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "cancel_scheduled_task",
            description: "Zamanlanmış görevi iptal et (ad veya ID ile).",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Görev adı (kısmi eşleşme yeterli) veya ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_scheduled_task",
            description: "Zamanlanmış görevi etkinleştir/devre dışı bırak.",
            parameters: {
                type: "object",
                properties: {
                    id_or_name: {type: "string", description: "Görev adı veya ID"},
                },
                required: ["id_or_name"],
                additionalProperties: false,
            },
        },
    },
];

export const marketplaceSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "plugin_search",
            description: "GitHub'da AEGIS plugin ara. 'Discord plugin var mı?', 'Notion entegrasyonu ara' gibi.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Arama terimi"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_install",
            description: "GitHub repo'sundan plugin kur. 'kullanici/aegis-plugin-x' formatında.",
            parameters: {
                type: "object",
                properties: {
                    repo: {type: "string", description: "GitHub repo yolu (örn: user/aegis-plugin-discord)"},
                },
                required: ["repo"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "plugin_remove",
            description: "Yüklü bir plugin'i kaldır.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Plugin adı"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

export const securitySchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "vault_store",
            description: "API key veya hassas veriyi Windows şifreli depoya (safeStorage) kaydet.",
            parameters: {
                type: "object",
                properties: {
                    key:   {type: "string", description: "Anahtar adı (örn: 'openai_key')"},
                    value: {type: "string", description: "Kaydedilecek değer"},
                },
                required: ["key", "value"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "vault_list",
            description: "Güvenli depodaki anahtarları listele (değerleri göstermez).",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "vault_delete",
            description: "Güvenli depodan bir anahtarı sil.",
            parameters: {
                type: "object",
                properties: {
                    key: {type: "string", description: "Silinecek anahtar adı"},
                },
                required: ["key"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "privacy_audit",
            description: "Hangi verilerin nerede saklandığını listele. 'Gizlilik denetimi yap', 'Verilerimi nerede saklıyorsun?' gibi.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "clear_old_data",
            description: "Eski verileri temizle (bilgi tabanı chunk'ları, devre dışı görevler). 'X günden eski verileri sil' gibi.",
            parameters: {
                type: "object",
                properties: {
                    days: {type: "string", description: "Kaç günden eski veri silinsin (varsayılan 30)"},
                },
                additionalProperties: false,
            },
        },
    },
];

export const memoryPlusSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "remember_fact",
            description: "Kalıcı bir gerçeği hafızaya kaydet. 'Bunu bil: abimin adı Ahmet', 'Hatırla: proje teslim tarihi 15 Temmuz' gibi.",
            parameters: {
                type: "object",
                properties: {
                    content: {type: "string", description: "Kaydedilecek gerçek"},
                    tags:    {type: "string", description: "Etiketler, virgülle ayrılmış (opsiyonel, örn: 'aile,kişisel')"},
                },
                required: ["content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_facts",
            description: "Kaydedilmiş gerçekleri listele. 'Ne biliyorsun?', 'Kayıtlı bilgilerin neler?' gibi.",
            parameters: {
                type: "object",
                properties: {
                    filter: {type: "string", description: "Filtreleme terimi (opsiyonel)"},
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "forget_fact",
            description: "Kayıtlı bir gerçeği sil.",
            parameters: {
                type: "object",
                properties: {
                    id_or_content: {type: "string", description: "Gerçek ID veya içeriği (kısmi eşleşme)"},
                },
                required: ["id_or_content"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_habits",
            description: "En sık kullandığın araçları ve alışkanlık istatistiklerini göster.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
];

export const knowledgeSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "index_file",
            description: "Bir dosyayı bilgi tabanına indeksle. .txt, .md, .ts, .js, .py, .json, .csv desteklenir.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "İndekslenecek dosya yolu (~ desteklenir)"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "index_folder",
            description: "Bir klasördeki tüm uygun dosyaları bilgi tabanına indeksle.",
            parameters: {
                type: "object",
                properties: {
                    folder_path: {type: "string", description: "Klasör yolu"},
                    extensions:  {type: "string", description: "Virgülle ayrılmış uzantılar (varsayılan: .txt,.md,.ts,.js,.py)"},
                },
                required: ["folder_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "search_knowledge",
            description: "Bilgi tabanında semantik arama yap. 'Proje notlarımda X hakkında ne var?' gibi.",
            parameters: {
                type: "object",
                properties: {
                    query: {type: "string", description: "Arama sorgusu"},
                    top_k: {type: "string", description: "Döndürülecek sonuç sayısı (varsayılan 5)"},
                },
                required: ["query"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "chat_with_file",
            description: "Bir dosyayla sohbet et — dosya içeriğini bağlam olarak yükle. 'Bu PDF ne diyor?', 'Şu dosyayı özetle' gibi.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Okunacak dosya yolu"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_indexed_files",
            description: "Bilgi tabanındaki indekslenmiş dosyaları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_from_index",
            description: "Bir dosyayı bilgi tabanından kaldır.",
            parameters: {
                type: "object",
                properties: {
                    file_path: {type: "string", description: "Kaldırılacak dosya yolu"},
                },
                required: ["file_path"],
                additionalProperties: false,
            },
        },
    },
];

export const automationSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "if_then",
            description: "Koşullu otomasyon kur. 'Saat 23 olunca ekranı karat', 'CPU 90 geçince müziği durdur' gibi. Desteklenen metrikler: cpu, ram, gpu, disk, hour, minute.",
            parameters: {
                type: "object",
                properties: {
                    condition: {type: "string", description: "Koşul ifadesi: 'cpu > 80', 'hour == 23', 'ram >= 75'"},
                    action:    {type: "string", description: "Tetiklenince AEGIS'e gönderilecek komut"},
                },
                required: ["condition", "action"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_automations",
            description: "Tanımlı otomasyon kurallarını listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_automation",
            description: "Bir otomasyon kuralını sil.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Otomasyon ID veya koşul ifadesi (kısmi eşleşme)"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "toggle_automation",
            description: "Bir otomasyon kuralını etkinleştir/devre dışı bırak.",
            parameters: {
                type: "object",
                properties: {
                    id_or_condition: {type: "string", description: "Otomasyon ID veya koşul ifadesi"},
                },
                required: ["id_or_condition"],
                additionalProperties: false,
            },
        },
    },
];

export const macroSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "start_macro",
            description: "Makro kaydını başlat. Bundan sonra verilen komutlar makroya eklenir. 'Sabah rutinini kaydet', 'Oyun başlatma makrosu oluştur' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Makro adı"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "stop_macro",
            description: "Aktif makro kaydını durdur ve kaydet.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "run_macro",
            description: "Kaydedilmiş bir makroyu çalıştır. 'Sabah rutinini çalıştır', 'Oyun makrosunu başlat' gibi.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Makro adı (kısmi eşleşme yeterli)"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_macros",
            description: "Kayıtlı makroları listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "delete_macro",
            description: "Bir makroyu sil.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Silinecek makro adı veya ID"},
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
];

// Faz 52 — Routines: tool çağrılarını kaydedip deterministik tekrar çalıştırma
export const routineSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "routine_record_start",
            description: "Routine kaydını başlat. Bundan sonra yaptığın EYLEMLER (spotify, steam, sistem, dosya vb.) bu routine'e otomatik kaydedilir. 'Kayıt başlat: Oyun Modu', 'Oyun Modu routine'i oluştur' gibi. Salt-okuma işlemleri (arama, ekran görüntüsü) kaydedilmez.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine adı, örn. 'Oyun Modu'"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_record_stop",
            description: "Aktif routine kaydını bitir ve kaydet. 'Kayıt bitir', 'Kaydı durdur'.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_record_cancel",
            description: "Aktif routine kaydını KAYDETMEDEN iptal et. 'Kaydı iptal et', 'Vazgeç'.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_run",
            description: "Kayıtlı bir routine'i çalıştır — adımları sırayla deterministik olarak uygular. 'Oyun Modunu aç', 'Oyun Modu routine'ini çalıştır'.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine adı (kısmi eşleşme yeterli)"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_list",
            description: "Kayıtlı routine'leri listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "routine_show",
            description: "Bir routine'in adımlarını ayrıntılı göster (düzenleme öncesi incelemek için).",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Routine adı veya ID"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_delete",
            description: "Bir routine'i sil.",
            parameters: {
                type: "object",
                properties: {name: {type: "string", description: "Silinecek routine adı veya ID"}},
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_rename",
            description: "Bir routine'i yeniden adlandır.",
            parameters: {
                type: "object",
                properties: {
                    name:     {type: "string", description: "Mevcut routine adı veya ID"},
                    new_name: {type: "string", description: "Yeni ad"},
                },
                required: ["name", "new_name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "routine_delete_step",
            description: "Bir routine'den belirli bir adımı çıkar (düzenleme). Adım numarasını 'routine_show' ile öğren.",
            parameters: {
                type: "object",
                properties: {
                    name: {type: "string", description: "Routine adı veya ID"},
                    step: {type: "string", description: "Çıkarılacak adımın numarası (1-tabanlı)"},
                },
                required: ["name", "step"],
                additionalProperties: false,
            },
        },
    },
];

export const agentSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "agent_run",
            description: "Ajan modunu başlat: bir hedef ver, AEGIS araçları zincirleme kullanarak onu tamamlar. 'Şu klasördeki tüm .txt dosyalarını özetle', 'Sistemi optimize et' gibi karmaşık görevler için.",
            parameters: {
                type: "object",
                properties: {
                    goal:      {type: "string", description: "Tamamlanacak hedef (açık ve net olsun)"},
                    max_steps: {type: "string", description: "Maksimum adım sayısı (varsayılan 10, max 20)"},
                },
                required: ["goal"],
                additionalProperties: false,
            },
        },
    },
];

export const watchSchemas: ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "watch_condition",
            description: "Bir sistem metriğini izle ve eşik aşılınca bildirim ver. 'GPU %90 geçerse uyar', 'RAM %80 üstüne çıkarsa bildir' gibi.",
            parameters: {
                type: "object",
                properties: {
                    metric:    {type: "string", description: "İzlenecek metrik: cpu, ram, gpu, disk"},
                    threshold: {type: "string", description: "Eşik değeri (yüzde, 1-100)"},
                    direction: {type: "string", description: "'above' (üstüne çıkarsa) veya 'below' (altına düşerse)"},
                },
                required: ["metric", "threshold"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_watch_conditions",
            description: "Aktif eşik izlemelerini listele.",
            parameters: {type: "object", properties: {}, additionalProperties: false},
        },
    },
    {
        type: "function",
        function: {
            name: "remove_watch_condition",
            description: "Bir eşik izlemesini kaldır.",
            parameters: {
                type: "object",
                properties: {
                    metric: {type: "string", description: "Kaldırılacak metrik: cpu, ram, gpu, disk"},
                },
                required: ["metric"],
                additionalProperties: false,
            },
        },
    },
];

// ───────────────────────────────────────────────────────────── Faz 19 Schemas
export const soundSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"play_sound",description:"Bir ses dosyasını çal (.mp3/.wav). ~/.aegis/sounds/ klasöründeki dosyalar veya tam yol.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Ses dosyasının yolu (örn: notification.wav, ~/sounds/ding.mp3)"},volume:{type: "string",description:"Ses seviyesi 0-100 (varsayılan 50)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_start",description:"Arka plan ambient sesi başlat. Odaklanma, dinlenme veya çalışma müziği için.",parameters:{type:"object",properties:{category:{type:"string",description:"Ambient kategorisi: rain, forest, cafe, white, space, lofi"},volume:{type: "string",description:"Ses seviyesi 0-100 (varsayılan 30)"}},required:["category"],additionalProperties:false}}},
    {type:"function",function:{name:"ambient_stop",description:"Çalan ambient sesi durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_sounds",description:"Mevcut ses dosyalarını ve ambient kategorilerini listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 20 Schemas
export const codeToolSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"git_status",description:"Git repo durumunu göster: staged, unstaged, untracked dosyalar.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu (varsayılan: mevcut dizin)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_log",description:"Son commit'leri listele. Graph/tree görünümü destekler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},count:{type: "string",description:"Gösterilecek commit sayısı (varsayılan 10)"},graph:{type:"boolean",description:"true = ASCII branch grafiği göster"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_diff",description:"Staged veya unstaged değişiklikleri göster. Belirli dosya verilebilir.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},staged:{type:"boolean",description:"true = staged değişiklikler, false = unstaged (varsayılan false)"},file:{type:"string",description:"Sadece bu dosyanın diff'ini göster (opsiyonel)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_add",description:"Dosyaları stage'e ekle (git add). '.' = tüm değişiklikler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},files:{type:"string",description:"Stage'e eklenecek dosya/desen. '.' = hepsi, veya spesifik dosya/klasör adı"}},required:["files"],additionalProperties:false}}},
    {type:"function",function:{name:"git_commit",description:"Staged değişiklikleri commit et. add_all=true ile önce tüm değişiklikleri stage'e alır.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},message:{type:"string",description:"Commit mesajı"},add_all:{type:"boolean",description:"true = önce git add . çalıştır, sonra commit et"}},required:["message"],additionalProperties:false}}},
    {type:"function",function:{name:"git_push",description:"Değişiklikleri remote'a gönder (git push).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},remote:{type:"string",description:"Remote adı (varsayılan: origin)"},branch:{type:"string",description:"Branch adı (varsayılan: aktif branch)"},force:{type:"boolean",description:"true = --force-with-lease ile zorla it"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_pull",description:"Remote'dan değişiklikleri çek (git pull).",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},remote:{type:"string",description:"Remote adı (varsayılan: origin)"},rebase:{type:"boolean",description:"true = --rebase ile çek"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_branch",description:"Branch oluştur, değiştir, sil veya listele. Görsel branch haritası için action=graph.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"list, create, switch, delete, graph (görsel ağaç)"},branch_name:{type:"string",description:"Branch adı (create/switch/delete için)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_stash",description:"Değişiklikleri geçici olarak sakla veya geri yükle.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"save, pop, list, drop, apply"},message:{type:"string",description:"Stash mesajı (save için opsiyonel)"},index:{type: "string",description:"Stash indeksi (drop/apply için, varsayılan 0)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"git_merge",description:"Branch merge et. fast-forward veya no-ff destekler.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},branch:{type:"string",description:"Merge edilecek branch"},no_ff:{type:"boolean",description:"true = --no-ff (merge commit oluştur)"}},required:["branch"],additionalProperties:false}}},
    {type:"function",function:{name:"git_reset",description:"Staged dosyaları unstage et veya son commit'i geri al.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},mode:{type:"string",description:"soft (commit geri al, dosyalar staged kalır), mixed (varsayılan, staged temizle), hard (dikkat! tüm değişiklikleri sil)"},commits:{type: "string",description:"Kaç commit geri git (varsayılan 1)"},file:{type:"string",description:"Belirli dosyayı unstage et (mode yerine kullanılır)"}},additionalProperties:false}}},
    {type:"function",function:{name:"git_remote",description:"Remote URL'leri listele veya ekle/değiştir.",parameters:{type:"object",properties:{repo_path:{type:"string",description:"Repo yolu"},action:{type:"string",description:"list, add, set-url"},name:{type:"string",description:"Remote adı"},url:{type:"string",description:"Remote URL"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"run_and_analyze",description:"Bir komutu çalıştır ve çıktısını analiz et. Hata mesajlarını açıkla, çözüm öner.",parameters:{type:"object",properties:{command:{type:"string",description:"Çalıştırılacak komut"},context:{type:"string",description:"Ek bağlam (örn: bu bir Node.js projesi)"}},required:["command"],additionalProperties:false}}},
    {type:"function",function:{name:"scaffold_project",description:"Hazır şablondan yeni proje oluştur. Örnek: 'Python FastAPI', 'React Tailwind', 'Node Express'.",parameters:{type:"object",properties:{template:{type:"string",description:"Şablon adı: python-fastapi, react-tailwind, node-express, electron-app, next-ts"},target_path:{type:"string",description:"Projenin oluşturulacağı dizin (varsayılan: Desktop)"}},required:["template"],additionalProperties:false}}},
    {type:"function",function:{name:"list_templates",description:"Mevcut proje şablonlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 21 Schemas
export const timeSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"pomodoro_start",description:"Pomodoro zamanlayıcısını başlat. 25 dakika çalışma / 5 dakika mola döngüsü.",parameters:{type:"object",properties:{work_minutes:{type: "string",description:"Çalışma süresi dakika (varsayılan 25)"},break_minutes:{type: "string",description:"Mola süresi dakika (varsayılan 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"pomodoro_stop",description:"Çalışan pomodoro zamanlayıcısını durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_start",description:"Görev bazlı zaman takibini başlat.",parameters:{type:"object",properties:{task_name:{type:"string",description:"Takip edilecek görev adı"}},required:["task_name"],additionalProperties:false}}},
    {type:"function",function:{name:"time_track_stop",description:"Zaman takibini durdur ve süreyi kaydet.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"time_track_report",description:"Günlük/haftalık zaman harcama raporunu göster.",parameters:{type:"object",properties:{period:{type:"string",description:"Dönem: today, week, month (varsayılan: today)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_get_events",description:"Windows Takvim'den etkinlikleri çek. Bugünkü veya belirtilen tarihteki etkinlikler.",parameters:{type:"object",properties:{date:{type:"string",description:"Tarih YYYY-MM-DD formatında (varsayılan: bugün)"},days_ahead:{type: "string",description:"Kaç gün ileri bak (varsayılan 1)"}},additionalProperties:false}}},
    {type:"function",function:{name:"calendar_add_event",description:"Windows Takvim'e etkinlik ekle.",parameters:{type:"object",properties:{title:{type:"string",description:"Etkinlik başlığı"},start_time:{type:"string",description:"Başlangıç zamanı (örn: 2024-01-15 14:00)"},duration_minutes:{type: "string",description:"Süre dakika (varsayılan 60)"},notes:{type:"string",description:"Notlar (opsiyonel)"}},required:["title","start_time"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 22 Schemas
export const mediaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"organize_folder",description:"Klasörü tara ve dosyaları uzantı/tarihe göre alt klasörlere taşı.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Organize edilecek klasör yolu"},by:{type:"string",description:"Gruplama kriteri: extension (uzantı) veya date (tarih, varsayılan: extension)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"find_duplicates",description:"Bir klasördeki yinelenen dosyaları hash karşılaştırmasıyla bul.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Taranacak klasör"},recursive:{type:"boolean",description:"Alt klasörleri de tara (varsayılan true)"}},required:["folder_path"],additionalProperties:false}}},
    {type:"function",function:{name:"bulk_rename",description:"Bir klasördeki dosyaları toplu yeniden adlandır.",parameters:{type:"object",properties:{folder_path:{type:"string",description:"Klasör yolu"},pattern:{type:"string",description:"Mevcut kalıp (regex veya sabit metin)"},replacement:{type:"string",description:"Yeni ad kalıbı ($1 = yakalama grubu, {n} = sıra numarası)"},extension:{type:"string",description:"Sadece bu uzantıya uygula (opsiyonel, örn: .jpg)"}},required:["folder_path","pattern","replacement"],additionalProperties:false}}},
    {type:"function",function:{name:"analyze_image",description:"Yerel bir görüntü dosyasını vision modelle analiz et.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Görüntü dosyasının yolu"},question:{type:"string",description:"Görüntü hakkında soru (opsiyonel)"}},required:["image_path"],additionalProperties:false}}},
    {type:"function",function:{name:"resize_image",description:"Bir görüntüyü yeniden boyutlandır.",parameters:{type:"object",properties:{image_path:{type:"string",description:"Görüntü yolu"},width:{type: "string",description:"Hedef genişlik (piksel)"},height:{type: "string",description:"Hedef yükseklik (piksel, opsiyonel — orantılı)"},output_path:{type:"string",description:"Çıktı yolu (opsiyonel, varsayılan: kaynak_resized.ext)"}},required:["image_path","width"],additionalProperties:false}}},
    {type:"function",function:{name:"convert_image",description:"Bir görüntü dosyasını farklı formata çevir (PNG/JPEG/BMP/GIF).",parameters:{type:"object",properties:{image_path:{type:"string",description:"Kaynak görüntü yolu"},output_format:{type:"string",description:"Hedef format: png, jpg, bmp, gif"},output_path:{type:"string",description:"Çıktı yolu (opsiyonel)"}},required:["image_path","output_format"],additionalProperties:false}}},
    {type:"function",function:{name:"pdf_to_text",description:"PDF dosyasından metin çıkar.",parameters:{type:"object",properties:{pdf_path:{type:"string",description:"PDF dosyasının yolu"},max_chars:{type: "string",description:"Maksimum karakter sayısı (varsayılan 10000)"}},required:["pdf_path"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 23 Schemas
export const personaSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"set_persona",description:"AEGIS'in aktif kişiliğini değiştir. Farklı modlar: resmi asistan, samimi arkadaş, sert koç, öğretmen.",parameters:{type:"object",properties:{name:{type:"string",description:"Persona adı: default, formal, friendly, coach, teacher veya özel persona adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"get_persona",description:"Şu an aktif olan kişiliği göster.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_personas",description:"Tüm mevcut kişilikleri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"add_persona",description:"Yeni özel kişilik ekle.",parameters:{type:"object",properties:{name:{type:"string",description:"Kişilik adı"},description:{type:"string",description:"Kısa açıklama"},system_prompt:{type:"string",description:"Bu kişilik için sistem talimatları"}},required:["name","system_prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_start",description:"Belirli bir karakterde rol yapma modunu başlat.",parameters:{type:"object",properties:{character:{type:"string",description:"Karakter açıklaması (örn: 'deneyimli Python öğretmeni', 'startup CEO')"},scenario:{type:"string",description:"Senaryo bağlamı (opsiyonel)"}},required:["character"],additionalProperties:false}}},
    {type:"function",function:{name:"roleplay_stop",description:"Rol yapma modundan çık, normal moda dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 24 Schemas
export const networkSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"ping_host",description:"Bir host'a ping at, gecikme ve paket kaybını ölç.",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host (IP veya domain)"},count:{type: "string",description:"Ping sayısı (varsayılan 4)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"trace_route",description:"Bir host'a giden ağ yolunu izle.",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host"},max_hops:{type: "string",description:"Maksimum hop sayısı (varsayılan 30)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"port_scan",description:"Bir host'un açık portlarını tara (yerel ağ, eğitim amaçlı).",parameters:{type:"object",properties:{host:{type:"string",description:"Hedef host (IP)"},ports:{type:"string",description:"Port aralığı (örn: 80,443,8080 veya 1-1024, varsayılan: 21,22,25,80,443,3306,8080)"}},required:["host"],additionalProperties:false}}},
    {type:"function",function:{name:"dns_lookup",description:"Bir domain için DNS kayıtlarını sorgula (A, MX, TXT).",parameters:{type:"object",properties:{domain:{type:"string",description:"Sorgulancak domain"},type:{type:"string",description:"Kayıt tipi: A, MX, TXT, NS, CNAME (varsayılan A)"}},required:["domain"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_run",description:"SSH ile uzak sunucuda komut çalıştır (önceden kaydedilmiş host).",parameters:{type:"object",properties:{host_alias:{type:"string",description:"~/.aegis/ssh-hosts.json'daki host takma adı"},command:{type:"string",description:"Çalıştırılacak komut"}},required:["host_alias","command"],additionalProperties:false}}},
    {type:"function",function:{name:"ssh_add_host",description:"SSH host profili kaydet.",parameters:{type:"object",properties:{alias:{type:"string",description:"Takma ad"},hostname:{type:"string",description:"IP veya hostname"},username:{type:"string",description:"Kullanıcı adı"},port:{type: "string",description:"SSH portu (varsayılan 22)"},key_path:{type:"string",description:"Private key yolu (opsiyonel)"}},required:["alias","hostname","username"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_ps",description:"Çalışan Docker container'larını listele.",parameters:{type:"object",properties:{all:{type:"boolean",description:"Durdurulmuş container'ları da göster (varsayılan false)"}},additionalProperties:false}}},
    {type:"function",function:{name:"docker_start",description:"Bir Docker container'ını başlat.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_stop",description:"Bir Docker container'ını durdur.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"}},required:["container"],additionalProperties:false}}},
    {type:"function",function:{name:"docker_logs",description:"Docker container loglarını al.",parameters:{type:"object",properties:{container:{type:"string",description:"Container adı veya ID"},lines:{type: "string",description:"Son kaç satır (varsayılan 50)"}},required:["container"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 25 Schemas
export const vizSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"create_chart",description:"Veriden ASCII grafik oluştur. Sütun, çizgi veya pasta grafik. Feed'de gösterilir.",parameters:{type:"object",properties:{type:{type:"string",description:"Grafik tipi: bar, line, pie"},data:{type:"string",description:"JSON formatında veri: {labels:[...], values:[...]} veya [[label,value],...]"},title:{type:"string",description:"Grafik başlığı (opsiyonel)"}},required:["type","data"],additionalProperties:false}}},
    {type:"function",function:{name:"system_report",description:"Sistem sağlık raporu oluştur: CPU, RAM, disk, GPU son 24 saatin özeti.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 26 Schemas
export const emailSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"email_send",description:"SMTP ile e-posta gönder. Kimlik bilgileri vault'ta saklanmalı.",parameters:{type:"object",properties:{to:{type:"string",description:"Alıcı e-posta adresi"},subject:{type:"string",description:"Konu"},body:{type:"string",description:"E-posta gövdesi"},from_alias:{type:"string",description:"Vault'taki SMTP profili takma adı (varsayılan: default)"}},required:["to","subject","body"],additionalProperties:false}}},
    {type:"function",function:{name:"email_fetch",description:"IMAP ile gelen kutusunu oku.",parameters:{type:"object",properties:{count:{type: "string",description:"Son kaç e-posta (varsayılan 10)"},folder:{type:"string",description:"Klasör adı (varsayılan: INBOX)"},from_alias:{type:"string",description:"Vault'taki IMAP profili takma adı"}},additionalProperties:false}}},
    {type:"function",function:{name:"email_draft",description:"Doğal dil açıklamasından profesyonel e-posta taslağı oluştur.",parameters:{type:"object",properties:{intent:{type:"string",description:"E-postanın amacı (örn: toplantı teklifi, şikayet, teşekkür)"},recipient:{type:"string",description:"Alıcının rolü/adı"},tone:{type:"string",description:"Ton: formal, friendly, assertive (varsayılan: formal)"},language:{type:"string",description:"Dil: tr, en (varsayılan: tr)"}},required:["intent"],additionalProperties:false}}},
    {type:"function",function:{name:"email_setup_smtp",description:"SMTP/IMAP e-posta profili kaydet (şifreli vault'a).",parameters:{type:"object",properties:{alias:{type:"string",description:"Profil takma adı"},smtp_host:{type:"string",description:"SMTP sunucu"},smtp_port:{type: "string",description:"SMTP portu"},imap_host:{type:"string",description:"IMAP sunucu"},imap_port:{type: "string",description:"IMAP portu"},username:{type:"string",description:"Kullanıcı adı (e-posta)"},password:{type:"string",description:"Şifre (vault'a şifreli kaydedilir)"}},required:["alias","smtp_host","username","password"],additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 27 Schemas
export const learningSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"card_add",description:"Yeni flashcard ekle. Konu + cevap çifti.",parameters:{type:"object",properties:{front:{type:"string",description:"Soru veya konu"},back:{type:"string",description:"Cevap veya açıklama"},tags:{type:"string",description:"Etiketler virgülle ayrılmış (örn: python,programlama)"}},required:["front","back"],additionalProperties:false}}},
    {type:"function",function:{name:"card_review",description:"Spaced repetition ile flashcard çalış. Bugünkü tekrar gereken kartları göster.",parameters:{type:"object",properties:{tag:{type:"string",description:"Belirli etikete göre filtrele (opsiyonel)"},count:{type: "string",description:"Kaç kart çalışılacak (varsayılan 5)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_add",description:"Okuma listesine URL veya kitap ekle.",parameters:{type:"object",properties:{url_or_title:{type:"string",description:"Makale URL'i veya kitap adı"},notes:{type:"string",description:"Notlar (opsiyonel)"},priority:{type: "string",description:"Öncelik 1-5 (varsayılan 3)"}},required:["url_or_title"],additionalProperties:false}}},
    {type:"function",function:{name:"reading_list",description:"Okuma listesini göster.",parameters:{type:"object",properties:{status:{type:"string",description:"Filtre: all, pending, done (varsayılan: pending)"}},additionalProperties:false}}},
    {type:"function",function:{name:"reading_summarize",description:"Bir URL'deki makaleyi çekip LLM ile özetle.",parameters:{type:"object",properties:{url:{type:"string",description:"Özetlenecek makale URL'i"},add_to_list:{type:"boolean",description:"Okuma listesine de ekle (varsayılan true)"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_set",description:"Yeni hedef tanımla.",parameters:{type:"object",properties:{title:{type:"string",description:"Hedef başlığı"},deadline:{type:"string",description:"Son tarih YYYY-MM-DD (opsiyonel)"},steps:{type:"string",description:"Alt adımlar virgülle ayrılmış (opsiyonel)"}},required:["title"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_check_in",description:"Bir hedefin ilerlemesini güncelle.",parameters:{type:"object",properties:{goal_id_or_title:{type:"string",description:"Hedef ID veya başlığı"},progress:{type: "string",description:"Tamamlanma yüzdesi 0-100"},note:{type:"string",description:"İlerleme notu (opsiyonel)"}},required:["goal_id_or_title","progress"],additionalProperties:false}}},
    {type:"function",function:{name:"goal_list",description:"Aktif hedefleri ve tamamlanma yüzdelerini göster.",parameters:{type:"object",properties:{status:{type:"string",description:"Filtre: all, active, done (varsayılan: active)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 28 Schemas
export const iotSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"list_bluetooth",description:"Bağlı ve eşleştirilmiş Bluetooth cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"connect_bluetooth",description:"Bir Bluetooth cihazına bağlan.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Cihaz adı (kısmi eşleşme desteklenir)"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"disconnect_bluetooth",description:"Bağlı Bluetooth cihazının bağlantısını kes.",parameters:{type:"object",properties:{device_name:{type:"string",description:"Cihaz adı"}},required:["device_name"],additionalProperties:false}}},
    {type:"function",function:{name:"list_usb",description:"Bağlı USB cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"list_printers",description:"Kurulu yazıcıları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"print_file",description:"Belirtilen dosyayı yazdır.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Yazdırılacak dosya yolu"},printer_name:{type:"string",description:"Yazıcı adı (opsiyonel, varsayılan: varsayılan yazıcı)"}},required:["file_path"],additionalProperties:false}}},
    {type:"function",function:{name:"printer_status",description:"Yazıcı durumunu sorgula (kağıt, mürekkep, kuyruk).",parameters:{type:"object",properties:{printer_name:{type:"string",description:"Yazıcı adı (opsiyonel)"}},additionalProperties:false}}},
    {type:"function",function:{name:"weather_station",description:"Hava durumu: sıcaklık, nem, basınç, rüzgar. Konum belirtilmezse kullanıcının IP konumunu kullanır. API key gerektirmez.",parameters:{type:"object",properties:{location:{type:"string",description:"Şehir adı (örn: Ankara, Istanbul, London). Boş bırakılırsa kullanıcının konumu otomatik algılanır."}},additionalProperties:false}}},
];

// ───────────────────────────────────────── Faz 62 — Akıllı Ev (Home Assistant)
// Tek HA sunucusu arkasındaki tüm markaları (Hue/Tapo/Tuya/Matter/Zigbee) yönetir.
// Akıllı: doğal dil ("salonu karart", "her şeyi kapat") entity'lere çözülür.
// Kritik cihazlar (kilit/ısıtıcı/garaj/priz) onay ister (confirm:"true").
export const smartHomeSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"smart_home_devices",description:"Akıllı ev cihazlarını listele (ışık, priz, kilit, termostat, panjur…) ve mevcut durumlarını göster. Home Assistant'a bağlanır.",parameters:{type:"object",properties:{area:{type:"string",description:"Sadece bu oda/alanı göster (opsiyonel, örn: salon, yatak odası, mutfak)"}},additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_status",description:"Belirli bir akıllı ev cihazının veya odanın durumunu sorgula. 'Salon ışığı açık mı?', 'Termostat kaç derece?' gibi.",parameters:{type:"object",properties:{target:{type:"string",description:"Cihaz veya oda adı (örn: salon ışığı, yatak odası, ön kapı kilidi)"}},required:["target"],additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_control",description:"Akıllı ev cihazını kontrol et: aç/kapat, parlaklık ayarla, kilitle/aç, panjur aç/kapat. Doğal dil hedefini otomatik çözer ('salonu karart', 'her şeyi kapat', 'yatak odasını %30 yap'). Kritik cihazlarda (kilit, ısıtıcı, garaj, priz) önce onay ister; kullanıcı onaylayınca confirm:\"true\" ile tekrar çağır.",parameters:{type:"object",properties:{target:{type:"string",description:"Hedef cihaz/oda/grup (örn: salon, yatak odası lambası, ön kapı, tüm ışıklar, her şey)"},action:{type:"string",enum:["on","off","toggle","brightness","temperature","lock","unlock","open","close"],description:"on=aç, off=kapat, toggle=değiştir, brightness=parlaklık (value gerekir), temperature=sıcaklık (value gerekir), lock/unlock=kilitle/aç, open/close=panjur/garaj aç/kapat"},value:{type:"string",description:"brightness için 0-100 yüzde, temperature için derece (°C). Diğer aksiyonlarda boş."},confirm:{type:"string",description:"Kritik cihaz onayı. Kullanıcı 'evet/onayla' dediyse \"true\" gönder; yoksa boş bırak."}},required:["target","action"],additionalProperties:false}}},
    {type:"function",function:{name:"smart_home_scene",description:"Bir akıllı ev sahnesini (scene) veya script'ini etkinleştir. 'Film modu', 'iyi geceler', 'sabah rutini' gibi önceden HA'da tanımlı sahneler.",parameters:{type:"object",properties:{name:{type:"string",description:"Sahne/script adı (örn: film modu, iyi geceler)"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"local_devices_scan",description:"Ev ağındaki (yerel WiFi/LAN) cihazları KEŞFET — Home Assistant GEREKMEZ. mDNS/Bonjour ve SSDP/UPnP yayınıyla Chromecast, akıllı TV, AirPlay, yazıcı, NAS, hoparlör, router gibi cihazları bulur. 'evdeki cihazları bul', 'ağda ne var', 'cihazları tara', 'yerel cihazlar' gibi isteklerde kullan.",parameters:{type:"object",properties:{duration_ms:{type:"string",description:"Tarama süresi ms (varsayılan 3000, 1000-6000 arası önerilir)"}},additionalProperties:false}}},
];

// ───────────────────────────────────────────────────────────── Faz 29 Schemas
export const multiModelSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"model_compare",description:"Aynı soruyu birden fazla modele gönder ve yanıtları karşılaştır.",parameters:{type:"object",properties:{prompt:{type:"string",description:"Karşılaştırılacak soru/görev"},models:{type:"string",description:"Karşılaştırılacak modeller virgülle (örn: groq:qwen3-32b,groq:llama-3.3-70b)"}},required:["prompt"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_run",description:"Adım adım prompt zinciri çalıştır. Her adımın çıktısı sonrakine aktarılır.",parameters:{type:"object",properties:{pipeline_name:{type:"string",description:"Kaydedilmiş pipeline adı"},input:{type:"string",description:"İlk adıma verilecek girdi"}},required:["pipeline_name","input"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_save",description:"Yeni prompt pipeline kaydet.",parameters:{type:"object",properties:{name:{type:"string",description:"Pipeline adı"},steps:{type:"string",description:"JSON array: [{\"prompt\":\"...\",\"model\":\"groq:qwen3-32b\"},{...}]"},description:{type:"string",description:"Pipeline açıklaması"}},required:["name","steps"],additionalProperties:false}}},
    {type:"function",function:{name:"pipeline_list",description:"Kaydedilmiş pipeline'ları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"model_route_set",description:"Görev türüne göre model yönlendirme kuralı ekle.",parameters:{type:"object",properties:{task_type:{type:"string",description:"Görev türü (örn: code, vision, fast, creative)"},model:{type:"string",description:"Kullanılacak model (örn: groq:qwen3-32b, openai:gpt-4o)"},description:{type:"string",description:"Kural açıklaması"}},required:["task_type","model"],additionalProperties:false}}},
    {type:"function",function:{name:"model_route_list",description:"Mevcut model yönlendirme kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Faz 35: Sesli Çeviri ─────────────────────────────────────────────────
    {type:"function",function:{name:"translation_start",description:"Gerçek zamanlı sesli çeviri modunu başlat. Kullanıcı konuştukça otomatik çeviri yapılır.",parameters:{type:"object",properties:{source_lang:{type:"string",description:"Kaynak dil kodu (tr, en, de, fr, es, ar, ru, zh...)"},target_lang:{type:"string",description:"Hedef dil kodu"}},required:["source_lang","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translation_stop",description:"Gerçek zamanlı çeviri modunu durdur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"translate_text",description:"Verilen metni hedef dile çevir.",parameters:{type:"object",properties:{text:{type:"string",description:"Çevrilecek metin"},target_lang:{type:"string",description:"Hedef dil kodu (tr, en, de, fr, es...)"},tone:{type:"string",enum:["formal","casual","technical"],description:"Çeviri tonu"}},required:["text","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"translate_file",description:".txt veya .md dosyasını hedef dile çevir.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Çevrilecek dosya yolu"},target_lang:{type:"string",description:"Hedef dil kodu"}},required:["file_path","target_lang"],additionalProperties:false}}},
    {type:"function",function:{name:"subtitle_toggle",description:"Ekran üstü altyazı overlay'ini aç veya kapat.",parameters:{type:"object",properties:{enable:{type:"boolean",description:"true=aç, false=kapat"}},required:["enable"],additionalProperties:false}}},

    // ── Faz 36: Bildirim Monitörü ────────────────────────────────────────────
    {type:"function",function:{name:"notification_recent",description:"Son N Windows bildirimini göster.",parameters:{type:"object",properties:{count:{type: "string",description:"Kaç bildirim (varsayılan 20, max 100)"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_history",description:"AEGIS'in kaydettiği bildirim geçmişini göster.",parameters:{type:"object",properties:{count:{type: "string",description:"Kaç bildirim gösterilsin"}},additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_set",description:"Belirli bir uygulamanın bildirimlerini göster veya gizle.",parameters:{type:"object",properties:{app:{type:"string",description:"Uygulama adı (örn: Spotify, WhatsApp, Teams)"},action:{type:"string",enum:["show","hide"],description:"show=göster, hide=gizle"}},required:["app","action"],additionalProperties:false}}},
    {type:"function",function:{name:"notification_filter_list",description:"Kayıtlı bildirim filtre kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"do_not_disturb",description:"Rahatsız etme modunu belirtilen dakika boyunca etkinleştir.",parameters:{type:"object",properties:{minutes:{type: "string",description:"DND süresi (dakika)"},off:{type:"boolean",description:"true ise DND'yi kapat"}},additionalProperties:false}}},

    // ── Faz 37: Kod Derleyici & Test Koşucusu ───────────────────────────────
    {type:"function",function:{name:"project_detect",description:"Klasördeki proje tipini tespit et (Node.js, Rust, Python, Go, Java vb.)",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"build_project",description:"Projeyi derle/build et. Hataları analiz eder ve öneriler sunar.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"run_tests",description:"Proje testlerini koştur. Sonuçları özetler.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"},test_file:{type:"string",description:"Belirli bir test dosyası (opsiyonel)"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"lint_project",description:"Proje lint kontrolü yap.",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},
    {type:"function",function:{name:"format_code",description:"Kodu otomatik formatla (prettier, black, rustfmt, gofmt).",parameters:{type:"object",properties:{dir:{type:"string",description:"Proje klasörü"}},required:["dir"],additionalProperties:false}}},

    // ── Faz 38: Haber & Fiyat Takibi ─────────────────────────────────────────
    {type:"function",function:{name:"rss_add",description:"RSS/Atom feed ekle.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL"},label:{type:"string",description:"Feed etiketi"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_remove",description:"Feed kaldır.",parameters:{type:"object",properties:{url:{type:"string",description:"Feed URL veya etiketi"}},required:["url"],additionalProperties:false}}},
    {type:"function",function:{name:"rss_list",description:"Kayıtlı feed'leri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"rss_fetch",description:"Kayıtlı feed'lerden son haberleri çek ve özetle.",parameters:{type:"object",properties:{count:{type: "string",description:"Toplam haber sayısı (varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"price_get",description:"Hisse senedi veya döviz fiyatı al (Yahoo Finance). Örn: AAPL, GOOG, BIST:THYAO",parameters:{type:"object",properties:{symbols:{type:"string",description:"Virgülle ayrılmış semboller (örn: AAPL,TSLA)"}},required:["symbols"],additionalProperties:false}}},
    {type:"function",function:{name:"crypto_price",description:"Kripto para fiyatı al (CoinGecko). USD ve TRY cinsinden.",parameters:{type:"object",properties:{coins:{type:"string",description:"Virgülle ayrılmış coin adları (örn: bitcoin,ethereum,solana)"}},required:["coins"],additionalProperties:false}}},
    {type:"function",function:{name:"fx_rate",description:"Döviz kuru al (exchangerate-api). Örn: USD/TRY, EUR/USD",parameters:{type:"object",properties:{pairs:{type:"string",description:"Virgülle ayrılmış döviz çiftleri (örn: USD/TRY,EUR/TRY)"}},required:["pairs"],additionalProperties:false}}},
    {type:"function",function:{name:"price_alert_set",description:"Fiyat aleti kur. Belirtilen fiyata ulaşınca bildirim gelir.",parameters:{type:"object",properties:{symbol:{type:"string",description:"Sembol (örn: bitcoin, AAPL, USD/TRY)"},type:{type:"string",enum:["crypto","stock","fx"]},above:{type: "string",description:"Bu fiyatın üstüne çıkarsa uyar"},below:{type: "string",description:"Bu fiyatın altına düşerse uyar"}},required:["symbol","type"],additionalProperties:false}}},

    // ── Faz 39: Sesli Toplantı Asistanı ─────────────────────────────────────
    {type:"function",function:{name:"meeting_start",description:"Toplantı kaydını başlat. Konuşmalar transkript edilir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_stop",description:"Toplantı kaydını durdur ve kaydet.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_list",description:"Kaydedilmiş toplantıları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_summarize",description:"Toplantıyı özetle: kararlar, eylem maddeleri, katılımcılar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID (boş bırakılırsa son toplantı)"}},additionalProperties:false}}},
    {type:"function",function:{name:"meeting_export",description:"Toplantıyı .md dosyası olarak dışa aktar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"meeting_action_items",description:"Toplantıdan eylem maddelerini çıkar.",parameters:{type:"object",properties:{id:{type:"string",description:"Toplantı ID"}},required:["id"],additionalProperties:false}}},

    // ── Faz 40: Bağlam-Duyarlı Eylemler ─────────────────────────────────────
    {type:"function",function:{name:"get_active_context",description:"Aktif uygulamayı ve bağlamı tespit et. Önerilen araçları göster.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_set",description:"Belirli bir uygulama açıkken özel öneri veya otomatik eylem tanımla.",parameters:{type:"object",properties:{app_pattern:{type:"string",description:"Uygulama adı veya pencere başlığında aranacak desen"},suggestion:{type:"string",description:"Öneri metni"},auto_action:{type:"string",description:"Otomatik çalıştırılacak araç (opsiyonel)"}},required:["app_pattern","suggestion"],additionalProperties:false}}},
    {type:"function",function:{name:"context_rule_list",description:"Bağlam kurallarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_watch",description:"Panodaki içeriği analiz et ve öneriler sun.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_history",description:"Pano geçmişini göster.",parameters:{type:"object",properties:{count:{type: "string",description:"Kaç giriş gösterilsin (varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"clipboard_search",description:"Pano geçmişinde arama yap.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak metin"}},required:["query"],additionalProperties:false}}},

    // ── Faz 41: Güçlü Yerel Arama ──────────────────────────────────────────
    {type:"function",function:{name:"file_search",description:"Dosya sisteminde dosya adına göre ara (Everything veya PowerShell).",parameters:{type:"object",properties:{query:{type:"string",description:"Dosya adı veya deseni"},dir:{type:"string",description:"Aranacak klasör (opsiyonel, varsayılan: ev dizini)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"content_search",description:"Klasördeki dosyaların içeriğinde metin ara. Satır numarasıyla sonuç döner.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak metin veya regex"},dir:{type:"string",description:"Aranacak klasör"},extension:{type:"string",description:"Dosya uzantısı filtresi (örn: ts, py, md)"}},required:["query","dir"],additionalProperties:false}}},
    {type:"function",function:{name:"app_search",description:"Uygulama ara ve gerekirse başlat. Fuzzy arama destekler.",parameters:{type:"object",properties:{query:{type:"string",description:"Uygulama adı (kısmi yazılabilir, örn: 'chr' için Chrome)"},launch:{type:"boolean",description:"true ise en iyi eşleşmeyi başlat"}},required:["query"],additionalProperties:false}}},

    // ── Faz 42: Sistem Optimizasyonu ─────────────────────────────────────────
    {type:"function",function:{name:"kill_heavy_process",description:"En fazla CPU/RAM tüketen prosesleri listele ve isteğe bağlı kapat.",parameters:{type:"object",properties:{top_n:{type: "string",description:"Kaç proses listele (varsayılan 3)"},confirm:{type:"boolean",description:"true ise prosesleri gerçekten kapat"}},additionalProperties:false}}},
    {type:"function",function:{name:"suspend_process",description:"Prosesin önceliğini Idle'a düşür (duraklatmaya benzer, RAM'den atmaz).",parameters:{type:"object",properties:{name:{type:"string",description:"Proses adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"resume_process",description:"Prosesin önceliğini Normal'e döndür.",parameters:{type:"object",properties:{name:{type:"string",description:"Proses adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"clear_temp",description:"Windows temp klasörlerini temizle ve boşaltılan alanı raporla.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"flush_dns",description:"DNS önbelleğini temizle.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"startup_manager",description:"Windows başlangıç uygulamalarını listele veya devre dışı bırak.",parameters:{type:"object",properties:{action:{type:"string",enum:["list","disable"],description:"list=listele, disable=devre dışı bırak"},name:{type:"string",description:"Devre dışı bırakılacak uygulama adı (disable için)"}},required:["action"],additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_start",description:"Performans modunu başlat: güç planı Yüksek Performans, arka plan uygulamaları yavaşlatılır.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"perf_mode_stop",description:"Performans modunu durdur, normal moda geri dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Faz 43: Workspace Sistemi ─────────────────────────────────────────────
    {type:"function",function:{name:"workspace_create",description:"İsimli çalışma alanı oluştur. Kendi system promptu, modeli ve geçmişiyle izole.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace adı"},description:{type:"string",description:"Workspace açıklaması"},system_prompt:{type:"string",description:"Bu workspace'e özel system prompt"},model:{type:"string",description:"Varsayılan model (örn: groq:qwen3-32b)"},working_dir:{type:"string",description:"Bu workspace'in çalışma dizini"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_switch",description:"Farklı bir workspace'e geç.",parameters:{type:"object",properties:{name:{type:"string",description:"Geçilecek workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_list",description:"Mevcut workspace'leri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"workspace_delete",description:"Workspace'i sil.",parameters:{type:"object",properties:{name:{type:"string",description:"Silinecek workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_export",description:"Workspace'i JSON dosyası olarak dışa aktar.",parameters:{type:"object",properties:{name:{type:"string",description:"Workspace adı"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"workspace_import",description:"JSON dosyasından workspace içe aktar.",parameters:{type:"object",properties:{file_path:{type:"string",description:"Export JSON dosyası yolu"}},required:["file_path"],additionalProperties:false}}},

    // ── Faz 44: Rapor & Analitik ──────────────────────────────────────────────
    {type:"function",function:{name:"daily_report",description:"Bugünkü aktivite raporunu oluştur: araç kullanımı, zaman takibi, hedef ilerlemesi.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"weekly_report",description:"Son 7 günün haftalık aktivite raporunu oluştur.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"productivity_insights",description:"Kişisel verimlilik analizi: güçlü yönler, gelişim alanları ve öneriler.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Faz 46: Spotify ──────────────────────────────────────────────────────────
export const spotifySchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"spotify_authorize",description:"Spotify hesabını AEGIS'e bağla (ilk kullanımda bir kez yapılır). Tarayıcıda Spotify login sayfası açılır.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play",description:"Spotify'da müziği başlat / devam ettir. Belirli bir şarkı/sanatçı istenirse 'query' ver (ör: 'play killshot', 'change it to X', 'X çal') → o şarkı aranıp çalınır. Boş bırakılırsa duraklatılmış müziği devam ettirir.",parameters:{type:"object",properties:{query:{type:"string",description:"İsteğe bağlı: çalınacak şarkı/sanatçı adı. Verilmezse mevcut müzik devam eder."}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_pause",description:"Spotify'da çalan müziği duraklat.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_next",description:"Spotify'da sonraki parçaya geç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_prev",description:"Spotify'da önceki parçaya dön.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_volume",description:"Spotify ses seviyesini ayarla (0-100). Örnek: 20",parameters:{type:"object",properties:{level:{type: "string",description:"Ses seviyesi 0-100 (rakam, örn: 50)"}},required:["level"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_now_playing",description:"Spotify'da şu an ne çaldığını göster (şarkı, sanatçı, albüm, süre).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_open",description:"Spotify uygulamasını aç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_search",description:"Spotify'da şarkı/sanatçı/albüm ara ve çal.",parameters:{type:"object",properties:{query:{type:"string",description:"Arama terimi (şarkı adı, sanatçı, albüm)"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlists",description:"Kullanıcının Spotify playlistlerini listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_play_playlist",description:"Belirtilen Spotify playlistini çal (ad veya ID ile).",parameters:{type:"object",properties:{name:{type:"string",description:"Playlist adı (kısmi eşleşir) veya Spotify playlist ID"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_like",description:"Şu an çalan şarkıyı beğen (Liked Songs'a ekle).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_queue",description:"Şarkıyı sıraya ekle.",parameters:{type:"object",properties:{query:{type:"string",description:"Sıraya eklenecek şarkı adı veya sanatçı"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_devices",description:"Mevcut Spotify cihazlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_transfer",description:"Müziği başka bir cihaza aktar (telefon, TV, bilgisayar).",parameters:{type:"object",properties:{device:{type:"string",description:"Cihaz adı veya ID"}},required:["device"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_shuffle",description:"Karıştır modunu aç/kapat.",parameters:{type:"object",properties:{enabled:{type:"boolean",description:"true = aç, false = kapat"}},required:["enabled"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_repeat",description:"Tekrar modunu ayarla.",parameters:{type:"object",properties:{mode:{type:"string",enum:["off","track","context"],description:"off=kapalı, track=şarkı tekrar, context=liste tekrar"}},required:["mode"],additionalProperties:false}}},

    // Player extras
    {type:"function",function:{name:"spotify_seek",description:"Çalan şarkıda belirli bir konuma git (milisaniye cinsinden).",parameters:{type:"object",properties:{position_ms:{type: "string",description:"Gidilecek konum (ms). Örnek: 60000 = 1. dakika"}},required:["position_ms"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_recently_played",description:"Son dinlenen şarkıları listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç şarkı (max 50, varsayılan 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_queue",description:"Spotify çalma kuyruğunu göster — şu an çalan + sıradaki şarkılar.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // Albums
    {type:"function",function:{name:"spotify_get_album",description:"Albüm detaylarını getir (ad, sanatçı, çıkış tarihi, şarkı sayısı). ID gerekir — isim verildiyse önce spotify_search ile ara.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify albüm ID'si. İsim varsa önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_album_tracks",description:"Albümdeki tüm şarkıları listele. ID gerekir — isim verildiyse önce spotify_search ile ara.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify albüm ID'si. İsim varsa önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_albums",description:"Kütüphanedeki kayıtlı albümleri listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç albüm (max 50, varsayılan 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_save_album",description:"Albümü kütüphaneye kaydet. ID gerekir — isim varsa önce spotify_search ile ara.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify albüm ID'si. İsim varsa önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_remove_album",description:"Albümü kütüphaneden kaldır. ID gerekir — isim varsa önce spotify_search ile ara.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify albüm ID'si. İsim varsa önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},

    // Artists
    {type:"function",function:{name:"spotify_get_artist",description:"Sanatçı bilgilerini getir (takipçi, popülerlik, türler). Sanatçı adı veya Spotify ID'si ile çalışır — isim verirsen otomatik arar.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı (ör: 'Radiohead') veya Spotify ID'si (22 karakter)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_artist_top_tracks",description:"Sanatçının en popüler şarkılarını listele. Sanatçı adı veya ID kabul eder — isim verince otomatik arar.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı (ör: 'Thom Yorke') veya Spotify ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_artist_albums",description:"Sanatçının albümlerini ve single'larını listele. Sanatçı adı veya ID kabul eder.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı veya Spotify ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_related_artists",description:"Bir sanatçıya benzer sanatçıları bul. Sanatçı adı veya ID kabul eder.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı veya Spotify ID'si"}},required:["id"],additionalProperties:false}}},

    // Tracks
    {type:"function",function:{name:"spotify_get_track",description:"Şarkı detaylarını getir (albüm, süre, popülerlik, URI). Şarkı ID'si gerekir — isim verildiyse önce spotify_search ile ara ve track_id al.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify şarkı ID'si. İsim verildiyse önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_audio_features",description:"Şarkının müzikal özelliklerini getir: tempo (BPM), enerji, neşe (valence), dans edilebilirlik, akustiklik, ton. Çalan şarkı için önce spotify_now_playing ile track_id al; belirli şarkı için önce spotify_search çağır.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify şarkı ID'si. Çalan şarkıysa önce spotify_now_playing, belirli şarkıysa önce spotify_search çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_recommendations",description:"Şarkı/sanatçı/tür tohumlarına göre öneriler üret. EN İYİ AKIŞ: önce spotify_recently_played veya spotify_now_playing ile track ID'leri al, seed_tracks'e virgülle ekle. Tür bazlı öneri için seed_genres kullan (ID gerektirmez). seed_artists+seed_tracks+seed_genres toplamı max 5 olmalı.",parameters:{type:"object",properties:{seed_artists:{type:"string",description:"Virgülle ayrılmış sanatçı ID'leri. ID yoksa spotify_search ile al."},seed_tracks:{type:"string",description:"Virgülle ayrılmış şarkı ID'leri. Son dinlenenler için önce spotify_recently_played çağır."},seed_genres:{type:"string",description:"Virgülle ayrılmış Spotify tür adları (ör: pop,rock,jazz,indie). ID gerektirmez, doğrudan kullan."},limit:{type: "string",description:"Öneri sayısı (max 20, varsayılan 10)"}},additionalProperties:false}}},

    // Playlists extended
    {type:"function",function:{name:"spotify_get_playlist",description:"Playlist detaylarını getir (sahibi, şarkı sayısı, URI). ID gerekir — kendi playlist'lerin için önce spotify_playlists çağır, yabancı playlist için önce spotify_search ile ara.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify playlist ID'si. Kendi playlist'lerin için önce spotify_playlists çağır."}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_tracks",description:"Playlist içindeki şarkıları listele. ID gerekir — kendi playlist'lerin için önce spotify_playlists çağır.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify playlist ID'si. Kendi playlist'lerin için önce spotify_playlists çağır."},limit:{type: "string",description:"Kaç şarkı (max 50, varsayılan 20)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_create_playlist",description:"Yeni Spotify playlist oluştur.",parameters:{type:"object",properties:{name:{type:"string",description:"Playlist adı"},public:{type:"boolean",description:"Herkese açık mı? (varsayılan false)"},description:{type:"string",description:"Playlist açıklaması"}},required:["name"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_add",description:"Playlist'e şarkı ekle (URI listesi ile).",parameters:{type:"object",properties:{playlist_id:{type:"string",description:"Spotify playlist ID'si"},uris:{type:"array",items:{type:"string"},description:"Eklenecek spotify:track:xxx URI'ları"}},required:["playlist_id","uris"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_playlist_remove",description:"Playlist'ten şarkı kaldır (URI listesi ile).",parameters:{type:"object",properties:{playlist_id:{type:"string",description:"Spotify playlist ID'si"},uris:{type:"array",items:{type:"string"},description:"Kaldırılacak spotify:track:xxx URI'ları"}},required:["playlist_id","uris"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_featured_playlists",description:"Spotify'ın öne çıkardığı/önerdiği playlistleri listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // Library
    {type:"function",function:{name:"spotify_saved_tracks",description:"Beğenilen (Liked Songs) şarkıları listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç şarkı (max 50, varsayılan 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_check_saved_tracks",description:"Belirtilen şarkıların beğenilmiş olup olmadığını kontrol et.",parameters:{type:"object",properties:{ids:{type:"array",items:{type:"string"},description:"Şarkı ID listesi"}},required:["ids"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_shows",description:"Kütüphanedeki kayıtlı podcastleri listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç podcast (varsayılan 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_episodes",description:"Kütüphanedeki kayıtlı podcast bölümlerini listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç bölüm (varsayılan 20)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_saved_audiobooks",description:"Kütüphanedeki kayıtlı sesli kitapları listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç sesli kitap (varsayılan 20)"}},additionalProperties:false}}},

    // User
    {type:"function",function:{name:"spotify_me",description:"Bağlı Spotify hesabının profil bilgilerini getir (ad, e-posta, ülke, plan, takipçi).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_top_items",description:"En çok dinlenen sanatçıları veya şarkıları getir.",parameters:{type:"object",properties:{type:{type:"string",enum:["artists","tracks"],description:"artists = sanatçılar, tracks = şarkılar"},time_range:{type:"string",enum:["short_term","medium_term","long_term"],description:"short_term=son 4 hafta, medium_term=son 6 ay, long_term=tüm zamanlar"},limit:{type: "string",description:"Kaç sonuç (max 50, varsayılan 10)"}},required:["type"],additionalProperties:false}}},

    // Follow
    {type:"function",function:{name:"spotify_follow_artist",description:"Bir sanatçıyı takip et. Sanatçı adı veya Spotify ID'si ile çalışır — isim verince otomatik arar.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı (ör: 'Portishead') veya Spotify ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_unfollow_artist",description:"Bir sanatçıyı takipten çıkar. Sanatçı adı veya Spotify ID'si kabul eder.",parameters:{type:"object",properties:{id:{type:"string",description:"Sanatçı adı veya Spotify ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_followed_artists",description:"Takip edilen sanatçıları listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç sanatçı (max 50, varsayılan 20)"}},additionalProperties:false}}},

    // Browse
    {type:"function",function:{name:"spotify_new_releases",description:"Spotify'daki yeni çıkan albüm ve single'ları listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç sonuç (max 50, varsayılan 10)"}},additionalProperties:false}}},
    {type:"function",function:{name:"spotify_categories",description:"Spotify müzik kategorilerini (türlerini) listele.",parameters:{type:"object",properties:{limit:{type: "string",description:"Kaç kategori (max 50, varsayılan 20)"}},additionalProperties:false}}},

    // Shows / Episodes / Audiobooks
    {type:"function",function:{name:"spotify_get_show",description:"Podcast detaylarını getir.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify show/podcast ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_show_episodes",description:"Bir podcast'in bölümlerini listele.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify show/podcast ID'si"},limit:{type: "string",description:"Kaç bölüm (max 50, varsayılan 10)"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_episode",description:"Podcast bölümü detaylarını getir.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify episode ID'si"}},required:["id"],additionalProperties:false}}},
    {type:"function",function:{name:"spotify_get_audiobook",description:"Sesli kitap detaylarını getir.",parameters:{type:"object",properties:{id:{type:"string",description:"Spotify audiobook ID'si"}},required:["id"],additionalProperties:false}}},
];

// ── Faz 46: Steam ────────────────────────────────────────────────────────────
export const steamSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"steam_launch",description:"Steam oyunu başlat. Kullanıcı bir Steam oyunu açmak istediğinde DAIMA bu tool'u kullan, run_command KULLANMA. Oyun adı veya AppID ver. Steam kapalıysa açar.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı (ör: 'Cyberpunk 2077', 'Dead by Daylight', 'dbd') veya Steam AppID (ör: '1091500')"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list",description:"Bilgisayarda yüklü Steam oyunlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open",description:"Steam uygulamasını aç ve öne getir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_close",description:"Steam'i kapat.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_running",description:"Şu an Steam üzerinden çalışan oyun var mı, varsa hangisi?",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Grup A: Local / steam:// protokolü (key gerekmez) ──
    {type:"function",function:{name:"steam_restart",description:"Steam'i yeniden başlat (kapat, tekrar aç).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_close_game",description:"Şu an çalışan Steam oyununu kapat.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı (opsiyonel; verilmezse çalışan oyunu kapatır)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_restart_game",description:"Bir Steam oyununu kapatıp tekrar başlat.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list_running_games",description:"Şu an çalışan tüm Steam oyunlarını listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_is_game_running",description:"Belirli bir oyunun şu an açık olup olmadığını kontrol et.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_install_game",description:"Bir Steam oyununun kurulumunu başlat (Steam kurulum penceresini açar).",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_uninstall_game",description:"Bir Steam oyununu kaldır (Steam kaldırma penceresini açar).",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_verify_game_files",description:"Bir oyunun dosya bütünlüğünü doğrula (Steam validate).",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_update_game",description:"Bir oyunun güncellemesini kontrol et / başlat.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_download_status",description:"Steam'de aktif indirme/güncelleme var mı göster ve indirme yöneticisini aç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_store_page",description:"Bir oyunun Steam mağaza sayfasını aç.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_screenshots",description:"Steam ekran görüntüleri yöneticisini aç.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_show_storage_usage",description:"Yüklü Steam oyunlarının disk kullanımını göster (en büyükten).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_locate_installation",description:"Bir oyunun kurulu olduğu klasör yolunu göster.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_game_folder",description:"Bir oyunun kurulum klasörünü Gezgin'de aç.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_last_played_game",description:"En son oynanan oyunu getir (Web API).",parameters:{type:"object",properties:{},additionalProperties:false}}},

    // ── Grup C: Storefront (key gerekmez) ──
    {type:"function",function:{name:"steam_search_store",description:"Steam mağazasında oyun ara.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak oyun adı"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_details",description:"Bir oyunun mağaza detaylarını getir (açıklama, tür, çıkış, fiyat).",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_price",description:"Bir oyunun güncel mağaza fiyatını/indirimini getir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_discounted_games",description:"Steam mağazasında öne çıkan indirimli oyunları listele.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_news",description:"Bir oyunun son haberlerini getir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},

    // ── Grup B: Web API (Steam API key + SteamID64 gerekir) ──
    {type:"function",function:{name:"steam_owned_games",description:"Sahip olunan tüm Steam oyunlarını oynama süresiyle listele. Steam API key + SteamID gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_search_owned_games",description:"Kütüphanede isimle oyun ara. Steam API key gerekir.",parameters:{type:"object",properties:{query:{type:"string",description:"Aranacak oyun adı"}},required:["query"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_recent_games",description:"Son 2 haftada oynanan oyunları getir. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_most_played_games",description:"En çok oynanan oyunları getir. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_playtime",description:"Bir oyunun toplam oynanma süresini getir. Steam API key gerekir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_total_playtime",description:"Tüm oyunlardaki toplam Steam oynama süresini hesapla. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_suggest_game",description:"Kütüphaneye göre oynanacak bir oyun öner. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_game_achievements",description:"Bir oyunun başarımlarını ve hangilerinin açık olduğunu getir. Steam API key gerekir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_achievement_progress",description:"Bir oyunun başarım ilerlemesini yüzdeyle göster. Steam API key gerekir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_player_stats",description:"Bir oyundaki oyuncu istatistiklerini getir. Steam API key gerekir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_profile_summary",description:"Steam profil özetini getir (ad, durum, oynanan oyun). Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_level",description:"Steam seviyeni getir. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_friend_list",description:"Steam arkadaş listeni getir. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_online_friends",description:"Çevrimiçi Steam arkadaşlarını listele. Steam API key gerekir.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_friend_current_game",description:"Bir arkadaşın şu an oynadığı oyunu göster. Steam API key gerekir.",parameters:{type:"object",properties:{friend:{type:"string",description:"Arkadaş adı veya SteamID64"}},required:["friend"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_who_is_playing",description:"Belirli bir oyunu oynayan arkadaşları listele. Steam API key gerekir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı"}},required:["game"],additionalProperties:false}}},

    // ── Grup D: Deneysel — Steam dışarıdan tam kontrol vermez, sayfa/diyalog açar ──
    {type:"function",function:{name:"steam_wishlist_add",description:"[DENEYSEL] Bir oyunu istek listesine ekle. Mağaza sayfasını açar ve computer-use ile '+ İstek Listesine Ekle' butonuna otomatik tıklamayı dener (Steam sessiz API vermediği için). Kırılgandır; başarısızsa sayfa açık kalır, elle eklenebilir.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_wishlist_remove",description:"[DENEYSEL] Bir oyunu istek listesinden çıkar. Mağaza sayfasını açar.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_wishlist_list",description:"[DENEYSEL] İstek listeni göster (profil herkese açıksa).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_pause_download",description:"[DENEYSEL] İndirmeyi duraklat — indirme yöneticisini açar (Steam dışarıdan tekil kontrol vermez).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_resume_download",description:"[DENEYSEL] İndirmeyi devam ettir — indirme yöneticisini açar.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_cancel_download",description:"[DENEYSEL] İndirmeyi iptal et — indirme yöneticisini açar.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_workshop",description:"[DENEYSEL] Bir oyunun Steam Workshop sayfasını aç.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID (opsiyonel)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_subscribe_workshop",description:"[DENEYSEL] Bir workshop öğesine abone ol — öğe sayfasını açar.",parameters:{type:"object",properties:{item_id:{type:"string",description:"Workshop öğe ID'si"}},required:["item_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_unsubscribe_workshop",description:"[DENEYSEL] Bir workshop aboneliğini kaldır — öğe sayfasını açar.",parameters:{type:"object",properties:{item_id:{type:"string",description:"Workshop öğe ID'si"}},required:["item_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_list_workshop_subscriptions",description:"[DENEYSEL] Yerel olarak indirilmiş workshop aboneliklerini listele.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı/AppID (opsiyonel filtre)"}},additionalProperties:false}}},
    {type:"function",function:{name:"steam_open_chat",description:"[DENEYSEL] Bir arkadaşla Steam sohbet penceresini aç.",parameters:{type:"object",properties:{friend_id:{type:"string",description:"Arkadaşın SteamID64'ü"}},required:["friend_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_send_message",description:"[DENEYSEL] Bir arkadaşa mesaj — sohbet penceresini açar (Steam dışarıdan otomatik mesaj göndermez).",parameters:{type:"object",properties:{friend_id:{type:"string",description:"Arkadaşın SteamID64'ü"},message:{type:"string",description:"Mesaj metni"}},required:["friend_id"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_backup_game",description:"[DENEYSEL] Bir oyunun yedeğini oluştur — Steam yedekleme sihirbazını açar.",parameters:{type:"object",properties:{game:{type:"string",description:"Oyun adı veya AppID"}},required:["game"],additionalProperties:false}}},
    {type:"function",function:{name:"steam_restore_backup",description:"[DENEYSEL] Bir Steam yedeğini geri yükle — Steam'i açar (geri yükleme menüden yapılır).",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_take_screenshot",description:"[DENEYSEL] Steam ekran görüntüsü al (oyun içi F12). Genel ekran görüntüsü için 'ekran görüntüsü al' tool'unu tercih et.",parameters:{type:"object",properties:{},additionalProperties:false}}},
    {type:"function",function:{name:"steam_repeat_last_action",description:"[DENEYSEL] En son yapılan Steam işlemini tekrarla.",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

// ── Faz 47: Computer Use ─────────────────────────────────────────────────
export const computerUseSchemas: ChatCompletionTool[] = [
    {type:"function",function:{name:"mouse_move",description:"Fare imlecini ekranda (x,y) koordinatına taşı.",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_click",description:"Fare tıklaması yap. Tıklamadan önce otomatik o konuma gider. button: left/right/middle. double: çift tıklama.",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"},button:{type:"string",enum:["left","right","middle"]},double:{type:"boolean"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_scroll",description:"Fare tekerleği ile kaydır. direction: up/down. amount: kaç adım (varsayılan 3).",parameters:{type:"object",properties:{x:{type: "string"},y:{type: "string"},direction:{type:"string",enum:["up","down"]},amount:{type: "string"}},required:["x","y"],additionalProperties:false}}},
    {type:"function",function:{name:"mouse_drag",description:"Bir noktadan diğerine sürükle bırak.",parameters:{type:"object",properties:{x1:{type: "string"},y1:{type: "string"},x2:{type: "string"},y2:{type: "string"}},required:["x1","y1","x2","y2"],additionalProperties:false}}},
    {type:"function",function:{name:"key_press",description:"Klavye tuşuna veya kısayoluna bas. Örnekler: 'ctrl+c', 'alt+tab', 'win+d', 'enter', 'esc', 'f5'.",parameters:{type:"object",properties:{keys:{type:"string",description:"Tuş kombinasyonu, '+' ile ayır (ör: 'ctrl+shift+t')"}},required:["keys"],additionalProperties:false}}},
    {type:"function",function:{name:"type_text",description:"Aktif alana metin yaz (klavyeden yazılıyormuş gibi).",parameters:{type:"object",properties:{text:{type:"string",description:"Yazılacak metin"}},required:["text"],additionalProperties:false}}},
    {type:"function",function:{name:"computer_use",description:"Ekran görüntüsü alıp AI ile analiz ederek hedefi gerçekleştir. Mouse+klavye ile bilgisayarı kullanır. 'Spotify'da şu şarkıyı çal', 'Chrome'da şu siteyi aç', 'Şu dosyayı bul ve sil' gibi serbest komutlar.",parameters:{type:"object",properties:{goal:{type:"string",description:"Ne yapmak istediğin (serbest dil, ör: 'Chrome aç ve youtube.com git')"},max_steps:{type: "string",description:"Maksimum adım sayısı (varsayılan 10)"}},required:["goal"],additionalProperties:false}}},
    {type:"function",function:{name:"screen_size",description:"Ekran çözünürlüğünü öğren (mouse_click koordinatları için gerekebilir).",parameters:{type:"object",properties:{},additionalProperties:false}}},
];

export const extraSchemas: ChatCompletionTool[] = [];
