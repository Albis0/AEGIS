// Güncelleme toast'ının durum makinesi — App.tsx ve testler ortak kullanır.
// İndirme MANUEL: 'available' -> kullanıcı indir -> 'downloading'(+percent) -> 'ready'.
// Hata her aşamada 'downloading'i durdurur ve görünür hale getirir (sessiz takılma yok).

export interface UpdateState {
    version?: string;
    ready: boolean;
    downloading?: boolean;
    percent?: number;
    error?: string;
}

export type UpdateEvent =
    | {type: "available"; version: string}
    | {type: "start-download"}        // kullanıcı "indir"e bastı
    | {type: "progress"; percent: number}
    | {type: "downloaded"; version?: string}
    | {type: "error"; message: string}
    | {type: "retry"};

export function updateReducer(state: UpdateState | null, ev: UpdateEvent): UpdateState | null {
    switch (ev.type) {
        case "available":
            return {version: ev.version, ready: false, downloading: false};
        case "start-download":
            return state ? {...state, downloading: true, percent: 0, error: undefined} : state;
        case "progress":
            // ready olduktan sonra gelen progress'i yoksay
            return state && !state.ready
                ? {...state, downloading: true, percent: Math.round(ev.percent), error: undefined}
                : state;
        case "downloaded":
            return {version: ev.version ?? state?.version, ready: true, downloading: false, percent: 100};
        case "error":
            // indirmeyi durdur, hatayı göster — "indiriliyor…" sonsuza kalmasın
            return state ? {...state, downloading: false, error: ev.message} : state;
        case "retry":
            return state ? {...state, error: undefined, downloading: true, percent: 0} : state;
        default:
            return state;
    }
}
