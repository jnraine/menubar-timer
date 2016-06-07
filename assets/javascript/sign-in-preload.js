const fs = require('fs')
const {ipcRenderer} = require('electron');

document.addEventListener("DOMContentLoaded", function() {
  if(document.location.pathname == "/scanner/token/1189") {
    fs.writeFile(
      "/tmp/clio-timer-api-key.json",
      document.body.textContent,
      (err) => ipcRenderer.send('api-key-updated') // TODO: Handle write error
    )
  }
})
