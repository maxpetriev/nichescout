import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { runAgent } from '../../lib/agent'
import type { AgentEvent } from '../../lib/types'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F5F5F7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('closed', () => { mainWindow = null })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Credentials (stored via Electron safeStorage) ─────────────────────────────

import { safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'

const CREDS_PATH = path.join(app.getPath('userData'), 'credentials.enc')

ipcMain.handle('creds:save', async (_, creds: { x: { username: string; password: string }; reddit: { username: string; password: string } }) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Encryption not available')
  const enc = safeStorage.encryptString(JSON.stringify(creds))
  fs.writeFileSync(CREDS_PATH, enc)
  // Also set env vars for the agent
  process.env.X_USERNAME = creds.x.username
  process.env.X_PASSWORD = creds.x.password
  return { ok: true }
})

ipcMain.handle('creds:get', async () => {
  if (!fs.existsSync(CREDS_PATH)) return null
  try {
    const enc = fs.readFileSync(CREDS_PATH)
    const json = safeStorage.decryptString(enc)
    const creds = JSON.parse(json)
    // Restore env vars
    process.env.X_USERNAME = creds.x.username
    process.env.X_PASSWORD = creds.x.password
    return creds
  } catch {
    return null
  }
})

ipcMain.handle('creds:has', async () => {
  return fs.existsSync(CREDS_PATH)
})

// ── History ───────────────────────────────────────────────────────────────────

const RESULTS_DIR = path.join(app.getPath('userData'), 'results')

ipcMain.handle('history:list', async () => {
  if (!fs.existsSync(RESULTS_DIR)) return []
  return fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort().reverse()
    .flatMap(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'))
        const ts = parseInt(f.replace('.json', ''))
        return [{ id: f.replace('.json', ''), prompt: data.prompt, date: new Date(ts).toLocaleString(), confidence: data.hypothesis?.confidence ?? 'medium' }]
      } catch { return [] }
    })
})

ipcMain.handle('history:get', async (_, id: string) => {
  const filePath = path.join(RESULTS_DIR, `${id}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
})

// ── Research ──────────────────────────────────────────────────────────────────

let researchRunning = false

ipcMain.on('research:start', async (event, { prompt, platforms }: { prompt: string; platforms: ('x' | 'reddit')[] }) => {
  if (researchRunning) return
  researchRunning = true

  const win = BrowserWindow.fromWebContents(event.sender)!

  const emit = (e: AgentEvent) => {
    win.webContents.send('research:event', e)
    if (e.type === 'result') {
      fs.mkdirSync(RESULTS_DIR, { recursive: true })
      fs.writeFileSync(path.join(RESULTS_DIR, `${Date.now()}.json`), JSON.stringify(e.data, null, 2))
    }
  }

  try {
    // Restore credentials from storage before running
    if (fs.existsSync(CREDS_PATH)) {
      const enc = fs.readFileSync(CREDS_PATH)
      const creds = JSON.parse(safeStorage.decryptString(enc))
      process.env.X_USERNAME = creds.x.username
      process.env.X_PASSWORD = creds.x.password
    }

    await runAgent(prompt, platforms, emit)
  } catch (err) {
    emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  } finally {
    researchRunning = false
  }
})

ipcMain.on('research:stop', () => {
  // Browser close handled by SIGINT/process cleanup in agent
  researchRunning = false
})
