const { app, BrowserWindow } = require('electron')
const path = require('path')

app.allowRendererProcessReuse = false;

function createWindow() {
    const mainWindow = new BrowserWindow({
            width: 800,
            height: 500,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false
            }
        })
        //preload: path.join(__dirname, 'preload.js')
    if (process.env['DEV']) mainWindow.openDevTools({ detached: true })
    mainWindow.setMenuBarVisibility(false)
    mainWindow.loadFile('index.html')


}

app.whenReady().then(createWindow)

app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})