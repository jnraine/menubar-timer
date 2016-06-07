// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const fs = require('fs')
const {ipcRenderer} = require('electron');

const credentialPath = '/tmp/timer-credentials.json'
var credentials = null;
if (fs.existsSync(credentialPath)) {
  credentials = JSON.parse(fs.readFileSync(credentialPath, 'utf8'))
} else {
  throw 'ERROR: Credential file does not exist'
}

angular.module('TimerApp', ['ngResource']).controller('mainController', function($http, $interval, TimeEntry, $scope) {
  var controller = this
  controller.credentials = credentials
  controller.loading = true
  controller.timeEntries = []
  controller.date = "2016-06-06"
  controller.webTimer = null
  controller.elapsedTime = "--:--:--"

  controller.fetchWebTimer = function() {
    $http({
      'method': 'get',
      'url': 'http://localhost:3000/api/v2/timer',
      'headers': {'Authorization': `Bearer ${credentials.token}`}
    }).then(
      (response) => {
        var timer = response.data.timer
        var timeEntry = TimeEntry.get({timeEntryId: timer.activity.id}, () => {
          controller.webTimer = timer
          controller.webTimer.quantity = timeEntry.activity.quantity
        })
      },
      (response) => {
        if(response.status == 404) {
          controller.webTimer = null
        } else {
          console.log(response)
        }
      }
    )
  }

  // TODO: Increase polling duration
  controller.fetchWebTimer()
  controller.webTimerPoller = $interval(controller.fetchWebTimer, 1000)

  // TODO: Cancel this when controller is destroyed
  controller.activeTimerElapsedTimeUpdater = $interval(() => {
    if (controller.webTimer) {
      timeEntrySavedSeconds = controller.webTimer.quantity
      secondsTimerHasBeenRunning = ((new Date().getTime()) - (new Date(controller.webTimer.start_time).getTime()))/1000;
      controller.elapsedTime = secondsToDuration(timeEntrySavedSeconds + secondsTimerHasBeenRunning)
      ipcRenderer.send('elapsed-time', controller.elapsedTime);
    } else {
      controller.elapsedTime = "--:--:--"
      ipcRenderer.send('elapsed-time', null);
    }
  }, 1000)

  controller.fetchTimeEntries = function() {
    TimeEntry.query({from: controller.date, to: controller.date}, (data) => {
      controller.timeEntries = data.activities
      controller.loading = false
    })
  }

  // TODO: Cancel this when controller is destroyed
  controller.fetchTimeEntries()
  $interval(controller.fetchTimeEntries, 1000)
})

angular.module('TimerApp').filter('secondsToDuration', function() {
  return function(durationInSec) {
    function padDigits(number, digits) {
      return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number
    }

    hours = Math.floor(durationInSec / 60 / 60)
    minutes = Math.floor((durationInSec / 60) % 60)
    seconds = Math.floor(durationInSec % 60)

    return `${padDigits(hours, 2)}:${padDigits(minutes, 2)}:${padDigits(seconds, 2)}`
  };
});

var secondsToDuration = function(durationInSec) {
  function padDigits(number, digits) {
    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number
  }

  hours = Math.floor(durationInSec / 60 / 60)
  minutes = Math.floor((durationInSec / 60) % 60)
  seconds = Math.floor(durationInSec % 60)

  return `${padDigits(hours, 2)}:${padDigits(minutes, 2)}:${padDigits(seconds, 2)}`
}

angular.module('TimerApp').factory('TimeEntry', function($resource) {
  return $resource(
    'http://localhost:3000/api/v2/activities/:timeEntryId',
    {timeEntryId: '@id'},
    {
      query: {headers: {"Authorization": "Bearer " + credentials.token}, params: {type: "TimeEntry", query: "AssignedToMe"}}
    }
  )
})

angular.module('TimerApp').factory('TimeEntry', function($resource) {
  return $resource(
    'http://localhost:3000/api/v2/activities/:timeEntryId',
    {timeEntryId: '@id'},
    {
      query: {headers: {"Authorization": "Bearer " + credentials.token}, params: {type: "TimeEntry", query: "AssignedToMe"}},
      get: {headers: {"Authorization": "Bearer " + credentials.token}}
    }
  )
})
