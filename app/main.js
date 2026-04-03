const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')

ipcMain.handle('dialog:showSaveDialog', (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showSaveDialog(win, options)
})
ipcMain.handle('dialog:showOpenDialog', (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showOpenDialog(win, options)
})
ipcMain.handle('dialog:showMessageBox', (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return dialog.showMessageBox(win, options)
})
ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
    if (typeof filePath !== 'string') return
    shell.showItemInFolder(filePath)
})
ipcMain.handle('shell:beep', () => {
    shell.beep()
})
ipcMain.handle('win:setProgressBar', (event, progress) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setProgressBar(progress)
})

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 500,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })
    if (process.env['DEV']) mainWindow.openDevTools({ detached: true })
    mainWindow.setMenuBarVisibility(false)
    mainWindow.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})