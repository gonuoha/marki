// Renders build/icon.svg to build/icon.png, which electron-builder turns into
// the .icns. Run with: npm run icon
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'

const SIZE = 1024
const svg = readFileSync(resolve('build/icon.svg'), 'utf8')
const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const image = await win.webContents.capturePage()
  const { width } = image.getSize()
  const png = width === SIZE ? image.toPNG() : image.resize({ width: SIZE, quality: 'best' }).toPNG()
  writeFileSync(resolve('build/icon.png'), png)
  app.quit()
})
