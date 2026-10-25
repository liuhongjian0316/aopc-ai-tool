const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("petHost", {
  onInit: (fn) => ipcRenderer.on("pet:init", (_e, payload) => fn(payload)),
  onState: (fn) => ipcRenderer.on("pet:state", (_e, payload) => fn(payload)),
  onDisplays: (fn) => ipcRenderer.on("pet:displays", (_e, payload) => fn(payload)),
  onPosition: (fn) => ipcRenderer.on("pet:position", (_e, payload) => fn(payload)),
  onThrow: (fn) => ipcRenderer.on("pet:throw", (_e, payload) => fn(payload)),
  onImpulse: (fn) => ipcRenderer.on("pet:impulse", (_e, payload) => fn(payload)),
  onFace: (fn) => ipcRenderer.on("pet:face", (_e, payload) => fn(payload)),
  pos: (x, y) => ipcRenderer.send("pet:pos", { x, y }),
  pose: (payload) => ipcRenderer.send("pet:pose", payload),
  cursor: (inside) => ipcRenderer.send("pet:cursor", { inside }),
  openMenu: () => ipcRenderer.send("pet:menu"),
  playback: (payload) => ipcRenderer.send("pet:playback", payload),
  animEnded: (name) => ipcRenderer.send("pet:anim-ended", { name }),
});
