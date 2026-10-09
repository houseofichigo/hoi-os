const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  shell,
  Menu,
} = require("electron");
const { fork } = require("node:child_process");
const {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} = require("node:fs");
const { join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const {
  validateAction,
  trustedURL,
  allowedNavigation,
  safeAsset,
} = require("./boundary.cjs");
const cliIndex = process.argv.indexOf("--hoi-cli");
if (cliIndex >= 0) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  const cli = fork(
    join(__dirname, "../bin/hoi.mjs"),
    process.argv.slice(cliIndex + 1),
    { execPath: process.execPath, execArgv: [], env, stdio: "inherit" },
  );
  cli.on("exit", (code) => app.exit(code || 0));
  cli.on("error", () => app.exit(1));
} else {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "hoi",
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
  app.enableSandbox();
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : null;
  };
  if (arg("--hoi-profile"))
    app.setPath("userData", resolve(arg("--hoi-profile")));
  let win,
    child,
    origin = null,
    url = null,
    workspace = null,
    quitting = false,
    busy = false;
  let state = { state: "stopped", error: null, schema: null };
  let exitPromise = Promise.resolve();
  const setupURL = "hoi://desktop/index.html";
  const profile = () => join(app.getPath("userData"), "desktop.json");
  function persist() {
    mkdirSync(app.getPath("userData"), { recursive: true, mode: 0o700 });
    writeFileSync(profile(), JSON.stringify({ workspace }), { mode: 0o600 });
  }
  function status() {
    return {
      ...state,
      workspace,
      version: app.getVersion(),
      packaged: app.isPackaged,
    };
  }
  async function stop() {
    if (!child) return;
    state = { ...state, state: "stopping" };
    const c = child;
    if (c.connected) c.send({ type: "stop" });
    await exitPromise;
    origin = null;
    url = null;
    state = { state: "stopped", error: null, schema: state.schema };
  }
  async function launch(path, extra = {}) {
    await stop();
    workspace = resolve(path);
    state = { state: "starting", error: null, schema: null };
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
    delete env.NODE_OPTIONS;
    delete env.NODE_PATH;
    delete env.ELECTRON_EXTRA_LAUNCH_ARGS;
    const c = fork(join(__dirname, "engine-entry.cjs"), [], {
      execPath: process.execPath,
      execArgv: [],
      env,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    child = c;
    exitPromise = new Promise((ok) =>
      c.once("exit", () => {
        if (child === c) {
          child = null;
          origin = null;
          url = null;
          if (!["stopping", "stopped", "needs-upgrade"].includes(state.state)) {
            state = {
              ...state,
              state: "failed",
              error:
                "ENGINE_STOPPED: Restart the engine. If a stale lock remains, use explicit recovery.",
            };
            if (win && !win.isDestroyed()) void win.loadURL(setupURL);
          }
        }
        ok();
      }),
    );
    await new Promise((ok, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            Error("ENGINE_START_TIMEOUT: Engine startup exceeded two minutes"),
          ),
        120000,
      );
      c.once("exit", () => {
        clearTimeout(timer);
        reject(
          Error(
            "ENGINE_STOPPED: Engine exited during startup. Reinstall or inspect workspace health.",
          ),
        );
      });
      c.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      c.on("message", (m) => {
        if (!["ready", "error", "needs-upgrade"].includes(m.type)) return;
        clearTimeout(timer);
        if (m.type === "error") {
          state = { state: "failed", error: m.message, schema: null };
          reject(Error(m.message));
          return;
        }
        if (m.type === "needs-upgrade") {
          state = {
            state: "needs-upgrade",
            error: `Schema ${m.schema} requires an upgraded copy for schema ${m.currentSchema}. Your current workspace will remain unchanged.`,
            schema: m.schema,
          };
          ok();
          return;
        }
        workspace = m.workspace;
        url = m.url;
        origin = new URL(url).origin;
        state = { state: "running", error: null, schema: m.schema };
        persist();
        ok();
      });
      c.send({ type: "start", workspace, ...extra });
    });
    if (state.state === "running") await win.loadURL(url);
    else await win.loadURL(setupURL);
  }
  function ipcAllowed(e) {
    return (
      win &&
      !win.isDestroyed() &&
      e.sender === win.webContents &&
      e.senderFrame === win.webContents.mainFrame &&
      trustedURL(e.senderFrame.url, origin)
    );
  }
  async function choose(action) {
    if (action === "create-workspace") {
      const r = await dialog.showSaveDialog(win, {
        title: "Create a private HOI workspace",
        defaultPath: join(app.getPath("documents"), "HOI Workspace"),
        buttonLabel: "Create workspace",
        properties: ["createDirectory"],
      });
      if (!r.canceled && r.filePath) await launch(r.filePath, { create: true });
    } else {
      const r = await dialog.showOpenDialog(win, {
        title:
          action === "choose-source-folder"
            ? "Select a read-only source folder"
            : "Open a private HOI workspace",
        properties: ["openDirectory"],
      });
      if (r.canceled) return null;
      if (action === "choose-source-folder") return r.filePaths[0];
      await launch(r.filePaths[0]);
    }
    return status();
  }
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });
    app.whenReady().then(async () => {
      const ses = session.fromPartition("hoi-desktop");
      ses.protocol.handle("hoi", (request) => {
        try {
          return net.fetch(
            pathToFileURL(safeAsset(request.url, __dirname)).href,
          );
        } catch {
          return new Response("Unavailable", { status: 404 });
        }
      });
      ses.setPermissionRequestHandler((_w, _p, cb) => cb(false));
      ses.setPermissionCheckHandler(() => false);
      ses.webRequest.onBeforeRequest((details, cb) => {
        let allow = false;
        try {
          const u = new URL(details.url);
          allow =
            (u.protocol === "hoi:" && u.host === "desktop") ||
            (origin && u.origin === origin) ||
            ["blob:", "data:", "devtools:"].includes(u.protocol);
        } catch {}
        cb({ cancel: !allow });
      });
      win = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 640,
        minHeight: 480,
        title: "House of Ichigo — workspace",
        webPreferences: {
          preload: join(__dirname, "preload.cjs"),
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          webviewTag: false,
          partition: "hoi-desktop",
        },
      });
      win.webContents.on("will-navigate", (e, target) => {
        if (!allowedNavigation(target, origin)) e.preventDefault();
      });
      win.webContents.on("will-frame-navigate", (e) => {
        if (!allowedNavigation(e.url, origin)) e.preventDefault();
      });
      win.webContents.on("will-attach-webview", (e) => e.preventDefault());
      win.webContents.setWindowOpenHandler(({ url: target }) => {
        try {
          const u = new URL(target);
          if (
            u.origin === "https://accounts.google.com" &&
            u.pathname === "/o/oauth2/v2/auth"
          )
            void shell.openExternal(u.href);
        } catch {}
        return { action: "deny" };
      });
      win.webContents.on("render-process-gone", () => {
        state.error = "RENDERER_STOPPED: Reopen Home or restart the engine.";
        void win.loadURL(setupURL);
      });
      ipcMain.handle("hoi-desktop", async (e, input) => {
        if (!ipcAllowed(e)) throw Error("DESKTOP_SENDER_DENIED");
        const action = validateAction(input);
        if (action === "status") return status();
        if (busy) throw Error("DESKTOP_BUSY: Wait for the current operation");
        busy = true;
        try {
          if (
            [
              "create-workspace",
              "open-workspace",
              "choose-source-folder",
            ].includes(action)
          )
            return await choose(action);
          if (action === "setup") await win.loadURL(setupURL);
          if (action === "restart") {
            if (!workspace) throw Error("Choose a workspace first");
            await launch(workspace);
          }
          if (action === "stop") {
            await stop();
            await win.loadURL(setupURL);
          }
          if (action === "home") {
            if (url) await win.loadURL(url);
            else await win.loadURL(setupURL);
          }
          if (action === "upgrade-copy") {
            if (state.state !== "needs-upgrade" || !workspace)
              throw Error("UPGRADE_NOT_REQUIRED");
            const r = await dialog.showSaveDialog(win, {
              title: "Create an upgraded workspace copy",
              defaultPath: workspace + " upgraded",
              buttonLabel: "Back up and create copy",
            });
            if (!r.canceled && r.filePath) {
              const backupPath = join(
                app.getPath("userData"),
                "backups",
                randomUUID(),
              );
              await launch(workspace, {
                upgradeDestination: resolve(r.filePath),
                backupPath,
              });
            }
          }
          return status();
        } catch (e) {
          state.error = e.message;
          await win.loadURL(setupURL);
          throw e;
        } finally {
          busy = false;
        }
      });
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === "darwin"
            ? [
                {
                  label: "House of Ichigo",
                  submenu: [{ role: "about" }, { role: "quit" }],
                },
              ]
            : []),
          {
            label: "Workspace",
            submenu: [
              {
                label: "Workspace and engine status",
                click: () => win.loadURL(setupURL),
              },
              {
                label: "Open Home",
                click: () => (url ? win.loadURL(url) : win.loadURL(setupURL)),
              },
              { type: "separator" },
              { role: "quit" },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]),
      );
      await win.loadURL(setupURL);
      let selected = arg("--workspace");
      if (!selected && existsSync(profile())) {
        try {
          selected = JSON.parse(readFileSync(profile(), "utf8")).workspace;
        } catch {}
      }
      if (selected)
        try {
          await launch(selected);
        } catch (e) {
          state = { ...state, state: "failed", error: e.message };
          await win.loadURL(setupURL);
        }
    });
    app.on("window-all-closed", () => app.quit());
    app.on("before-quit", (e) => {
      if (quitting) return;
      e.preventDefault();
      quitting = true;
      void stop()
        .then(() => app.quit())
        .catch((error) => {
          quitting = false;
          state.error = error.message;
        });
    });
  }
}
