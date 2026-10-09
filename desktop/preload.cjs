const { contextBridge, ipcRenderer } = require("electron");
// No raw IPC, filesystem, process or arbitrary engine operations cross this bridge.
contextBridge.exposeInMainWorld(
  "hoiDesktop",
  Object.freeze({
    setup: () => ipcRenderer.invoke("hoi-desktop", { action: "setup" }),
    status: () => ipcRenderer.invoke("hoi-desktop", { action: "status" }),
    createWorkspace: () =>
      ipcRenderer.invoke("hoi-desktop", { action: "create-workspace" }),
    openWorkspace: () =>
      ipcRenderer.invoke("hoi-desktop", { action: "open-workspace" }),
    restart: () => ipcRenderer.invoke("hoi-desktop", { action: "restart" }),
    stop: () => ipcRenderer.invoke("hoi-desktop", { action: "stop" }),
    home: () => ipcRenderer.invoke("hoi-desktop", { action: "home" }),
    upgradeCopy: () =>
      ipcRenderer.invoke("hoi-desktop", { action: "upgrade-copy" }),
    chooseSourceFolder: () =>
      ipcRenderer.invoke("hoi-desktop", { action: "choose-source-folder" }),
  }),
);
