/*
 Copyright (c) 2014 Bryan Hughes <bryan@theoreticalideations.com>

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the 'Software'), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { init } from 'raspi';
import { getPins, getPinNumber } from 'raspi-board';
import { PULL_NONE, PULL_UP, PULL_DOWN, DigitalOutput, DigitalInput } from 'raspi-gpio';
import { PWM } from 'raspi-pwm';
import { I2C } from 'raspi-i2c';
import { LED } from 'raspi-led';
import execSync from 'sync-exec';

// Hacky quick Symbol polyfill, since es6-symbol refuses to install with Node 0.10 from http://node-arm.herokuapp.com/
if (typeof global.Symbol != 'function') {
  global.Symbol = (name) => {
    return '__$raspi_symbol_' + name + '_' + Math.round(Math.random() * 0xFFFFFFF) + '$__';
  };
}

// Constants
const INPUT_MODE = 0;
const OUTPUT_MODE = 1;
const ANALOG_MODE = 2;
const PWM_MODE = 3;
const SERVO_MODE = 4;
const UNKNOWN_MODE = 99;

const LOW = 0;
const HIGH = 1;

const LED_PIN = -1;

const ONE_WIRE_LIST_PATH = '/sys/devices/w1_bus_master1/w1_master_slaves';
const ONE_WIRE_BASE_PATH = '/sys/bus/w1/devices/';

// Settings
const DIGITAL_READ_UPDATE_RATE = 19;

// Private symbols
const isReady = Symbol('isReady');
const pins = Symbol('pins');
const instances = Symbol('instances');
const analogPins = Symbol('analogPins');
const getPinInstance = Symbol('getPinInstance');
const i2c = Symbol('i2c');
const i2cDelay = Symbol('i2cDelay');
const i2cRead = Symbol('i2cRead');
const i2cCheckAlive = Symbol('i2cCheckAlive');
const pinMode = Symbol('pinMode');

const Encoder = {
  to7BitArray: function(data) {
    var shift = 0;
    var previous = 0;
    var output = [];

    data.forEach(function(byte) {
      if (shift == 0) {
        output.push(byte & 0x7f)
        shift++;
        previous = byte >> 7;
      } else {
        output.push(((byte << shift) & 0x7f) | previous);
        if (shift == 6) {
          output.push(byte >> 1);
          shift = 0;
        } else {
          shift++;
          previous = byte >> (8 - shift);
        }
      }
    })

    if (shift > 0) {
      output.push(previous);
    }

    return output;
  },
  from7BitArray: function(encoded) {
    var expectedBytes = (encoded.length) * 7 >> 3;
    var decoded = [];

    for (var i = 0; i < expectedBytes ; i++) {
      var j = i << 3;
      var pos = parseInt(j/7);
      var shift = j % 7;
      decoded[i] = (encoded[pos] >> shift) | ((encoded[pos+1] << (7 - shift)) & 0xFF);
    }

    return decoded;
  },
  crc8: function(data) {
    var crc = 0;

    for(var i = 0; i < data.length; i++) {
      var inbyte = data[i];

      for (var n = 8; n; n--) {
        var mix = (crc ^ inbyte) & 0x01;
        crc >>= 1;

        if (mix) {
          crc ^= 0x8C;
        }

        inbyte >>= 1;
      }
    }
    return crc;
  },
  readDevices: function(data) {
    var deviceBytes = Encoder.from7BitArray(data);
    var devices = [];

    for(var i = 0; i < deviceBytes.length; i += 8) {
      var device = deviceBytes.slice(i, i + 8);

      if(device.length != 8) {
        continue;
      }

      var check = Encoder.crc8(device.slice(0, 7));

      if(check != device[7]) {
        console.error("ROM invalid!");
      }

      devices.push(device);
    }

    return devices;
  }
};

function toArray(buffer) {
  var devices = Encoder.readDevices(buffer);
  console.log('BUFFER', devices);
  console.log('BUFFER', devices[0]);
  const result = buffer.toString().split('\n').map(i => {
    return new Buffer(i.trim());
  });

  return result.filter(item => {
    return !!item;
  });
}

function round(number, places) {
  const pow = Math.pow(10, places);
  return Math.round(number * pow) / pow;
}

class Raspi extends EventEmitter {

  constructor() {
    super();

    Object.defineProperties(this, {
      name: {
        enumerable: true,
        value: 'RaspberryPi-IO'
      },

      [instances]: {
        writable: true,
        value: []
      },

      [isReady]: {
        writable: true,
        value: false
      },
      isReady: {
        enumerable: true,
        get() {
          return this[isReady];
        }
      },

      [pins]: {
        writable: true,
        value: []
      },
      pins: {
        enumerable: true,
        get() {
          return this[pins];
        }
      },

      [analogPins]: {
        writable: true,
        value: []
      },
      analogPins: {
        enumerable: true,
        get() {
          return this[analogPins];
        }
      },

      [i2c]: {
        writable: true,
        value: new I2C()
      },

      [i2cDelay]: {
        writable: true,
        value: 0
      },

      MODES: {
        enumerable: true,
        value: Object.freeze({
          INPUT: INPUT_MODE,
          OUTPUT: OUTPUT_MODE,
          ANALOG: ANALOG_MODE,
          PWM: PWM_MODE,
          SERVO: SERVO_MODE
        })
      },

      HIGH: {
        enumerable: true,
        value: HIGH
      },
      LOW: {
        enumerable: true,
        value: LOW
      },

      defaultLed: {
        enumerable: true,
        value: LED_PIN
      }
    });

    init(() => {
      const pinMappings = getPins();
      this[pins] = [];

      // Slight hack to get the LED in there, since it's not actually a pin
      pinMappings[LED_PIN] = {
        pins: [LED_PIN],
        peripherals: ['gpio']
      };

      Object.keys(pinMappings).forEach((pin) => {
        const pinInfo = pinMappings[pin];
        const supportedModes = [];
        // We don't want I2C to be used for anything else, since changing the
        // pin mode makes it unable to ever do I2C again.
        if (pinInfo.peripherals.indexOf('i2c') == -1) {
          if (pin == LED_PIN) {
            supportedModes.push(OUTPUT_MODE);
          } else if (pinInfo.peripherals.indexOf('gpio') != -1) {
            supportedModes.push(INPUT_MODE, OUTPUT_MODE);
          }
          if (pinInfo.peripherals.indexOf('pwm') != -1) {
            supportedModes.push(PWM_MODE, SERVO_MODE);
          }
        }
        const instance = this[instances][pin] = {
          peripheral: null,
          mode: supportedModes.indexOf(OUTPUT_MODE) == -1 ? UNKNOWN_MODE : OUTPUT_MODE,
          previousWrittenValue: LOW
        };
        this[pins][pin] = Object.create(null, {
          supportedModes: {
            enumerable: true,
            value: Object.freeze(supportedModes)
          },
          mode: {
            enumerable: true,
            get() {
              return instance.mode;
            }
          },
          value: {
            enumerable: true,
            get() {
              switch (instance.mode) {
                case INPUT_MODE:
                  return instance.peripheral.read();
                case OUTPUT_MODE:
                  return instance.previousWrittenValue;
                default:
                  return null;
              }
            },
            set(value) {
              if (instance.mode == OUTPUT_MODE) {
                instance.peripheral.write(value);
              }
            }
          },
          report: {
            enumerable: true,
            value: 1
          },
          analogChannel: {
            enumerable: true,
            value: 127
          }
        });
        if (instance.mode == OUTPUT_MODE) {
          this.pinMode(pin, OUTPUT_MODE);
          this.digitalWrite(pin, LOW);
        }
      });

      // Fill in the holes, sins pins are sparse on the A+/B+/2
      for (let i = 0; i < this[pins].length; i++) {
        if (!this[pins][i]) {
          this[pins][i] = Object.create(null, {
            supportedModes: {
              enumerable: true,
              value: Object.freeze([])
            },
            mode: {
              enumerable: true,
              get() {
                return UNKNOWN_MODE;
              }
            },
            value: {
              enumerable: true,
              get() {
                return 0;
              },
              set() {
              }
            },
            report: {
              enumerable: true,
              value: 1
            },
            analogChannel: {
              enumerable: true,
              value: 127
            }
          });
        }
      }

      this[isReady] = true;
      this.emit('ready');
      this.emit('connect');
    });
  }

  reset() {
    throw new Error('reset is not supported on the Raspberry Pi');
  }

  normalize(pin) {
    const normalizedPin = getPinNumber(pin);
    if (typeof normalizedPin == 'undefined') {
      throw new Error('Unknown pin "' + pin + '"');
    }
    return normalizedPin;
  }

  [getPinInstance](pin) {
    const pinInstance = this[instances][pin];
    if (!pinInstance) {
      throw new Error('Unknown pin "' + pin + '"');
    }
    return pinInstance;
  }

  pinMode(pin, mode) {
    this[pinMode]({
      pin,
      mode
    });
  }

  [pinMode]({ pin, mode, pullResistor = PULL_NONE }) {
    const normalizedPin = this.normalize(pin);
    const pinInstance = this[getPinInstance](normalizedPin);
    pinInstance.pullResistor = pullResistor;
    const config = {
      pin: normalizedPin,
      pullResistor: pinInstance.pullResistor
    };
    if (this[pins][normalizedPin].supportedModes.indexOf(mode) == -1) {
      throw new Error('Pin "' + pin + '" does not support mode "' + mode + '"');
    }
    if (pin == LED_PIN && !(pinInstance.peripheral instanceof LED)) {
      pinInstance.peripheral = new LED();
    } else {
      switch (mode) {
        case INPUT_MODE:
          pinInstance.peripheral = new DigitalInput(config);
          break;
        case OUTPUT_MODE:
          pinInstance.peripheral = new DigitalOutput(config);
          break;
        case PWM_MODE:
        case SERVO_MODE:
          pinInstance.peripheral = new PWM(normalizedPin);
          break;
        default:
          console.warn('Unknown pin mode: ' + mode);
          break;
      }
    }
    pinInstance.mode = mode;
  }

  analogRead() {
    throw new Error('analogRead is not supported on the Raspberry Pi');
  }

  analogWrite(pin, value) {
    const pinInstance = this[getPinInstance](this.normalize(pin));
    if (pinInstance.mode != PWM_MODE) {
      this.pinMode(pin, PWM_MODE);
    }
    pinInstance.peripheral.write(Math.round(value * 1000 / 255));
  }

  digitalRead(pin, handler) {
    const pinInstance = this[getPinInstance](this.normalize(pin));
    if (pinInstance.mode != INPUT_MODE) {
      this.pinMode(pin, INPUT_MODE);
    }
    const interval = setInterval(() => {
      let value;
      if (pinInstance.mode == INPUT_MODE) {
        value = pinInstance.peripheral.read();
      } else {
        value = pinInstance.previousWrittenValue;
      }
      if (handler) {
        handler(value);
      }
      this.emit('digital-read-' + pin, value);
    }, DIGITAL_READ_UPDATE_RATE);
    pinInstance.peripheral.on('destroyed', () => {
      clearInterval(interval);
    });
  }

  digitalWrite(pin, value) {
    const pinInstance = this[getPinInstance](this.normalize(pin));
    if (pinInstance.mode === INPUT_MODE && value === HIGH) {
      this[pinMode]({
        pin,
        mode: INPUT_MODE,
        pullResistor: PULL_UP
      });
    } else if (pinInstance.mode != OUTPUT_MODE) {
      this[pinMode]({
        pin,
        mode: OUTPUT_MODE
      });
    }
    if (pinInstance.mode === OUTPUT_MODE && value != pinInstance.previousWrittenValue) {
      pinInstance.peripheral.write(value ? HIGH : LOW);
      pinInstance.previousWrittenValue = value;
    }
  }

  servoWrite(pin, value) {
    const pinInstance = this[getPinInstance](this.normalize(pin));
    if (pinInstance.mode != SERVO_MODE) {
      this.pinMode(pin, SERVO_MODE);
    }
    pinInstance.peripheral.write(48 + Math.round(value * 48 / 180));
  }

  queryCapabilities(cb) {
    if (this.isReady) {
      process.nextTick(cb);
    } else {
      this.on('ready', cb);
    }
  }

  queryAnalogMapping(cb) {
    if (this.isReady) {
      process.nextTick(cb);
    } else {
      this.on('ready', cb);
    }
  }

  queryPinState(pin, cb) {
    if (this.isReady) {
      process.nextTick(cb);
    } else {
      this.on('ready', cb);
    }
  }

  [i2cCheckAlive]() {
    if (!this[i2c].alive) {
      throw new Error('I2C pins not in I2C mode');
    }
  }

  i2cConfig(options) {
    let delay;

    if (typeof options === 'number') {
      delay = options;
    } else {
      if (typeof options === 'object' && options !== null) {
        delay = options.delay;
      }
    }

    this[i2cCheckAlive]();

    this[i2cDelay] = delay || 0;

    return this;
  }

  i2cWrite(address, cmdRegOrData, inBytes) {
    this[i2cCheckAlive]();

    // If i2cWrite was used for an i2cWriteReg call...
    if (arguments.length === 3 && !Array.isArray(cmdRegOrData) && !Array.isArray(inBytes)) {
      return this.i2cWriteReg(address, cmdRegOrData, inBytes);
    }

    // Fix arguments if called with Firmata.js API
    if (arguments.length === 2) {
      if (Array.isArray(cmdRegOrData)) {
        inBytes = cmdRegOrData.slice();
        cmdRegOrData = inBytes.shift();
      } else {
        inBytes = [];
      }
    }

    const buffer = new Buffer([cmdRegOrData].concat(inBytes));

    // Only write if bytes provided
    if (buffer.length) {
      this[i2c].writeSync(address, buffer);
    }

    return this;
  }

  i2cWriteReg(address, register, value) {
    this[i2cCheckAlive]();

    this[i2c].writeByteSync(address, register, value);

    return this;
  }

  [i2cRead](continuous, address, register, bytesToRead, callback) {
    this[i2cCheckAlive]();

    // Fix arguments if called with Firmata.js API
    if (arguments.length == 4 && typeof register == 'number' && typeof bytesToRead == 'function') {
      callback = bytesToRead;
      bytesToRead = register;
      register = null;
    }

    callback = typeof callback === 'function' ? callback : () => {
    };

    let event = 'I2C-reply' + address + '-';
    event += register !== null ? register : 0;

    const read = () => {
      const afterRead = (err, buffer) => {
        if (err) {
          return this.emit('error', err);
        }

        // Convert buffer to Array before emit
        this.emit(event, Array.prototype.slice.call(buffer));

        if (continuous) {
          setTimeout(read, this[i2cDelay]);
        }
      };

      this.once(event, callback);

      if (register !== null) {
        this[i2c].read(address, register, bytesToRead, afterRead);
      } else {
        this[i2c].read(address, bytesToRead, afterRead);
      }
    };

    setTimeout(read, this[i2cDelay]);

    return this;
  }

  i2cRead(...rest) {
    return this[i2cRead](true, ...rest);
  }

  i2cReadOnce(...rest) {
    return this[i2cRead](false, ...rest);
  }

  sendI2CConfig(...rest) {
    return this.i2cConfig(...rest);
  }

  sendI2CWriteRequest(...rest) {
    return this.i2cWrite(...rest);
  }

  sendI2CReadRequest(...rest) {
    return this.i2cReadOnce(...rest);
  }

  sendOneWireConfig(pin, enableParasiticPower) {
    execSync('modprobe w1-gpio');
    execSync('modprobe w1-therm');
  }

  sendOneWireSearch(pin, callback) {
    this._sendOneWireSearch(callback);
  }

  sendOneWireAlarmsSearch(pin, callback) {
    this._sendOneWireSearch(callback);
  }

  _sendOneWireSearch(callback) {
    fs.readFile(ONE_WIRE_LIST_PATH, (err, data) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, toArray(data));
      }
    });
  }

  sendOneWireRead(pin, device, numBytesToRead, callback) {
    this._sendOneWireRequest(pin, device, callback);
  }

  sendOneWireReset(pin) {
    // throw new Error('sendOneWireConfig is not supported on the Raspberry Pi');
  }

  sendOneWireWrite(pin, device, data) {
    // throw new Error('sendOneWireWrite is not supported on the Raspberry Pi');
  }

  sendOneWireDelay(pin, delay) {
    // throw new Error('sendOneWireDelay is not supported on the Raspberry Pi');
  }

  sendOneWireWriteAndRead(pin, device, data, numBytesToRead, callback) {
    // throw new Error('sendOneWireWriteAndRead is not supported on the Raspberry Pi');
  }

  _getOneWireFileName(deviceId) {
    return path.resolve(ONE_WIRE_BASE_PATH, deviceId, 'w1_slave');
  }

  _sendOneWireRequest(pin, device, callback) {
    fs.readFile(this._getOneWireFileName(device), (err, data) => {
      if (err) {
        if (err.code && err.code === 'ENOENT') {
          callback('Could not read device content. Device \'' + device + '\' not found', null);
        } else {
          callback(err, null);
        }
      } else {
        const dataStr = data.toString();

        let result = false;
        if (dataStr && dataStr.indexOf('YES') > -1) {
          const temp = dataStr.match(/t=(-?(\d+))/);

          if (temp) {
            result = round(parseInt(temp[1], 10) / 1000, 1);
          }
        }

        callback(null, result);
      }
    });
  }

  setSamplingInterval() {
    throw new Error('setSamplingInterval is not yet implemented');
  }

  reportAnalogPin() {
    throw new Error('reportAnalogPin is not yet implemented');
  }

  reportDigitalPin() {
    throw new Error('reportDigitalPin is not yet implemented');
  }

  pingRead() {
    throw new Error('pingRead is not yet implemented');
  }

  pulseIn() {
    throw new Error('pulseIn is not yet implemented');
  }

  stepperConfig() {
    throw new Error('stepperConfig is not yet implemented');
  }

  stepperStep() {
    throw new Error('stepperStep is not yet implemented');
  }
}

Object.defineProperty(Raspi, 'isRaspberryPi', {
  enumerable: true,
  value: () => {
    // Determining if a system is a Raspberry Pi isn't possible through
    // the os module on Raspbian, so we read it from the file system instead
    let isRaspberryPi = false;
    try {
      isRaspberryPi = fs.readFileSync('/etc/os-release').toString().indexOf('Raspbian') !== -1;
    } catch (e) {
    }// Squash file not found, etc errors
    return isRaspberryPi;
  }
});

module.exports = Raspi;
