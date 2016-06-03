const util = require('util');
const path = require('path')
const events = require('events')
const fs = require('fs')

const electron = require('electron')
const app = electron.app
const Tray = electron.Tray
const BrowserWindow = electron.BrowserWindow

const extend = require('extend')
const Positioner = require('electron-positioner')

const trayIcons = {
  inactive: path.join(__dirname, 'IconTemplate.png'),
  active: path.join(__dirname, 'IconTemplateBlue.png'),
}

const MenuBar = function(opts) {
  if (typeof opts === 'undefined') opts = {dir: app.getAppPath()}
  if (typeof opts === 'string') opts = {dir: opts}
  if (!opts.dir) opts.dir = app.getAppPath()
  if (!(path.isAbsolute(opts.dir))) opts.dir = path.resolve(opts.dir)
  if (!opts.index) opts.index = 'file://' + path.join(opts.dir, 'index.html')
  if (!opts['window-position']) opts['window-position'] = (process.platform === 'win32') ? 'trayBottomCenter' : 'trayCenter'
  if (typeof opts['show-dock-icon'] === 'undefined') opts['show-dock-icon'] = false

  // set width/height on opts to be usable before the window is created
  opts.width = opts.width || 300
  opts.height = opts.height || 400
  opts.tooltip = opts.tooltip || ''

  app.on('ready', appReady)

  const menuBar = new events.EventEmitter()
  menuBar.app = app

  // Set / get options
  menuBar.setOption = function (opt, val) {
    opts[opt] = val
  }

  menuBar.getOption = function (opt) {
    return opts[opt]
  }

  return menuBar

  function appReady () {
    console.log("Running appReady")
    if (app.dock && !opts['show-dock-icon']) app.dock.hide()

    var iconPath = opts.icon || path.join(opts.dir, 'IconTemplate.png')
    if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, 'example', 'IconTemplate.png') // default cat icon

    var cachedBounds // cachedBounds are needed for double-clicked event
    var defaultClickEvent = opts['show-on-right-click'] ? 'right-click' : 'click'

    menuBar.tray = opts.tray || new Tray(iconPath)
    menuBar.tray.on(defaultClickEvent, clicked)
    menuBar.tray.on('double-click', clicked)
    menuBar.tray.setToolTip(opts.tooltip)

    if (opts.preloadWindow || opts['preload-window']) {
      createWindow()
    }

    menuBar.showWindow = showWindow
    menuBar.hideWindow = hideWindow
    menuBar.emit('ready')

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

      var winOpts = extend(defaults, opts)
      menuBar.window = new BrowserWindow(winOpts)

      menuBar.positioner = new Positioner(menuBar.window)

      if (!opts['always-on-top']) {
        menuBar.window.on('blur', hideWindow)
      } else {
        menuBar.window.on('blur', emitBlur)
      }

      if (opts['show-on-all-workspaces'] !== false) {
        menuBar.window.setVisibleOnAllWorkspaces(true)
      }

      menuBar.window.on('close', windowClear)
      menuBar.window.loadURL(opts.index)
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
      if ((trayPos === undefined || trayPos.x === 0) && opts['window-position'].substr(0, 4) === 'tray') {
        noBoundsPosition = (process.platform === 'win32') ? 'bottomRight' : 'topRight'
      }

      var position = menuBar.positioner.calculate(noBoundsPosition || opts['window-position'], trayPos)

      var x = (opts.x !== undefined) ? opts.x : position.x
      var y = (opts.y !== undefined) ? opts.y : position.y

      menuBar.window.setPosition(x, y)
      menuBar.window.show()
      menuBar.emit('after-show')
      return
    }

    function hideWindow () {
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
  "dir": __dirname,
  "preload-window": true,
  "tooltip": "Clio Time Tracking"
})

mb.on('ready', function ready() {
  var startTime = null;

  setInterval(function() {
    if (startTime) {
      mb.tray.setTitle(timeSince(startTime))
    } else {
      mb.tray.setTitle("");
    }
  }, 1000)

  mb.tray.on('click', function(event) {
    if (event.metaKey) {
      if (startTime) {
        startTime = null
        mb.tray.setImage(trayIcons.inactive);
      } else {
        startTime = new Date().getTime();
        mb.tray.setImage(trayIcons.active);
      }
    }
  })
})
