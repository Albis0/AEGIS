// Minimal Electron mock — test ortamında gerçek Electron çalıştırmadan
// electron modülünü import eden dosyaları test etmek için.
export const app = {
    getPath: (_name: string) => "/tmp/aegis-test",
    quit: () => {},
    on: () => {},
};
export const ipcMain = {
    handle: () => {},
    on: () => {},
};
export const BrowserWindow = class {};
export const shell = {openPath: async () => "", openExternal: async () => {}};
export const Notification = class {
    constructor() {}
    show() {}
    static isSupported() { return false; }
};
export const desktopCapturer = {getSources: async () => []};
export const screen = {getCursorScreenPoint: () => ({x: 0, y: 0})};
export const Tray = class {
    constructor() {}
    setToolTip() {}
    setContextMenu() {}
};
export const Menu = {buildFromTemplate: () => ({})};
export const nativeImage = {createFromPath: () => ({}), createEmpty: () => ({})};
