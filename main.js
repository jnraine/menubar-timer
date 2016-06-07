const util = require('util');
const path = require('path')
const events = require('events')
const fs = require('fs')

const {app, BrowserWindow, Menu, Tray, ipcMain} = require('electron')

const extend = require('extend')
const Positioner = require('electron-positioner')

const assetsDir = path.join(__dirname, "assets")
const trayIcons = {
  inactive: path.join(assetsDir, 'images/IconTemplate.png'),
  active: path.join(assetsDir, 'images/IconTemplateBlue.png'),
}

const MenuBar = function(options) {
  if (typeof options === 'undefined') options = {dir: app.getAppPath()}
  if (typeof options === 'string') options = {dir: options}
  if (!options.dir) options.dir = app.getAppPath()
  if (!(path.isAbsolute(options.dir))) options.dir = path.resolve(options.dir)
  if (!options.index) options.index = 'file://' + path.join(__dirname, 'index.html')
  if (!options['window-position']) options['window-position'] = (process.platform === 'win32') ? 'trayBottomCenter' : 'trayCenter'
  if (typeof options['show-dock-icon'] === 'undefined') options['show-dock-icon'] = false

  // set width/height on options to be usable before the window is created
  options.width = options.width || 300
  options.height = options.height || 400
  options.tooltip = options.tooltip || ''

  app.on('ready', appReady)

  const menuBar = new events.EventEmitter()
  menuBar.app = app

  // Set / get options
  menuBar.setOption = function (opt, val) {
    options[opt] = val
  }

  menuBar.getOption = function (opt) {
    return options[opt]
  }

  return menuBar

  function appReady () {
    // if (app.dock && !options['show-dock-icon']) app.dock.hide()

    var cachedBounds // cachedBounds are needed for double-clicked event
    var defaultClickEvent = options['show-on-right-click'] ? 'right-click' : 'click'

    const rightClickContextMenu = Menu.buildFromTemplate([
      {label: 'Version: 1.0.0', enabled: false}
    ])

    menuBar.tray = options.tray || new Tray(trayIcons.inactive)
    menuBar.tray.on(defaultClickEvent, clicked)
    menuBar.tray.on('double-click', clicked)
    menuBar.tray.on('right-click', function() {
      rightClickContextMenu.popup(menuBar.window)
    })
    menuBar.tray.setToolTip(options.tooltip)

    if (options.preloadWindow || options['preload-window']) {
      createWindow()
    }

    menuBar.showWindow = showWindow
    menuBar.hideWindow = hideWindow
    menuBar.emit('ready')

    ipcMain.on('api-key-updated', (event) => {
      console.log("api-key-updated fired in main")
      menuBar.window.webContents.send('api-key-updated')
    });

    function clicked (e, bounds) {
      if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return hideWindow()
      if (menuBar.window && menuBar.window.isVisible()) return hideWindow()
      cachedBounds = bounds || cachedBounds
      showWindow(cachedBounds)
    }

    function createWindow () {
      menuBar.emit('create-window')
      var defaults = {
        show: false,
        frame: false
      }

      var windowOptions = extend(defaults, options)
      menuBar.window = new BrowserWindow(windowOptions)

      menuBar.positioner = new Positioner(menuBar.window)

      if (!options['always-on-top']) {
        menuBar.window.on('blur', hideWindow)
      } else {
        menuBar.window.on('blur', emitBlur)
      }

      if (options['show-on-all-workspaces'] !== false) {
        menuBar.window.setVisibleOnAllWorkspaces(true)
      }

      menuBar.window.on('close', windowClear)
      menuBar.window.loadURL(options.index)
      menuBar.emit('after-create-window')
    }

    function showWindow (trayPos) {
      if (!menuBar.window) {
        createWindow()
      }

      menuBar.emit('show')

      if (trayPos && trayPos.x !== 0) {
        // Cache the bounds
        cachedBounds = trayPos
      } else if (cachedBounds) {
        // Cached value will be used if showWindow is called without bounds data
        trayPos = cachedBounds
      }

      // Default the window to the right if `trayPos` bounds are undefined or null.
      var noBoundsPosition = null
      if ((trayPos === undefined || trayPos.x === 0) && options['window-position'].substr(0, 4) === 'tray') {
        noBoundsPosition = (process.platform === 'win32') ? 'bottomRight' : 'topRight'
      }

      var position = menuBar.positioner.calculate(noBoundsPosition || options['window-position'], trayPos)

      var x = (options.x !== undefined) ? options.x : position.x
      var y = (options.y !== undefined) ? options.y : position.y

      menuBar.window.setPosition(x, y)
      menuBar.window.show()
      menuBar.emit('after-show')
      return
    }

    function hideWindow () {
      return
      if (!menuBar.window) return
      menuBar.emit('hide')
      menuBar.window.hide()
      menuBar.emit('after-hide')
    }

    function windowClear () {
      delete menuBar.window
      menuBar.emit('after-close')
    }

    function emitBlur () {
      menuBar.emit('focus-lost')
    }

    showWindow()
  }
}

var timeSince = function(startTime) {
  const durationInMs = new Date().getTime() - startTime
  const durationInSec = parseInt(durationInMs/1000, 10)

  if (isNaN(durationInSec)) {
    throw new TypeError('Invalid value sent to convertSeconds')
  }

  function padDigits(number, digits) {
    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number
  }

  hours = Math.floor(durationInSec / 60 / 60)
  minutes = Math.floor((durationInSec / 60) % 60)
  seconds = Math.floor(durationInSec % 60)

  return `${padDigits(hours, 2)}:${padDigits(minutes, 2)}:${padDigits(seconds, 2)}`
}

const mb = MenuBar({
  "preload-window": true,
  "tooltip": "Clio Time Tracking",
  "width": 316,
  "height": 510,
  "transparent": true
})

mb.on('ready', function ready() {
  ipcMain.on('elapsed-time', (event, elapsedTime) => {
    if (elapsedTime) {
      mb.tray.setImage(trayIcons.active)
      mb.tray.setTitle(elapsedTime)
    } else {
      mb.tray.setTitle("")
      mb.tray.setImage(trayIcons.inactive)
    }
  });

  mb.tray.on('click', function(event) {
    if (event.metaKey) {
      // TODO: Tell renderer to start timer
    }
  })
})
