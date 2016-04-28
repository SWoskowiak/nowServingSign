'use strict';

var five = require('johnny-five'),
	board = new five.Board({ repl: false}),
	awsIot = require('aws-iot-device-sdk'),
  ip = require('ip'),
  iotSettings = {
    host: 'A8DMIB1LNCAVZ.iot.us-east-1.amazonaws.com',
    port: 8883,
    clientId: 'nowServingSign',
    thingName: 'nowServingSign',
    caCert: 'root-CA.crt',
    clientCert: '60d03a0202-certificate.pem.crt',
    privateKey: '60d03a0202-private.pem.key'
  },
  LEDS,
  // 7 segment displays can't map out certain characters no matter what in the alphabet
  // http://easternstargeek.blogspot.com/2011/09/ascii-to-seven-segment-table.html
  // The following are invalid characters to print:
  // K, M, Q, T, V, W, X, Z
  pinMap = {
    0: [0, 1, 2, 3, 4, 5],
    1: [1, 2],
    2: [0, 1, 3, 4, 6],
    3: [0, 1, 2, 3, 6],
    4: [1, 2, 5, 6],
    5: [0, 2, 3, 5, 6],
    6: [0, 2, 3, 4, 5, 6],
    7: [0, 1, 2],
    8: [0, 1, 2, 3, 4, 5, 6],
    9: [0, 1, 2, 3, 5, 6],
    a: [0, 1, 2, 4, 5, 6],
    b: [2, 3, 4, 5, 6],
    c: [0, 3, 4, 5],
    d: [0, 1, 2, 3, 4, 5],
    e: [0, 3, 4, 5, 6],
    f: [0, 4, 5, 6],
    g: [0, 2, 3, 4, 5, 6],
    h: [2, 4, 5, 6],
    i: [1, 2],
    j: [1, 2, 3, 4],
    l: [3, 4, 5],
    n: [2, 4, 6],
    o: [0, 1, 2, 3, 4, 5],
    p: [0, 1, 4, 5, 6],
    r: [4, 6],
    s: [0, 2, 3, 5, 6],
    u: [1, 2, 3, 4, 5]
  };

// We have 16 "Pins" on the PCA9685 board
// Each LED generated represents a 4 led segment on the sign
// Our board has 14 segments:
// Pins 0 - 6 represent the segments of the second digit
// Pins 8 - 15 represent the segments of the second digit
// NOTE: we do NOT utilize pin 7
function buildLEDS() {
  var leds = [],
    i = 0;
  // For each of the 16 pins
  for (i; i < 16; i++) {
    leds.push({ controller: 'PCA9685', pin: i});
  }
  // return the built out LED group
  return new five.Leds(leds);
}

// Toggles all the LEDS off then light up the appropriate segments for each digit
function updateSign(firstDigit, secondDigit) {
  LEDS.off();
  // In case we tripped over an invalid character to print, display nothing for that digit
  firstDigit = firstDigit || [];
  secondDigit = secondDigit || [];

  // Add 8 to account for pin offset
  firstDigit.forEach(function (val) {
    LEDS[val + 8].on();
  });

  secondDigit.forEach(function (val) {
    LEDS[val].on();
  });
}
// Takes a string and runs it through the led map and turns on the appropriate pins
function parseMessage(str) {
  var firstDigit = [],
    secondDigit = [],
    str = str.toLowerCase(); // Normalize string input

  if (str.length > 1) {
    if (str.charAt(0)) { firstDigit = pinMap[str.charAt(0)]; }
    if (str.charAt(1)) { secondDigit = pinMap[str.charAt(1)]; }
  } else {
    if (str[0]) { secondDigit = pinMap[str[0]]; }
  }
  // Update the sign
  updateSign(firstDigit, secondDigit);
}

/* When the board is ready */
board.on('ready', function () {
  var device;
  console.log('J5: Board Ready');

  // Build LEDS
  LEDS = buildLEDS();
  LEDS.off();
  // Init Amazon IoT connection
  console.log('Connecting to Amazon IoT...');
  device = awsIot.device(iotSettings);
  // On Amazon IoT connection
  device.on('connect', function () {
    console.log('Amazon IoT connect Success');
    // Subscripe to nowServingSign topic
    device.subscribe('nowServingSign:displayString');
    device.subscribe('report');
    console.log('Awaiting messages...');
  });

  // Runs when ANY topic message we subscribed to gets published
  device.on('message', function (topic, payload) {
    // display some number or string (only reads first two characters in string)
    if (topic === 'nowServingSign:displayString') {
      parseMessage(payload.toString());
    }
    console.log('message:', topic, payload.toString());

    // When asked to report, pass back our ip and client ID
    if (topic === 'report') {
      device.publish('status', JSON.stringify({
        id: iotSettings.clientId,
        ip: ip.address()
      }));
    }
  });
});
