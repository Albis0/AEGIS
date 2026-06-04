import type {LangStrings} from "../../i18n";

const LABELS: Record<string, Record<string, string>> = {
    tr: {
        run_command: "KOMUT YÜRÜTÜLÜYOR", read_file: "DOSYA OKUNUYOR",
        write_file: "DOSYA YAZILIYOR", list_directory: "DİZİN TARANIYOR",
        web_search: "AĞ TARANIYOR", delete_file: "DOSYA SİLİNİYOR",
        move_file: "DOSYA TAŞINIYOR", get_system_info: "SİSTEM BİLGİSİ",
        get_weather: "HAVA DURUMU",
        spotify_play: "SPOTİFY OYNAT", spotify_pause: "SPOTİFY DURDUR",
        spotify_next: "SPOTİFY SONRAKİ", spotify_prev: "SPOTİFY ÖNCEKİ",
        spotify_volume: "SPOTİFY SES", spotify_now_playing: "SPOTİFY DURUM",
        spotify_open: "SPOTİFY AÇ", spotify_search: "SPOTİFY ARA",
        steam_launch: "STEAM OYUN BAŞLAT", steam_list: "STEAM OYUN LİSTESİ",
        steam_open: "STEAM AÇ", steam_close: "STEAM KAPAT",
        steam_game_running: "STEAM OYUN DURUMU",
        mouse_move: "FARE TAŞI", mouse_click: "FARE TIKLA",
        mouse_scroll: "FARE KAYDIR", mouse_drag: "FARE SÜRÜKLE",
        key_press: "KLAVYE TUŞLA", type_text: "METİN YAZ",
        screen_size: "EKRAN BOYUTU", computer_use: "BİLGİSAYAR KULLAN",
    },
    en: {
        run_command: "RUNNING COMMAND", read_file: "READING FILE",
        write_file: "WRITING FILE", list_directory: "LISTING DIR",
        web_search: "SEARCHING WEB", delete_file: "DELETING FILE",
        move_file: "MOVING FILE", get_system_info: "SYSTEM INFO",
        get_weather: "WEATHER",
        spotify_play: "SPOTIFY PLAY", spotify_pause: "SPOTIFY PAUSE",
        spotify_next: "SPOTIFY NEXT", spotify_prev: "SPOTIFY PREV",
        spotify_volume: "SPOTIFY VOLUME", spotify_now_playing: "SPOTIFY STATUS",
        spotify_open: "SPOTIFY OPEN", spotify_search: "SPOTIFY SEARCH",
        steam_launch: "STEAM LAUNCH", steam_list: "STEAM LIST",
        steam_open: "STEAM OPEN", steam_close: "STEAM CLOSE",
        steam_game_running: "STEAM GAME STATUS",
        mouse_move: "MOUSE MOVE", mouse_click: "MOUSE CLICK",
        mouse_scroll: "MOUSE SCROLL", mouse_drag: "MOUSE DRAG",
        key_press: "KEY PRESS", type_text: "TYPE TEXT",
        screen_size: "SCREEN SIZE", computer_use: "COMPUTER USE",
    },
};

export function toolLabel(name: string, t: LangStrings): string {
    const lang = t.locale.startsWith("tr") ? "tr" : "en";
    return LABELS[lang]?.[name] ?? name.replace(/_/g, " ").toUpperCase();
}
