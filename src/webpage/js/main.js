// load elements
const wrapper = document.querySelector(".at-wrap");
const main = wrapper.querySelector(".at-main");
const urlParams = new URLSearchParams(window.location.search);
const urlFileName = urlParams.get("filename");

if (!"WebSocket" in window) {
  alert(
    "WebSocket is NOT supported by your Browser so you cannot use external devices!"
  );
}
var timeWebSocket = new WebSocket("ws://localhost:8080/time");
var notesWebSocket = new WebSocket("ws://localhost:8080/notes");
timeWebSocket.onclose = function () {
  alert("Can't connect to external devices!");
};
notesWebSocket.onclose = function () {
  alert("Can't connect to external devices!");
};

// initialize alphatab
const settings = {
  file: urlFileName ?? "/file.xml",
  player: {
    enablePlayer: true,
    enableCursor: true,
    enableUserInteraction: true,
    soundFont: "/dist/soundfont/sonivox.sf2",
    scrollElement: wrapper.querySelector(".at-viewport"),
  },
};
let api = new alphaTab.AlphaTabApi(main, settings);
let timeSignaturePauses = [];
let metronomeWorker = null;
api.masterVolume = 1;

const inputElement = document.getElementById("input-file");
if (urlFileName) {
  document.getElementById("custom-input-file").style.display = "none";
}
inputElement.addEventListener("change", onUploadedFile, false);
function onUploadedFile() {
  const file = this.files[0];
  let reader = new FileReader();
  reader.onload = function (e) {
    let arrayBuffer = new Uint8Array(reader.result);
    api.load(arrayBuffer);
  };
  reader.readAsArrayBuffer(file);
}

//----------- BLE LOGIC ------------

//Setup buttons bluetooth
const connectButton = document.querySelector(".connect");
const disconnectButton = document.querySelector(".disconnect");

//Global Variables to Handle Bluetooth
var bleServer;
var bleServiceFound;

//Define BLE Device Specs
var deviceName ='ESP32';
var bleService = '19b10000-e8f2-537e-4f6c-d104768a1214';
var ledCharacteristic = '19b10002-e8f2-537e-4f6c-d104768a1214';
var notesCharacteristic = '39114440-f153-414b-9ca8-cd739acad81c';

// Connect Button (search for BLE Devices only if BLE is available)
connectButton.addEventListener(
    "click", (event) => {
    if (isWebBluetoothEnabled()){
        connectToDevice();
    }
  });

// Disconnect Button
disconnectButton.addEventListener('click', disconnectDevice);

//TESTING CONNECTION TIME LIMITS -------------------------------------------------------------

// const onButton = document.querySelector('.onButton');
// const offButton = document.querySelector('.offButton');

// let stopExecution = false;

// function myRecursiveFunction() {
//   if (stopExecution) {
      
//       return;  //Stops the calls if stopExecution is true
//   }

//   writeNotesCharacteristic(60);

//   // Call the function every 150ms
//   setTimeout(myRecursiveFunction, 150);
// }


// // When pressed the button "On"
// onButton.addEventListener("click", function() {
   
//     stopExecution = false;  // reset control var
//     myRecursiveFunction();  // Starts the recursive function
// });

// // When pressed the button "Off"
// offButton.addEventListener("click", function() {
//   stopExecution = true;  // Sets the control var and stops the execution
// });

//TESTING -------------------------------------------------------------------------------------


//Check if the browser supports bluetooth web api
function isWebBluetoothEnabled() {
  if(!navigator.bluetooth) {
    console.log("Web Bluetooth API is not available in this browser!");
    window.alert("Web Bluetooth API is not available in this browser!");
    return false  
  }

  // console.log('Web Bluetooth API supported in this browser.');
  // window.alert("Web Bluetooth API supported in this browser.");
  return true
}

//Connect to BLE Device and Enable Notifications
function connectToDevice(){
  console.log('Initializing Bluetooth...');
  navigator.bluetooth
      .requestDevice({
          filters: [{name: deviceName}],optionalServices: [bleService]})
      .then(device => 
                    {
                      console.log('Device Selected:', device.name);
                      device.addEventListener('gattservicedisconnected', 
                                              onDisconnected);
                      return device.gatt.connect();
                    })
      .then(gatt =>
                  {
                    bleServer = gatt;
                    console.log("Connected to GATT Server");
                    return bleServer.getPrimaryService(bleService);
                  })
      .then(service => 
                      {
                        bleServiceFound = service;
                        console.log("Service discovered:", service.uuid);
                        return service.getCharacteristic(ledCharacteristic);
                      })
      .catch(error => {
        console.log('Error: ', error);
        window.alert("Errore nella connessione!")
      })
}

function onDisconnected(event){
  console.log('Device Disconnected:', event.target.device.name);
  api.playPause();
  noteLogger.innerHTML = "";
  beatLogger.innerHTML = "";
  metronomeWorker.terminate();
  connectToDevice();
}

//Disconnection
function disconnectDevice() {
  console.log("Disconnect Device.");
  if (bleServer && bleServer.connected) {
    console.log("Device Disconnected"); 
    api.playPause();
    noteLogger.innerHTML = "";
    beatLogger.innerHTML = "";
    metronomeWorker.terminate(); 
    return bleServer.disconnect();   
  } else {
      // Throw an error if Bluetooth is not connected
      console.error("Bluetooth is not connected.");
      window.alert("Bluetooth is not connected.")

  }
}

// Convesion table
const conversion = {
  48: 130.81,  49: 138.59,  50: 146.83,  51: 155.56,  52: 164.81,  53: 174.61,  
  54: 185.00,  55: 196.00,  56: 207.65,  57: 220.00,  58: 233.08,  59: 246.94,
  60: 261.63,  61: 277.18,  62: 293.67,  63: 311.13,  64: 329.63,  65: 349.23,  
  66: 369.99,  67: 392.00,  68: 415.30,  69: 440.00,  70: 466.16,  71: 493.88,  
  72: 523.25,  73: 554.37,  74: 587.33,  75: 622.25,  76: 659.36,  77: 689.46,  
  78: 739.99,  79: 783.99,  80: 830.61,  81: 880.00,  82: 932.33,  83: 987.77
};


//Convert MIDI to Frequency
function convertMidiToFrequency(midi) {
  if (midi < 48) {
    return conversion[midi] ||
           48;  //Return 48 if under the scale
  }
  if (midi > 83) {
    return conversion[midi] ||
           83;  // Return 83 if upper the scale
  }
  return conversion[midi]; 
}

//Write onCharacteristic
function writeOnCharacteristic(value){
  if (bleServer && bleServer.connected) {
      bleServiceFound.getCharacteristic(ledCharacteristic)
      .then(characteristic => {
                                const data = new Uint8Array([value]);
                                console.log(getDateTime() + " LED value: " + data);
                                return characteristic.writeValue(data);
                              })
      .catch(error => {
                        console.error("Error writing to the LED characteristic: ", error);
                      });
  } else {
          console.error ("Bluetooth is not connected. Cannot write to characteristic.")
          window.alert("Bluetooth is not connected. Cannot write to characteristic. \n Connect to BLE first!")
  }
}

//Write notesCharacteristic
function writeNotesCharacteristic(midi){
  if (bleServer && bleServer.connected) {
      bleServiceFound.getCharacteristic(notesCharacteristic)
      .then(characteristic => {
                                const data = new Uint16Array([midi]);
                                console.log(getDateTime() + " DATA value: " + data);
                                return characteristic.writeValue(data);
                              })
      .catch(error => {
                        console.error("Error writing to the Notes characteristic: ", error);
                      });
  } else {
          console.error ("Bluetooth is not connected. Cannot write to characteristic.")
          window.alert("Bluetooth is not connected. Cannot write to characteristic. \n Connect to BLE first!")
  }
}

function getDateTime() {
  var currentdate = new Date();
  var day = ("00" + currentdate.getDate()).slice(-2); 
  var month = ("00" + (currentdate.getMonth() + 1)).slice(-2);
  var year = currentdate.getFullYear();
  var hours = ("00" + currentdate.getHours()).slice(-2);
  var minutes = ("00" + currentdate.getMinutes()).slice(-2);
  var seconds = ("00" + currentdate.getSeconds()).slice(-2);
  var milliseconds = ("00" + currentdate.getMilliseconds()).slice(-3);
  var datetime = day + "/" + month + "/" + year + " at " + hours + ":" + minutes + ":" + seconds + ":" + milliseconds;
  return datetime;
}

//---------- END BLE LOGIC --------------

// overlay logic
const overlay = wrapper.querySelector(".at-overlay");
api.renderStarted.on(() => {
  overlay.style.display = "flex";
});
api.renderFinished.on(() => {
  overlay.style.display = "none";
});

// track selector
function createTrackItem(track) {
  const trackItem = document
    .querySelector("#at-track-template")
    .content.cloneNode(true).firstElementChild;
  trackItem.querySelector(".at-track-name").innerText = track.name;
  trackItem.track = track;
  trackItem.onclick = (e) => {
    e.stopPropagation();
    api.renderTracks([track]);
  };
  return trackItem;
}

function createMetronome(score) {
  let tempoAutomation = 0;
  score.masterBars.forEach((bar) => {
    if (
      bar.tempoAutomation != null &&
      tempoAutomation != bar.tempoAutomation.value
    ) {
      tempoAutomation = bar.tempoAutomation.value;
    }
    let barDuration =
      parseFloat(60 / parseInt(tempoAutomation)) *
      parseInt(bar.timeSignatureNumerator);
    if (parseInt(bar.timeSignatureNumerator) == 0) return;
    let beatsWaitTime = barDuration / parseInt(bar.timeSignatureNumerator);
    for (
      let index = 1;
      index <= parseInt(bar.timeSignatureNumerator);
      index++
    ) {
      if (index == 1) {
        timeSignaturePauses.push({
          waitTime: beatsWaitTime,
          isFirstBeat: true,
        });
      } else {
        timeSignaturePauses.push({
          waitTime: beatsWaitTime,
          isFirstBeat: false,
        });
      }
    }
  });
}

const trackList = wrapper.querySelector(".at-track-list");
api.scoreLoaded.on((score) => {
  // clear items
  trackList.innerHTML = "";
  // generate a track item for all tracks of the score
  score.tracks.forEach((track) => {
    trackList.appendChild(createTrackItem(track));
  });
  createMetronome(score);
});
api.renderStarted.on(() => {
  // collect tracks being rendered
  const tracks = new Map();
  api.tracks.forEach((t) => {
    tracks.set(t.index, t);
  });
  // mark the item as active or not
  const trackItems = trackList.querySelectorAll(".at-track");
  trackItems.forEach((trackItem) => {
    if (tracks.has(trackItem.track.index)) {
      trackItem.classList.add("active");
    } else {
      trackItem.classList.remove("active");
    }
  });
});

/** Controls **/
api.scoreLoaded.on((score) => {
  wrapper.querySelector(".at-song-title").innerText = score.title;
  wrapper.querySelector(".at-song-artist").innerText = score.artist;
});

wrapper.querySelector(".at-controls .at-print").onclick = () => {
  api.print();
};

const zoom = wrapper.querySelector(".at-controls .at-zoom select");
zoom.onchange = () => {
  const zoomLevel = parseInt(zoom.value) / 100;
  api.settings.display.scale = zoomLevel;
  api.updateSettings();
  api.render();
};

const layout = wrapper.querySelector(".at-controls .at-layout select");
layout.onchange = () => {
  switch (layout.value) {
    case "horizontal":
      api.settings.display.layoutMode = alphaTab.LayoutMode.Horizontal;
      break;
    case "page":
      api.settings.display.layoutMode = alphaTab.LayoutMode.Page;
      break;
  }
  api.updateSettings();
  api.render();
};

// player loading indicator
const playerIndicator = wrapper.querySelector(
  ".at-controls .at-player-progress"
);
api.soundFontLoad.on((e) => {
  const percentage = Math.floor((e.loaded / e.total) * 100);
  playerIndicator.innerText = percentage + "%";
});
api.playerReady.on(() => {
  playerIndicator.style.display = "none";
});

// main player controls
function getCurrentBarIndex(currentTick) {
  return api.score.masterBars
    .map((el) => el.start <= currentTick)
    .lastIndexOf(true);
}
const beatSignaler = document.getElementById("beat-signaler");
const beatLogger = document.getElementById("beat-logger");
const noteLogger = document.getElementById("note-logger");
function highlightBeat(color) {
  beatSignaler.style.color = color;
  beatSignaler.style.display = "block";
  setTimeout(function () {
    beatSignaler.style.display = "none";
  }, 100);
}
const playPause = wrapper.querySelector(".at-controls .at-player-play-pause");
const stop = wrapper.querySelector(".at-controls .at-player-stop");
playPause.onclick = (e) => {
  if (e.target.classList.contains("disabled")) {
    return;
  }
  if (e.target.classList.contains("fa-play")) {
    let currentBarIndex = getCurrentBarIndex(api.tickPosition);
    api.tickPosition = api.score.masterBars[currentBarIndex].start;
    metronomeWorker = new Worker("/js/metronomeWorker.js");
    beatLogger.innerHTML = "";
    metronomeWorker.postMessage({
      startIndex: currentBarIndex,
      pauses: timeSignaturePauses,
    });
    metronomeWorker.onmessage = function (message) {
      if (timeWebSocket.readyState != 1) return;
      if (message.data.isFirstBeat) {
        beatLogger.innerHTML = '<p style="color: green;">BEAT</p>';
        //Send beat to the device
        writeOnCharacteristic(1);
        highlightBeat("green");
      } else {
        beatLogger.innerHTML += '<p style="color: red;">BEAT</p>';
        //Send beat to the device
        writeOnCharacteristic(1);
        highlightBeat("red");
      }
      timeWebSocket.send(
        JSON.stringify({ isFirstBeat: message.data.isFirstBeat })
      );
      beatLogger.scrollTo(0, beatLogger.scrollHeight);
    };
    api.playPause();
  } else if (e.target.classList.contains("fa-pause")) {
    //Stop the device 
    writeNotesCharacteristic(0);
    writeOnCharacteristic(0);
    api.playPause();
    noteLogger.innerHTML = "";
    beatLogger.innerHTML = "";
    metronomeWorker.terminate();
 
  }
};
stop.onclick = (e) => {
  if (e.target.classList.contains("disabled")) {
    return;
  }
  metronomeWorker.terminate();
  noteLogger.innerHTML = "";
  beatLogger.innerHTML = "";
  api.stop();
};
api.playerReady.on(() => {
  playPause.classList.remove("disabled");
  stop.classList.remove("disabled");
});
api.playerStateChanged.on((e) => {
  const icon = playPause.querySelector("i.fas");
  if (e.state === alphaTab.synth.PlayerState.Playing) {
    icon.classList.remove("fa-play");
    icon.classList.add("fa-pause");
  } else {
    icon.classList.remove("fa-pause");
    icon.classList.add("fa-play");
  }
});

// song position
function formatDuration(milliseconds) {
  let seconds = milliseconds / 1000;
  const minutes = (seconds / 60) | 0;
  seconds = (seconds - minutes * 60) | 0;
  return (
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0")
  );
}

const songPosition = wrapper.querySelector(".at-song-position");
let previousTime = -1;
api.playerPositionChanged.on((e) => {
  // reduce number of UI updates to second changes.
  const currentSeconds = (e.currentTime / 1000) | 0;
  if (currentSeconds == previousTime) {
    return;
  }

  songPosition.innerText =
    formatDuration(e.currentTime) + " / " + formatDuration(e.endTime);
});

api.activeBeatsChanged.on((args) => {
  noteLogger.innerHTML = "";
  for (let index = 0; index < args.activeBeats.length; index++) {
    const duration = args.activeBeats[index].duration;
    const noteValues = Array.from( args.activeBeats[index].noteValueLookup.keys() );
    
    //Convert midi to frequency
    if(index == 0){
      let temp = convertMidiToFrequency(noteValues[0]);
      //Send note to the device
      writeNotesCharacteristic(temp);
    }
    
    let i = 0;
    for (i = 0; i < noteValues.length; i++) {
      noteLogger.innerHTML +=
        '<p style="text-align: center;">Note ' +
        noteValues[i] +
        " (" +
        duration +
        ")</p>";
    }
    noteLogger.scrollTo(0, noteLogger.scrollHeight);
  }
  if (notesWebSocket.readyState != 1) return;
  notesWebSocket.send(JSON.stringify({ data: noteLogger.innerHTML }));
});
