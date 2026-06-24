// Minimal Electron mock — lets us test files that import the electron module
// without running real Electron in the test environment.
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
