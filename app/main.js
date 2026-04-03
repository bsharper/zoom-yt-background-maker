const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')

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

    ipcMain.handle('dialog:showSaveDialog', (event, options) => {
        return dialog.showSaveDialog(mainWindow, options)
    })
    ipcMain.handle('dialog:showOpenDialog', (event, options) => {
        return dialog.showOpenDialog(mainWindow, options)
    })
    ipcMain.handle('dialog:showMessageBox', (event, options) => {
        return dialog.showMessageBox(mainWindow, options)
    })
    ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
        shell.showItemInFolder(filePath)
    })
    ipcMain.handle('shell:beep', () => {
        shell.beep()
    })
    ipcMain.handle('win:setProgressBar', (event, progress) => {
        mainWindow.setProgressBar(progress)
    })
}

app.whenReady().then(createWindow)

app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})