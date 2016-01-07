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

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _events = require('events');

var _raspi = require('raspi');

var _raspiBoard = require('raspi-board');

var _raspiGpio = require('raspi-gpio');

var _raspiPwm = require('raspi-pwm');

var _raspiI2c = require('raspi-i2c');

var _raspiLed = require('raspi-led');

var _syncExec = require('sync-exec');

var _syncExec2 = _interopRequireDefault(_syncExec);

// Hacky quick Symbol polyfill, since es6-symbol refuses to install with Node 0.10 from http://node-arm.herokuapp.com/
if (typeof global.Symbol != 'function') {
  global.Symbol = function (name) {
    return '__$raspi_symbol_' + name + '_' + Math.round(Math.random() * 0xFFFFFFF) + '$__';
  };
}

// Constants
var INPUT_MODE = 0;
var OUTPUT_MODE = 1;
var ANALOG_MODE = 2;
var PWM_MODE = 3;
var SERVO_MODE = 4;
var UNKNOWN_MODE = 99;

var LOW = 0;
var HIGH = 1;

var LED_PIN = -1;

var ONE_WIRE_LIST_PATH = '/sys/devices/w1_bus_master1/w1_master_slaves';
var ONE_WIRE_BASE_PATH = '/sys/bus/w1/devices/';

// Settings
var DIGITAL_READ_UPDATE_RATE = 19;

// Private symbols
var isReady = Symbol('isReady');
var pins = Symbol('pins');
var instances = Symbol('instances');
var analogPins = Symbol('analogPins');
var getPinInstance = Symbol('getPinInstance');
var i2c = Symbol('i2c');
var i2cDelay = Symbol('i2cDelay');
var _i2cRead = Symbol('i2cRead');
var i2cCheckAlive = Symbol('i2cCheckAlive');
var _pinMode = Symbol('pinMode');

var Encoder = {
  to7BitArray: function to7BitArray(data) {
    var shift = 0;
    var previous = 0;
    var output = [];

    data.forEach(function (byte) {
      if (shift == 0) {
        output.push(byte & 0x7f);
        shift++;
        previous = byte >> 7;
      } else {
        output.push(byte << shift & 0x7f | previous);
        if (shift == 6) {
          output.push(byte >> 1);
          shift = 0;
        } else {
          shift++;
          previous = byte >> 8 - shift;
        }
      }
    });

    if (shift > 0) {
      output.push(previous);
    }

    return output;
  },
  from7BitArray: function from7BitArray(encoded) {
    var expectedBytes = encoded.length * 7 >> 3;
    var decoded = [];

    for (var i = 0; i < expectedBytes; i++) {
      var j = i << 3;
      var pos = parseInt(j / 7);
      var shift = j % 7;
      decoded[i] = encoded[pos] >> shift | encoded[pos + 1] << 7 - shift & 0xFF;
    }

    return decoded;
  },
  crc8: function crc8(data) {
    var crc = 0;

    for (var i = 0; i < data.length; i++) {
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
  readDevices: function readDevices(data) {
    var deviceBytes = Encoder.from7BitArray(data);
    var devices = [];

    for (var i = 0; i < deviceBytes.length; i += 8) {
      var device = deviceBytes.slice(i, i + 8);

      if (device.length != 8) {
        continue;
      }

      var check = Encoder.crc8(device.slice(0, 7));

      if (check != device[7]) {
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
  var result = buffer.toString().split('\n').map(function (i) {
    return new Buffer(i.trim());
  });

  return result.filter(function (item) {
    return !!item;
  });
}

function round(number, places) {
  var pow = Math.pow(10, places);
  return Math.round(number * pow) / pow;
}

var Raspi = (function (_EventEmitter) {
  _inherits(Raspi, _EventEmitter);

  function Raspi() {
    var _Object$defineProperties,
        _this = this;

    _classCallCheck(this, Raspi);

    _get(Object.getPrototypeOf(Raspi.prototype), 'constructor', this).call(this);

    Object.defineProperties(this, (_Object$defineProperties = {
      name: {
        enumerable: true,
        value: 'RaspberryPi-IO'
      }

    }, _defineProperty(_Object$defineProperties, instances, {
      writable: true,
      value: []
    }), _defineProperty(_Object$defineProperties, isReady, {
      writable: true,
      value: false
    }), _defineProperty(_Object$defineProperties, 'isReady', {
      enumerable: true,
      get: function get() {
        return this[isReady];
      }
    }), _defineProperty(_Object$defineProperties, pins, {
      writable: true,
      value: []
    }), _defineProperty(_Object$defineProperties, 'pins', {
      enumerable: true,
      get: function get() {
        return this[pins];
      }
    }), _defineProperty(_Object$defineProperties, analogPins, {
      writable: true,
      value: []
    }), _defineProperty(_Object$defineProperties, 'analogPins', {
      enumerable: true,
      get: function get() {
        return this[analogPins];
      }
    }), _defineProperty(_Object$defineProperties, i2c, {
      writable: true,
      value: new _raspiI2c.I2C()
    }), _defineProperty(_Object$defineProperties, i2cDelay, {
      writable: true,
      value: 0
    }), _defineProperty(_Object$defineProperties, 'MODES', {
      enumerable: true,
      value: Object.freeze({
        INPUT: INPUT_MODE,
        OUTPUT: OUTPUT_MODE,
        ANALOG: ANALOG_MODE,
        PWM: PWM_MODE,
        SERVO: SERVO_MODE
      })
    }), _defineProperty(_Object$defineProperties, 'HIGH', {
      enumerable: true,
      value: HIGH
    }), _defineProperty(_Object$defineProperties, 'LOW', {
      enumerable: true,
      value: LOW
    }), _defineProperty(_Object$defineProperties, 'defaultLed', {
      enumerable: true,
      value: LED_PIN
    }), _Object$defineProperties));

    (0, _raspi.init)(function () {
      var pinMappings = (0, _raspiBoard.getPins)();
      _this[pins] = [];

      // Slight hack to get the LED in there, since it's not actually a pin
      pinMappings[LED_PIN] = {
        pins: [LED_PIN],
        peripherals: ['gpio']
      };

      Object.keys(pinMappings).forEach(function (pin) {
        var pinInfo = pinMappings[pin];
        var supportedModes = [];
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
        var instance = _this[instances][pin] = {
          peripheral: null,
          mode: supportedModes.indexOf(OUTPUT_MODE) == -1 ? UNKNOWN_MODE : OUTPUT_MODE,
          previousWrittenValue: LOW
        };
        _this[pins][pin] = Object.create(null, {
          supportedModes: {
            enumerable: true,
            value: Object.freeze(supportedModes)
          },
          mode: {
            enumerable: true,
            get: function get() {
              return instance.mode;
            }
          },
          value: {
            enumerable: true,
            get: function get() {
              switch (instance.mode) {
                case INPUT_MODE:
                  return instance.peripheral.read();
                case OUTPUT_MODE:
                  return instance.previousWrittenValue;
                default:
                  return null;
              }
            },
            set: function set(value) {
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
          _this.pinMode(pin, OUTPUT_MODE);
          _this.digitalWrite(pin, LOW);
        }
      });

      // Fill in the holes, sins pins are sparse on the A+/B+/2
      for (var i = 0; i < _this[pins].length; i++) {
        if (!_this[pins][i]) {
          _this[pins][i] = Object.create(null, {
            supportedModes: {
              enumerable: true,
              value: Object.freeze([])
            },
            mode: {
              enumerable: true,
              get: function get() {
                return UNKNOWN_MODE;
              }
            },
            value: {
              enumerable: true,
              get: function get() {
                return 0;
              },
              set: function set() {}
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

      _this[isReady] = true;
      _this.emit('ready');
      _this.emit('connect');
    });
  }

  _createClass(Raspi, [{
    key: 'reset',
    value: function reset() {
      throw new Error('reset is not supported on the Raspberry Pi');
    }
  }, {
    key: 'normalize',
    value: function normalize(pin) {
      var normalizedPin = (0, _raspiBoard.getPinNumber)(pin);
      if (typeof normalizedPin == 'undefined') {
        throw new Error('Unknown pin "' + pin + '"');
      }
      return normalizedPin;
    }
  }, {
    key: getPinInstance,
    value: function value(pin) {
      var pinInstance = this[instances][pin];
      if (!pinInstance) {
        throw new Error('Unknown pin "' + pin + '"');
      }
      return pinInstance;
    }
  }, {
    key: 'pinMode',
    value: function pinMode(pin, mode) {
      this[_pinMode]({
        pin: pin,
        mode: mode
      });
    }
  }, {
    key: _pinMode,
    value: function value(_ref) {
      var pin = _ref.pin;
      var mode = _ref.mode;
      var _ref$pullResistor = _ref.pullResistor;
      var pullResistor = _ref$pullResistor === undefined ? _raspiGpio.PULL_NONE : _ref$pullResistor;

      var normalizedPin = this.normalize(pin);
      var pinInstance = this[getPinInstance](normalizedPin);
      pinInstance.pullResistor = pullResistor;
      var config = {
        pin: normalizedPin,
        pullResistor: pinInstance.pullResistor
      };
      if (this[pins][normalizedPin].supportedModes.indexOf(mode) == -1) {
        throw new Error('Pin "' + pin + '" does not support mode "' + mode + '"');
      }
      if (pin == LED_PIN && !(pinInstance.peripheral instanceof _raspiLed.LED)) {
        pinInstance.peripheral = new _raspiLed.LED();
      } else {
        switch (mode) {
          case INPUT_MODE:
            pinInstance.peripheral = new _raspiGpio.DigitalInput(config);
            break;
          case OUTPUT_MODE:
            pinInstance.peripheral = new _raspiGpio.DigitalOutput(config);
            break;
          case PWM_MODE:
          case SERVO_MODE:
            pinInstance.peripheral = new _raspiPwm.PWM(normalizedPin);
            break;
          default:
            console.warn('Unknown pin mode: ' + mode);
            break;
        }
      }
      pinInstance.mode = mode;
    }
  }, {
    key: 'analogRead',
    value: function analogRead() {
      throw new Error('analogRead is not supported on the Raspberry Pi');
    }
  }, {
    key: 'analogWrite',
    value: function analogWrite(pin, value) {
      var pinInstance = this[getPinInstance](this.normalize(pin));
      if (pinInstance.mode != PWM_MODE) {
        this.pinMode(pin, PWM_MODE);
      }
      pinInstance.peripheral.write(Math.round(value * 1000 / 255));
    }
  }, {
    key: 'digitalRead',
    value: function digitalRead(pin, handler) {
      var _this2 = this;

      var pinInstance = this[getPinInstance](this.normalize(pin));
      if (pinInstance.mode != INPUT_MODE) {
        this.pinMode(pin, INPUT_MODE);
      }
      var interval = setInterval(function () {
        var value = undefined;
        if (pinInstance.mode == INPUT_MODE) {
          value = pinInstance.peripheral.read();
        } else {
          value = pinInstance.previousWrittenValue;
        }
        if (handler) {
          handler(value);
        }
        _this2.emit('digital-read-' + pin, value);
      }, DIGITAL_READ_UPDATE_RATE);
      pinInstance.peripheral.on('destroyed', function () {
        clearInterval(interval);
      });
    }
  }, {
    key: 'digitalWrite',
    value: function digitalWrite(pin, value) {
      var pinInstance = this[getPinInstance](this.normalize(pin));
      if (pinInstance.mode === INPUT_MODE && value === HIGH) {
        this[_pinMode]({
          pin: pin,
          mode: INPUT_MODE,
          pullResistor: _raspiGpio.PULL_UP
        });
      } else if (pinInstance.mode != OUTPUT_MODE) {
        this[_pinMode]({
          pin: pin,
          mode: OUTPUT_MODE
        });
      }
      if (pinInstance.mode === OUTPUT_MODE && value != pinInstance.previousWrittenValue) {
        pinInstance.peripheral.write(value ? HIGH : LOW);
        pinInstance.previousWrittenValue = value;
      }
    }
  }, {
    key: 'servoWrite',
    value: function servoWrite(pin, value) {
      var pinInstance = this[getPinInstance](this.normalize(pin));
      if (pinInstance.mode != SERVO_MODE) {
        this.pinMode(pin, SERVO_MODE);
      }
      pinInstance.peripheral.write(48 + Math.round(value * 48 / 180));
    }
  }, {
    key: 'queryCapabilities',
    value: function queryCapabilities(cb) {
      if (this.isReady) {
        process.nextTick(cb);
      } else {
        this.on('ready', cb);
      }
    }
  }, {
    key: 'queryAnalogMapping',
    value: function queryAnalogMapping(cb) {
      if (this.isReady) {
        process.nextTick(cb);
      } else {
        this.on('ready', cb);
      }
    }
  }, {
    key: 'queryPinState',
    value: function queryPinState(pin, cb) {
      if (this.isReady) {
        process.nextTick(cb);
      } else {
        this.on('ready', cb);
      }
    }
  }, {
    key: i2cCheckAlive,
    value: function value() {
      if (!this[i2c].alive) {
        throw new Error('I2C pins not in I2C mode');
      }
    }
  }, {
    key: 'i2cConfig',
    value: function i2cConfig(options) {
      var delay = undefined;

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
  }, {
    key: 'i2cWrite',
    value: function i2cWrite(address, cmdRegOrData, inBytes) {
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

      var buffer = new Buffer([cmdRegOrData].concat(inBytes));

      // Only write if bytes provided
      if (buffer.length) {
        this[i2c].writeSync(address, buffer);
      }

      return this;
    }
  }, {
    key: 'i2cWriteReg',
    value: function i2cWriteReg(address, register, value) {
      this[i2cCheckAlive]();

      this[i2c].writeByteSync(address, register, value);

      return this;
    }
  }, {
    key: _i2cRead,
    value: function value(continuous, address, register, bytesToRead, callback) {
      var _this3 = this;

      this[i2cCheckAlive]();

      // Fix arguments if called with Firmata.js API
      if (arguments.length == 4 && typeof register == 'number' && typeof bytesToRead == 'function') {
        callback = bytesToRead;
        bytesToRead = register;
        register = null;
      }

      callback = typeof callback === 'function' ? callback : function () {};

      var event = 'I2C-reply' + address + '-';
      event += register !== null ? register : 0;

      var read = function read() {
        var afterRead = function afterRead(err, buffer) {
          if (err) {
            return _this3.emit('error', err);
          }

          // Convert buffer to Array before emit
          _this3.emit(event, Array.prototype.slice.call(buffer));

          if (continuous) {
            setTimeout(read, _this3[i2cDelay]);
          }
        };

        _this3.once(event, callback);

        if (register !== null) {
          _this3[i2c].read(address, register, bytesToRead, afterRead);
        } else {
          _this3[i2c].read(address, bytesToRead, afterRead);
        }
      };

      setTimeout(read, this[i2cDelay]);

      return this;
    }
  }, {
    key: 'i2cRead',
    value: function i2cRead() {
      for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
        rest[_key] = arguments[_key];
      }

      return this[_i2cRead].apply(this, [true].concat(rest));
    }
  }, {
    key: 'i2cReadOnce',
    value: function i2cReadOnce() {
      for (var _len2 = arguments.length, rest = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        rest[_key2] = arguments[_key2];
      }

      return this[_i2cRead].apply(this, [false].concat(rest));
    }
  }, {
    key: 'sendI2CConfig',
    value: function sendI2CConfig() {
      return this.i2cConfig.apply(this, arguments);
    }
  }, {
    key: 'sendI2CWriteRequest',
    value: function sendI2CWriteRequest() {
      return this.i2cWrite.apply(this, arguments);
    }
  }, {
    key: 'sendI2CReadRequest',
    value: function sendI2CReadRequest() {
      return this.i2cReadOnce.apply(this, arguments);
    }
  }, {
    key: 'sendOneWireConfig',
    value: function sendOneWireConfig(pin, enableParasiticPower) {
      (0, _syncExec2['default'])('modprobe w1-gpio');
      (0, _syncExec2['default'])('modprobe w1-therm');
    }
  }, {
    key: 'sendOneWireSearch',
    value: function sendOneWireSearch(pin, callback) {
      this._sendOneWireSearch(callback);
    }
  }, {
    key: 'sendOneWireAlarmsSearch',
    value: function sendOneWireAlarmsSearch(pin, callback) {
      this._sendOneWireSearch(callback);
    }
  }, {
    key: '_sendOneWireSearch',
    value: function _sendOneWireSearch(callback) {
      _fs2['default'].readFile(ONE_WIRE_LIST_PATH, function (err, data) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, toArray(data));
        }
      });
    }
  }, {
    key: 'sendOneWireRead',
    value: function sendOneWireRead(pin, device, numBytesToRead, callback) {
      this._sendOneWireRequest(pin, device, callback);
    }
  }, {
    key: 'sendOneWireReset',
    value: function sendOneWireReset(pin) {
      // throw new Error('sendOneWireConfig is not supported on the Raspberry Pi');
    }
  }, {
    key: 'sendOneWireWrite',
    value: function sendOneWireWrite(pin, device, data) {
      // throw new Error('sendOneWireWrite is not supported on the Raspberry Pi');
    }
  }, {
    key: 'sendOneWireDelay',
    value: function sendOneWireDelay(pin, delay) {
      // throw new Error('sendOneWireDelay is not supported on the Raspberry Pi');
    }
  }, {
    key: 'sendOneWireWriteAndRead',
    value: function sendOneWireWriteAndRead(pin, device, data, numBytesToRead, callback) {
      // throw new Error('sendOneWireWriteAndRead is not supported on the Raspberry Pi');
    }
  }, {
    key: '_getOneWireFileName',
    value: function _getOneWireFileName(deviceId) {
      return _path2['default'].resolve(ONE_WIRE_BASE_PATH, deviceId, 'w1_slave');
    }
  }, {
    key: '_sendOneWireRequest',
    value: function _sendOneWireRequest(pin, device, callback) {
      _fs2['default'].readFile(this._getOneWireFileName(device), function (err, data) {
        if (err) {
          if (err.code && err.code === 'ENOENT') {
            callback('Could not read device content. Device \'' + device + '\' not found', null);
          } else {
            callback(err, null);
          }
        } else {
          var dataStr = data.toString();

          var result = false;
          if (dataStr && dataStr.indexOf('YES') > -1) {
            var temp = dataStr.match(/t=(-?(\d+))/);

            if (temp) {
              result = round(parseInt(temp[1], 10) / 1000, 1);
            }
          }

          callback(null, result);
        }
      });
    }
  }, {
    key: 'setSamplingInterval',
    value: function setSamplingInterval() {
      throw new Error('setSamplingInterval is not yet implemented');
    }
  }, {
    key: 'reportAnalogPin',
    value: function reportAnalogPin() {
      throw new Error('reportAnalogPin is not yet implemented');
    }
  }, {
    key: 'reportDigitalPin',
    value: function reportDigitalPin() {
      throw new Error('reportDigitalPin is not yet implemented');
    }
  }, {
    key: 'pingRead',
    value: function pingRead() {
      throw new Error('pingRead is not yet implemented');
    }
  }, {
    key: 'pulseIn',
    value: function pulseIn() {
      throw new Error('pulseIn is not yet implemented');
    }
  }, {
    key: 'stepperConfig',
    value: function stepperConfig() {
      throw new Error('stepperConfig is not yet implemented');
    }
  }, {
    key: 'stepperStep',
    value: function stepperStep() {
      throw new Error('stepperStep is not yet implemented');
    }
  }]);

  return Raspi;
})(_events.EventEmitter);

Object.defineProperty(Raspi, 'isRaspberryPi', {
  enumerable: true,
  value: function value() {
    // Determining if a system is a Raspberry Pi isn't possible through
    // the os module on Raspbian, so we read it from the file system instead
    var isRaspberryPi = false;
    try {
      isRaspberryPi = _fs2['default'].readFileSync('/etc/os-release').toString().indexOf('Raspbian') !== -1;
    } catch (e) {} // Squash file not found, etc errors
    return isRaspberryPi;
  }
});

module.exports = Raspi;
//# sourceMappingURL=data:application/json;base64,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Q0FBQztLQUM1RDs7O1dBRU8sb0JBQUc7QUFDVCxZQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7S0FDcEQ7OztXQUVNLG1CQUFHO0FBQ1IsWUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0tBQ25EOzs7V0FFWSx5QkFBRztBQUNkLFlBQU0sSUFBSSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztLQUN6RDs7O1dBRVUsdUJBQUc7QUFDWixZQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7S0FDdkQ7OztTQXZqQkcsS0FBSzs7O0FBMGpCWCxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUU7QUFDNUMsWUFBVSxFQUFFLElBQUk7QUFDaEIsT0FBSyxFQUFFLGlCQUFNOzs7QUFHWCxRQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFDMUIsUUFBSTtBQUNGLG1CQUFhLEdBQUcsZ0JBQUcsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQzFGLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFDWDtBQUNELFdBQU8sYUFBYSxDQUFDO0dBQ3RCO0NBQ0YsQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuIENvcHlyaWdodCAoYykgMjAxNCBCcnlhbiBIdWdoZXMgPGJyeWFuQHRoZW9yZXRpY2FsaWRlYXRpb25zLmNvbT5cclxuXHJcbiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvblxyXG4gb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb25cclxuIGZpbGVzICh0aGUgJ1NvZnR3YXJlJyksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcclxuIHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLFxyXG4gY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcclxuIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxyXG4gU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmdcclxuIGNvbmRpdGlvbnM6XHJcblxyXG4gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcclxuIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG5cclxuIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnQVMgSVMnLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxyXG4gRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTXHJcbiBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORFxyXG4gTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcclxuIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLFxyXG4gV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HXHJcbiBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXHJcbiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXHJcbiAqL1xyXG5cclxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IGluaXQgfSBmcm9tICdyYXNwaSc7XHJcbmltcG9ydCB7IGdldFBpbnMsIGdldFBpbk51bWJlciB9IGZyb20gJ3Jhc3BpLWJvYXJkJztcclxuaW1wb3J0IHsgUFVMTF9OT05FLCBQVUxMX1VQLCBQVUxMX0RPV04sIERpZ2l0YWxPdXRwdXQsIERpZ2l0YWxJbnB1dCB9IGZyb20gJ3Jhc3BpLWdwaW8nO1xyXG5pbXBvcnQgeyBQV00gfSBmcm9tICdyYXNwaS1wd20nO1xyXG5pbXBvcnQgeyBJMkMgfSBmcm9tICdyYXNwaS1pMmMnO1xyXG5pbXBvcnQgeyBMRUQgfSBmcm9tICdyYXNwaS1sZWQnO1xyXG5pbXBvcnQgZXhlY1N5bmMgZnJvbSAnc3luYy1leGVjJztcclxuXHJcbi8vIEhhY2t5IHF1aWNrIFN5bWJvbCBwb2x5ZmlsbCwgc2luY2UgZXM2LXN5bWJvbCByZWZ1c2VzIHRvIGluc3RhbGwgd2l0aCBOb2RlIDAuMTAgZnJvbSBodHRwOi8vbm9kZS1hcm0uaGVyb2t1YXBwLmNvbS9cclxuaWYgKHR5cGVvZiBnbG9iYWwuU3ltYm9sICE9ICdmdW5jdGlvbicpIHtcclxuICBnbG9iYWwuU3ltYm9sID0gKG5hbWUpID0+IHtcclxuICAgIHJldHVybiAnX18kcmFzcGlfc3ltYm9sXycgKyBuYW1lICsgJ18nICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMHhGRkZGRkZGKSArICckX18nO1xyXG4gIH07XHJcbn1cclxuXHJcbi8vIENvbnN0YW50c1xyXG5jb25zdCBJTlBVVF9NT0RFID0gMDtcclxuY29uc3QgT1VUUFVUX01PREUgPSAxO1xyXG5jb25zdCBBTkFMT0dfTU9ERSA9IDI7XHJcbmNvbnN0IFBXTV9NT0RFID0gMztcclxuY29uc3QgU0VSVk9fTU9ERSA9IDQ7XHJcbmNvbnN0IFVOS05PV05fTU9ERSA9IDk5O1xyXG5cclxuY29uc3QgTE9XID0gMDtcclxuY29uc3QgSElHSCA9IDE7XHJcblxyXG5jb25zdCBMRURfUElOID0gLTE7XHJcblxyXG5jb25zdCBPTkVfV0lSRV9MSVNUX1BBVEggPSAnL3N5cy9kZXZpY2VzL3cxX2J1c19tYXN0ZXIxL3cxX21hc3Rlcl9zbGF2ZXMnO1xyXG5jb25zdCBPTkVfV0lSRV9CQVNFX1BBVEggPSAnL3N5cy9idXMvdzEvZGV2aWNlcy8nO1xyXG5cclxuLy8gU2V0dGluZ3NcclxuY29uc3QgRElHSVRBTF9SRUFEX1VQREFURV9SQVRFID0gMTk7XHJcblxyXG4vLyBQcml2YXRlIHN5bWJvbHNcclxuY29uc3QgaXNSZWFkeSA9IFN5bWJvbCgnaXNSZWFkeScpO1xyXG5jb25zdCBwaW5zID0gU3ltYm9sKCdwaW5zJyk7XHJcbmNvbnN0IGluc3RhbmNlcyA9IFN5bWJvbCgnaW5zdGFuY2VzJyk7XHJcbmNvbnN0IGFuYWxvZ1BpbnMgPSBTeW1ib2woJ2FuYWxvZ1BpbnMnKTtcclxuY29uc3QgZ2V0UGluSW5zdGFuY2UgPSBTeW1ib2woJ2dldFBpbkluc3RhbmNlJyk7XHJcbmNvbnN0IGkyYyA9IFN5bWJvbCgnaTJjJyk7XHJcbmNvbnN0IGkyY0RlbGF5ID0gU3ltYm9sKCdpMmNEZWxheScpO1xyXG5jb25zdCBpMmNSZWFkID0gU3ltYm9sKCdpMmNSZWFkJyk7XHJcbmNvbnN0IGkyY0NoZWNrQWxpdmUgPSBTeW1ib2woJ2kyY0NoZWNrQWxpdmUnKTtcclxuY29uc3QgcGluTW9kZSA9IFN5bWJvbCgncGluTW9kZScpO1xyXG5cclxuY29uc3QgRW5jb2RlciA9IHtcclxuICB0bzdCaXRBcnJheTogZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgdmFyIHNoaWZ0ID0gMDtcclxuICAgIHZhciBwcmV2aW91cyA9IDA7XHJcbiAgICB2YXIgb3V0cHV0ID0gW107XHJcblxyXG4gICAgZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGUpIHtcclxuICAgICAgaWYgKHNoaWZ0ID09IDApIHtcclxuICAgICAgICBvdXRwdXQucHVzaChieXRlICYgMHg3ZilcclxuICAgICAgICBzaGlmdCsrO1xyXG4gICAgICAgIHByZXZpb3VzID0gYnl0ZSA+PiA3O1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG91dHB1dC5wdXNoKCgoYnl0ZSA8PCBzaGlmdCkgJiAweDdmKSB8IHByZXZpb3VzKTtcclxuICAgICAgICBpZiAoc2hpZnQgPT0gNikge1xyXG4gICAgICAgICAgb3V0cHV0LnB1c2goYnl0ZSA+PiAxKTtcclxuICAgICAgICAgIHNoaWZ0ID0gMDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgc2hpZnQrKztcclxuICAgICAgICAgIHByZXZpb3VzID0gYnl0ZSA+PiAoOCAtIHNoaWZ0KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pXHJcblxyXG4gICAgaWYgKHNoaWZ0ID4gMCkge1xyXG4gICAgICBvdXRwdXQucHVzaChwcmV2aW91cyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG91dHB1dDtcclxuICB9LFxyXG4gIGZyb203Qml0QXJyYXk6IGZ1bmN0aW9uKGVuY29kZWQpIHtcclxuICAgIHZhciBleHBlY3RlZEJ5dGVzID0gKGVuY29kZWQubGVuZ3RoKSAqIDcgPj4gMztcclxuICAgIHZhciBkZWNvZGVkID0gW107XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBleHBlY3RlZEJ5dGVzIDsgaSsrKSB7XHJcbiAgICAgIHZhciBqID0gaSA8PCAzO1xyXG4gICAgICB2YXIgcG9zID0gcGFyc2VJbnQoai83KTtcclxuICAgICAgdmFyIHNoaWZ0ID0gaiAlIDc7XHJcbiAgICAgIGRlY29kZWRbaV0gPSAoZW5jb2RlZFtwb3NdID4+IHNoaWZ0KSB8ICgoZW5jb2RlZFtwb3MrMV0gPDwgKDcgLSBzaGlmdCkpICYgMHhGRik7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGRlY29kZWQ7XHJcbiAgfSxcclxuICBjcmM4OiBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICB2YXIgY3JjID0gMDtcclxuXHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xyXG4gICAgICB2YXIgaW5ieXRlID0gZGF0YVtpXTtcclxuXHJcbiAgICAgIGZvciAodmFyIG4gPSA4OyBuOyBuLS0pIHtcclxuICAgICAgICB2YXIgbWl4ID0gKGNyYyBeIGluYnl0ZSkgJiAweDAxO1xyXG4gICAgICAgIGNyYyA+Pj0gMTtcclxuXHJcbiAgICAgICAgaWYgKG1peCkge1xyXG4gICAgICAgICAgY3JjIF49IDB4OEM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpbmJ5dGUgPj49IDE7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBjcmM7XHJcbiAgfSxcclxuICByZWFkRGV2aWNlczogZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgdmFyIGRldmljZUJ5dGVzID0gRW5jb2Rlci5mcm9tN0JpdEFycmF5KGRhdGEpO1xyXG4gICAgdmFyIGRldmljZXMgPSBbXTtcclxuXHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZGV2aWNlQnl0ZXMubGVuZ3RoOyBpICs9IDgpIHtcclxuICAgICAgdmFyIGRldmljZSA9IGRldmljZUJ5dGVzLnNsaWNlKGksIGkgKyA4KTtcclxuXHJcbiAgICAgIGlmKGRldmljZS5sZW5ndGggIT0gOCkge1xyXG4gICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB2YXIgY2hlY2sgPSBFbmNvZGVyLmNyYzgoZGV2aWNlLnNsaWNlKDAsIDcpKTtcclxuXHJcbiAgICAgIGlmKGNoZWNrICE9IGRldmljZVs3XSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJST00gaW52YWxpZCFcIik7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGRldmljZXMucHVzaChkZXZpY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBkZXZpY2VzO1xyXG4gIH1cclxufTtcclxuXHJcbmZ1bmN0aW9uIHRvQXJyYXkoYnVmZmVyKSB7XHJcbiAgdmFyIGRldmljZXMgPSBFbmNvZGVyLnJlYWREZXZpY2VzKGJ1ZmZlcik7XHJcbiAgY29uc29sZS5sb2coJ0JVRkZFUicsIGRldmljZXMpO1xyXG4gIGNvbnNvbGUubG9nKCdCVUZGRVInLCBkZXZpY2VzWzBdKTtcclxuICBjb25zdCByZXN1bHQgPSBidWZmZXIudG9TdHJpbmcoKS5zcGxpdCgnXFxuJykubWFwKGkgPT4ge1xyXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoaS50cmltKCkpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gcmVzdWx0LmZpbHRlcihpdGVtID0+IHtcclxuICAgIHJldHVybiAhIWl0ZW07XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJvdW5kKG51bWJlciwgcGxhY2VzKSB7XHJcbiAgY29uc3QgcG93ID0gTWF0aC5wb3coMTAsIHBsYWNlcyk7XHJcbiAgcmV0dXJuIE1hdGgucm91bmQobnVtYmVyICogcG93KSAvIHBvdztcclxufVxyXG5cclxuY2xhc3MgUmFzcGkgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xyXG4gICAgICBuYW1lOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogJ1Jhc3BiZXJyeVBpLUlPJ1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgW2luc3RhbmNlc106IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogW11cclxuICAgICAgfSxcclxuXHJcbiAgICAgIFtpc1JlYWR5XToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBmYWxzZVxyXG4gICAgICB9LFxyXG4gICAgICBpc1JlYWR5OiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpc1tpc1JlYWR5XTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbcGluc106IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogW11cclxuICAgICAgfSxcclxuICAgICAgcGluczoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXNbcGluc107XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgW2FuYWxvZ1BpbnNdOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IFtdXHJcbiAgICAgIH0sXHJcbiAgICAgIGFuYWxvZ1BpbnM6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGdldCgpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzW2FuYWxvZ1BpbnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuXHJcbiAgICAgIFtpMmNdOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IG5ldyBJMkMoKVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgW2kyY0RlbGF5XToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiAwXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBNT0RFUzoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IE9iamVjdC5mcmVlemUoe1xyXG4gICAgICAgICAgSU5QVVQ6IElOUFVUX01PREUsXHJcbiAgICAgICAgICBPVVRQVVQ6IE9VVFBVVF9NT0RFLFxyXG4gICAgICAgICAgQU5BTE9HOiBBTkFMT0dfTU9ERSxcclxuICAgICAgICAgIFBXTTogUFdNX01PREUsXHJcbiAgICAgICAgICBTRVJWTzogU0VSVk9fTU9ERVxyXG4gICAgICAgIH0pXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBISUdIOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogSElHSFxyXG4gICAgICB9LFxyXG4gICAgICBMT1c6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBMT1dcclxuICAgICAgfSxcclxuXHJcbiAgICAgIGRlZmF1bHRMZWQ6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBMRURfUElOXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGluaXQoKCkgPT4ge1xyXG4gICAgICBjb25zdCBwaW5NYXBwaW5ncyA9IGdldFBpbnMoKTtcclxuICAgICAgdGhpc1twaW5zXSA9IFtdO1xyXG5cclxuICAgICAgLy8gU2xpZ2h0IGhhY2sgdG8gZ2V0IHRoZSBMRUQgaW4gdGhlcmUsIHNpbmNlIGl0J3Mgbm90IGFjdHVhbGx5IGEgcGluXHJcbiAgICAgIHBpbk1hcHBpbmdzW0xFRF9QSU5dID0ge1xyXG4gICAgICAgIHBpbnM6IFtMRURfUElOXSxcclxuICAgICAgICBwZXJpcGhlcmFsczogWydncGlvJ11cclxuICAgICAgfTtcclxuXHJcbiAgICAgIE9iamVjdC5rZXlzKHBpbk1hcHBpbmdzKS5mb3JFYWNoKChwaW4pID0+IHtcclxuICAgICAgICBjb25zdCBwaW5JbmZvID0gcGluTWFwcGluZ3NbcGluXTtcclxuICAgICAgICBjb25zdCBzdXBwb3J0ZWRNb2RlcyA9IFtdO1xyXG4gICAgICAgIC8vIFdlIGRvbid0IHdhbnQgSTJDIHRvIGJlIHVzZWQgZm9yIGFueXRoaW5nIGVsc2UsIHNpbmNlIGNoYW5naW5nIHRoZVxyXG4gICAgICAgIC8vIHBpbiBtb2RlIG1ha2VzIGl0IHVuYWJsZSB0byBldmVyIGRvIEkyQyBhZ2Fpbi5cclxuICAgICAgICBpZiAocGluSW5mby5wZXJpcGhlcmFscy5pbmRleE9mKCdpMmMnKSA9PSAtMSkge1xyXG4gICAgICAgICAgaWYgKHBpbiA9PSBMRURfUElOKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZE1vZGVzLnB1c2goT1VUUFVUX01PREUpO1xyXG4gICAgICAgICAgfSBlbHNlIGlmIChwaW5JbmZvLnBlcmlwaGVyYWxzLmluZGV4T2YoJ2dwaW8nKSAhPSAtMSkge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWRNb2Rlcy5wdXNoKElOUFVUX01PREUsIE9VVFBVVF9NT0RFKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChwaW5JbmZvLnBlcmlwaGVyYWxzLmluZGV4T2YoJ3B3bScpICE9IC0xKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZE1vZGVzLnB1c2goUFdNX01PREUsIFNFUlZPX01PREUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXNbaW5zdGFuY2VzXVtwaW5dID0ge1xyXG4gICAgICAgICAgcGVyaXBoZXJhbDogbnVsbCxcclxuICAgICAgICAgIG1vZGU6IHN1cHBvcnRlZE1vZGVzLmluZGV4T2YoT1VUUFVUX01PREUpID09IC0xID8gVU5LTk9XTl9NT0RFIDogT1VUUFVUX01PREUsXHJcbiAgICAgICAgICBwcmV2aW91c1dyaXR0ZW5WYWx1ZTogTE9XXHJcbiAgICAgICAgfTtcclxuICAgICAgICB0aGlzW3BpbnNdW3Bpbl0gPSBPYmplY3QuY3JlYXRlKG51bGwsIHtcclxuICAgICAgICAgIHN1cHBvcnRlZE1vZGVzOiB7XHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIHZhbHVlOiBPYmplY3QuZnJlZXplKHN1cHBvcnRlZE1vZGVzKVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIG1vZGU6IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZS5tb2RlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgICAgIHN3aXRjaCAoaW5zdGFuY2UubW9kZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJTlBVVF9NT0RFOlxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UucGVyaXBoZXJhbC5yZWFkKCk7XHJcbiAgICAgICAgICAgICAgICBjYXNlIE9VVFBVVF9NT0RFOlxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UucHJldmlvdXNXcml0dGVuVmFsdWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNldCh2YWx1ZSkge1xyXG4gICAgICAgICAgICAgIGlmIChpbnN0YW5jZS5tb2RlID09IE9VVFBVVF9NT0RFKSB7XHJcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5wZXJpcGhlcmFsLndyaXRlKHZhbHVlKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICByZXBvcnQ6IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgdmFsdWU6IDFcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBhbmFsb2dDaGFubmVsOiB7XHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIHZhbHVlOiAxMjdcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAoaW5zdGFuY2UubW9kZSA9PSBPVVRQVVRfTU9ERSkge1xyXG4gICAgICAgICAgdGhpcy5waW5Nb2RlKHBpbiwgT1VUUFVUX01PREUpO1xyXG4gICAgICAgICAgdGhpcy5kaWdpdGFsV3JpdGUocGluLCBMT1cpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBGaWxsIGluIHRoZSBob2xlcywgc2lucyBwaW5zIGFyZSBzcGFyc2Ugb24gdGhlIEErL0IrLzJcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzW3BpbnNdLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKCF0aGlzW3BpbnNdW2ldKSB7XHJcbiAgICAgICAgICB0aGlzW3BpbnNdW2ldID0gT2JqZWN0LmNyZWF0ZShudWxsLCB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZE1vZGVzOiB7XHJcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICB2YWx1ZTogT2JqZWN0LmZyZWV6ZShbXSlcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbW9kZToge1xyXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFVOS05PV05fTU9ERTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIHNldCgpIHtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlcG9ydDoge1xyXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgdmFsdWU6IDFcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYW5hbG9nQ2hhbm5lbDoge1xyXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgdmFsdWU6IDEyN1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXNbaXNSZWFkeV0gPSB0cnVlO1xyXG4gICAgICB0aGlzLmVtaXQoJ3JlYWR5Jyk7XHJcbiAgICAgIHRoaXMuZW1pdCgnY29ubmVjdCcpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXNldCgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcigncmVzZXQgaXMgbm90IHN1cHBvcnRlZCBvbiB0aGUgUmFzcGJlcnJ5IFBpJyk7XHJcbiAgfVxyXG5cclxuICBub3JtYWxpemUocGluKSB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkUGluID0gZ2V0UGluTnVtYmVyKHBpbik7XHJcbiAgICBpZiAodHlwZW9mIG5vcm1hbGl6ZWRQaW4gPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHBpbiBcIicgKyBwaW4gKyAnXCInKTtcclxuICAgIH1cclxuICAgIHJldHVybiBub3JtYWxpemVkUGluO1xyXG4gIH1cclxuXHJcbiAgW2dldFBpbkluc3RhbmNlXShwaW4pIHtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tpbnN0YW5jZXNdW3Bpbl07XHJcbiAgICBpZiAoIXBpbkluc3RhbmNlKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBwaW4gXCInICsgcGluICsgJ1wiJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcGluSW5zdGFuY2U7XHJcbiAgfVxyXG5cclxuICBwaW5Nb2RlKHBpbiwgbW9kZSkge1xyXG4gICAgdGhpc1twaW5Nb2RlXSh7XHJcbiAgICAgIHBpbixcclxuICAgICAgbW9kZVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBbcGluTW9kZV0oeyBwaW4sIG1vZGUsIHB1bGxSZXNpc3RvciA9IFBVTExfTk9ORSB9KSB7XHJcbiAgICBjb25zdCBub3JtYWxpemVkUGluID0gdGhpcy5ub3JtYWxpemUocGluKTtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tnZXRQaW5JbnN0YW5jZV0obm9ybWFsaXplZFBpbik7XHJcbiAgICBwaW5JbnN0YW5jZS5wdWxsUmVzaXN0b3IgPSBwdWxsUmVzaXN0b3I7XHJcbiAgICBjb25zdCBjb25maWcgPSB7XHJcbiAgICAgIHBpbjogbm9ybWFsaXplZFBpbixcclxuICAgICAgcHVsbFJlc2lzdG9yOiBwaW5JbnN0YW5jZS5wdWxsUmVzaXN0b3JcclxuICAgIH07XHJcbiAgICBpZiAodGhpc1twaW5zXVtub3JtYWxpemVkUGluXS5zdXBwb3J0ZWRNb2Rlcy5pbmRleE9mKG1vZGUpID09IC0xKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGluIFwiJyArIHBpbiArICdcIiBkb2VzIG5vdCBzdXBwb3J0IG1vZGUgXCInICsgbW9kZSArICdcIicpO1xyXG4gICAgfVxyXG4gICAgaWYgKHBpbiA9PSBMRURfUElOICYmICEocGluSW5zdGFuY2UucGVyaXBoZXJhbCBpbnN0YW5jZW9mIExFRCkpIHtcclxuICAgICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbCA9IG5ldyBMRUQoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHN3aXRjaCAobW9kZSkge1xyXG4gICAgICAgIGNhc2UgSU5QVVRfTU9ERTpcclxuICAgICAgICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwgPSBuZXcgRGlnaXRhbElucHV0KGNvbmZpZyk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIE9VVFBVVF9NT0RFOlxyXG4gICAgICAgICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbCA9IG5ldyBEaWdpdGFsT3V0cHV0KGNvbmZpZyk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIFBXTV9NT0RFOlxyXG4gICAgICAgIGNhc2UgU0VSVk9fTU9ERTpcclxuICAgICAgICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwgPSBuZXcgUFdNKG5vcm1hbGl6ZWRQaW4pO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgIGNvbnNvbGUud2FybignVW5rbm93biBwaW4gbW9kZTogJyArIG1vZGUpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHBpbkluc3RhbmNlLm1vZGUgPSBtb2RlO1xyXG4gIH1cclxuXHJcbiAgYW5hbG9nUmVhZCgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignYW5hbG9nUmVhZCBpcyBub3Qgc3VwcG9ydGVkIG9uIHRoZSBSYXNwYmVycnkgUGknKTtcclxuICB9XHJcblxyXG4gIGFuYWxvZ1dyaXRlKHBpbiwgdmFsdWUpIHtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tnZXRQaW5JbnN0YW5jZV0odGhpcy5ub3JtYWxpemUocGluKSk7XHJcbiAgICBpZiAocGluSW5zdGFuY2UubW9kZSAhPSBQV01fTU9ERSkge1xyXG4gICAgICB0aGlzLnBpbk1vZGUocGluLCBQV01fTU9ERSk7XHJcbiAgICB9XHJcbiAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsLndyaXRlKE1hdGgucm91bmQodmFsdWUgKiAxMDAwIC8gMjU1KSk7XHJcbiAgfVxyXG5cclxuICBkaWdpdGFsUmVhZChwaW4sIGhhbmRsZXIpIHtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tnZXRQaW5JbnN0YW5jZV0odGhpcy5ub3JtYWxpemUocGluKSk7XHJcbiAgICBpZiAocGluSW5zdGFuY2UubW9kZSAhPSBJTlBVVF9NT0RFKSB7XHJcbiAgICAgIHRoaXMucGluTW9kZShwaW4sIElOUFVUX01PREUpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIGxldCB2YWx1ZTtcclxuICAgICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgPT0gSU5QVVRfTU9ERSkge1xyXG4gICAgICAgIHZhbHVlID0gcGluSW5zdGFuY2UucGVyaXBoZXJhbC5yZWFkKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFsdWUgPSBwaW5JbnN0YW5jZS5wcmV2aW91c1dyaXR0ZW5WYWx1ZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICAgIGhhbmRsZXIodmFsdWUpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuZW1pdCgnZGlnaXRhbC1yZWFkLScgKyBwaW4sIHZhbHVlKTtcclxuICAgIH0sIERJR0lUQUxfUkVBRF9VUERBVEVfUkFURSk7XHJcbiAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsLm9uKCdkZXN0cm95ZWQnLCAoKSA9PiB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBkaWdpdGFsV3JpdGUocGluLCB2YWx1ZSkge1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2dldFBpbkluc3RhbmNlXSh0aGlzLm5vcm1hbGl6ZShwaW4pKTtcclxuICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlID09PSBJTlBVVF9NT0RFICYmIHZhbHVlID09PSBISUdIKSB7XHJcbiAgICAgIHRoaXNbcGluTW9kZV0oe1xyXG4gICAgICAgIHBpbixcclxuICAgICAgICBtb2RlOiBJTlBVVF9NT0RFLFxyXG4gICAgICAgIHB1bGxSZXNpc3RvcjogUFVMTF9VUFxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSBpZiAocGluSW5zdGFuY2UubW9kZSAhPSBPVVRQVVRfTU9ERSkge1xyXG4gICAgICB0aGlzW3Bpbk1vZGVdKHtcclxuICAgICAgICBwaW4sXHJcbiAgICAgICAgbW9kZTogT1VUUFVUX01PREVcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBpZiAocGluSW5zdGFuY2UubW9kZSA9PT0gT1VUUFVUX01PREUgJiYgdmFsdWUgIT0gcGluSW5zdGFuY2UucHJldmlvdXNXcml0dGVuVmFsdWUpIHtcclxuICAgICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbC53cml0ZSh2YWx1ZSA/IEhJR0ggOiBMT1cpO1xyXG4gICAgICBwaW5JbnN0YW5jZS5wcmV2aW91c1dyaXR0ZW5WYWx1ZSA9IHZhbHVlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgc2Vydm9Xcml0ZShwaW4sIHZhbHVlKSB7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbZ2V0UGluSW5zdGFuY2VdKHRoaXMubm9ybWFsaXplKHBpbikpO1xyXG4gICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgIT0gU0VSVk9fTU9ERSkge1xyXG4gICAgICB0aGlzLnBpbk1vZGUocGluLCBTRVJWT19NT0RFKTtcclxuICAgIH1cclxuICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwud3JpdGUoNDggKyBNYXRoLnJvdW5kKHZhbHVlICogNDggLyAxODApKTtcclxuICB9XHJcblxyXG4gIHF1ZXJ5Q2FwYWJpbGl0aWVzKGNiKSB7XHJcbiAgICBpZiAodGhpcy5pc1JlYWR5KSB7XHJcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY2IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vbigncmVhZHknLCBjYik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBxdWVyeUFuYWxvZ01hcHBpbmcoY2IpIHtcclxuICAgIGlmICh0aGlzLmlzUmVhZHkpIHtcclxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhjYik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm9uKCdyZWFkeScsIGNiKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHF1ZXJ5UGluU3RhdGUocGluLCBjYikge1xyXG4gICAgaWYgKHRoaXMuaXNSZWFkeSkge1xyXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGNiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMub24oJ3JlYWR5JywgY2IpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgW2kyY0NoZWNrQWxpdmVdKCkge1xyXG4gICAgaWYgKCF0aGlzW2kyY10uYWxpdmUpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJMkMgcGlucyBub3QgaW4gSTJDIG1vZGUnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGkyY0NvbmZpZyhvcHRpb25zKSB7XHJcbiAgICBsZXQgZGVsYXk7XHJcblxyXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnbnVtYmVyJykge1xyXG4gICAgICBkZWxheSA9IG9wdGlvbnM7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnICYmIG9wdGlvbnMgIT09IG51bGwpIHtcclxuICAgICAgICBkZWxheSA9IG9wdGlvbnMuZGVsYXk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzW2kyY0NoZWNrQWxpdmVdKCk7XHJcblxyXG4gICAgdGhpc1tpMmNEZWxheV0gPSBkZWxheSB8fCAwO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgaTJjV3JpdGUoYWRkcmVzcywgY21kUmVnT3JEYXRhLCBpbkJ5dGVzKSB7XHJcbiAgICB0aGlzW2kyY0NoZWNrQWxpdmVdKCk7XHJcblxyXG4gICAgLy8gSWYgaTJjV3JpdGUgd2FzIHVzZWQgZm9yIGFuIGkyY1dyaXRlUmVnIGNhbGwuLi5cclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzICYmICFBcnJheS5pc0FycmF5KGNtZFJlZ09yRGF0YSkgJiYgIUFycmF5LmlzQXJyYXkoaW5CeXRlcykpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuaTJjV3JpdGVSZWcoYWRkcmVzcywgY21kUmVnT3JEYXRhLCBpbkJ5dGVzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBGaXggYXJndW1lbnRzIGlmIGNhbGxlZCB3aXRoIEZpcm1hdGEuanMgQVBJXHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xyXG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShjbWRSZWdPckRhdGEpKSB7XHJcbiAgICAgICAgaW5CeXRlcyA9IGNtZFJlZ09yRGF0YS5zbGljZSgpO1xyXG4gICAgICAgIGNtZFJlZ09yRGF0YSA9IGluQnl0ZXMuc2hpZnQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpbkJ5dGVzID0gW107XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQnVmZmVyKFtjbWRSZWdPckRhdGFdLmNvbmNhdChpbkJ5dGVzKSk7XHJcblxyXG4gICAgLy8gT25seSB3cml0ZSBpZiBieXRlcyBwcm92aWRlZFxyXG4gICAgaWYgKGJ1ZmZlci5sZW5ndGgpIHtcclxuICAgICAgdGhpc1tpMmNdLndyaXRlU3luYyhhZGRyZXNzLCBidWZmZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgaTJjV3JpdGVSZWcoYWRkcmVzcywgcmVnaXN0ZXIsIHZhbHVlKSB7XHJcbiAgICB0aGlzW2kyY0NoZWNrQWxpdmVdKCk7XHJcblxyXG4gICAgdGhpc1tpMmNdLndyaXRlQnl0ZVN5bmMoYWRkcmVzcywgcmVnaXN0ZXIsIHZhbHVlKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIFtpMmNSZWFkXShjb250aW51b3VzLCBhZGRyZXNzLCByZWdpc3RlciwgYnl0ZXNUb1JlYWQsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzW2kyY0NoZWNrQWxpdmVdKCk7XHJcblxyXG4gICAgLy8gRml4IGFyZ3VtZW50cyBpZiBjYWxsZWQgd2l0aCBGaXJtYXRhLmpzIEFQSVxyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gNCAmJiB0eXBlb2YgcmVnaXN0ZXIgPT0gJ251bWJlcicgJiYgdHlwZW9mIGJ5dGVzVG9SZWFkID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgY2FsbGJhY2sgPSBieXRlc1RvUmVhZDtcclxuICAgICAgYnl0ZXNUb1JlYWQgPSByZWdpc3RlcjtcclxuICAgICAgcmVnaXN0ZXIgPSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNhbGxiYWNrID0gdHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nID8gY2FsbGJhY2sgOiAoKSA9PiB7XHJcbiAgICB9O1xyXG5cclxuICAgIGxldCBldmVudCA9ICdJMkMtcmVwbHknICsgYWRkcmVzcyArICctJztcclxuICAgIGV2ZW50ICs9IHJlZ2lzdGVyICE9PSBudWxsID8gcmVnaXN0ZXIgOiAwO1xyXG5cclxuICAgIGNvbnN0IHJlYWQgPSAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGFmdGVyUmVhZCA9IChlcnIsIGJ1ZmZlcikgPT4ge1xyXG4gICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIENvbnZlcnQgYnVmZmVyIHRvIEFycmF5IGJlZm9yZSBlbWl0XHJcbiAgICAgICAgdGhpcy5lbWl0KGV2ZW50LCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChidWZmZXIpKTtcclxuXHJcbiAgICAgICAgaWYgKGNvbnRpbnVvdXMpIHtcclxuICAgICAgICAgIHNldFRpbWVvdXQocmVhZCwgdGhpc1tpMmNEZWxheV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICAgIHRoaXMub25jZShldmVudCwgY2FsbGJhY2spO1xyXG5cclxuICAgICAgaWYgKHJlZ2lzdGVyICE9PSBudWxsKSB7XHJcbiAgICAgICAgdGhpc1tpMmNdLnJlYWQoYWRkcmVzcywgcmVnaXN0ZXIsIGJ5dGVzVG9SZWFkLCBhZnRlclJlYWQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXNbaTJjXS5yZWFkKGFkZHJlc3MsIGJ5dGVzVG9SZWFkLCBhZnRlclJlYWQpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHNldFRpbWVvdXQocmVhZCwgdGhpc1tpMmNEZWxheV0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgaTJjUmVhZCguLi5yZXN0KSB7XHJcbiAgICByZXR1cm4gdGhpc1tpMmNSZWFkXSh0cnVlLCAuLi5yZXN0KTtcclxuICB9XHJcblxyXG4gIGkyY1JlYWRPbmNlKC4uLnJlc3QpIHtcclxuICAgIHJldHVybiB0aGlzW2kyY1JlYWRdKGZhbHNlLCAuLi5yZXN0KTtcclxuICB9XHJcblxyXG4gIHNlbmRJMkNDb25maWcoLi4ucmVzdCkge1xyXG4gICAgcmV0dXJuIHRoaXMuaTJjQ29uZmlnKC4uLnJlc3QpO1xyXG4gIH1cclxuXHJcbiAgc2VuZEkyQ1dyaXRlUmVxdWVzdCguLi5yZXN0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5pMmNXcml0ZSguLi5yZXN0KTtcclxuICB9XHJcblxyXG4gIHNlbmRJMkNSZWFkUmVxdWVzdCguLi5yZXN0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5pMmNSZWFkT25jZSguLi5yZXN0KTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlQ29uZmlnKHBpbiwgZW5hYmxlUGFyYXNpdGljUG93ZXIpIHtcclxuICAgIGV4ZWNTeW5jKCdtb2Rwcm9iZSB3MS1ncGlvJyk7XHJcbiAgICBleGVjU3luYygnbW9kcHJvYmUgdzEtdGhlcm0nKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlU2VhcmNoKHBpbiwgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuX3NlbmRPbmVXaXJlU2VhcmNoKGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlQWxhcm1zU2VhcmNoKHBpbiwgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuX3NlbmRPbmVXaXJlU2VhcmNoKGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIF9zZW5kT25lV2lyZVNlYXJjaChjYWxsYmFjaykge1xyXG4gICAgZnMucmVhZEZpbGUoT05FX1dJUkVfTElTVF9QQVRILCAoZXJyLCBkYXRhKSA9PiB7XHJcbiAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRvQXJyYXkoZGF0YSkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlUmVhZChwaW4sIGRldmljZSwgbnVtQnl0ZXNUb1JlYWQsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLl9zZW5kT25lV2lyZVJlcXVlc3QocGluLCBkZXZpY2UsIGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlUmVzZXQocGluKSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlQ29uZmlnIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVXcml0ZShwaW4sIGRldmljZSwgZGF0YSkge1xyXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKCdzZW5kT25lV2lyZVdyaXRlIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVEZWxheShwaW4sIGRlbGF5KSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlRGVsYXkgaXMgbm90IHN1cHBvcnRlZCBvbiB0aGUgUmFzcGJlcnJ5IFBpJyk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZVdyaXRlQW5kUmVhZChwaW4sIGRldmljZSwgZGF0YSwgbnVtQnl0ZXNUb1JlYWQsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlV3JpdGVBbmRSZWFkIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgX2dldE9uZVdpcmVGaWxlTmFtZShkZXZpY2VJZCkge1xyXG4gICAgcmV0dXJuIHBhdGgucmVzb2x2ZShPTkVfV0lSRV9CQVNFX1BBVEgsIGRldmljZUlkLCAndzFfc2xhdmUnKTtcclxuICB9XHJcblxyXG4gIF9zZW5kT25lV2lyZVJlcXVlc3QocGluLCBkZXZpY2UsIGNhbGxiYWNrKSB7XHJcbiAgICBmcy5yZWFkRmlsZSh0aGlzLl9nZXRPbmVXaXJlRmlsZU5hbWUoZGV2aWNlKSwgKGVyciwgZGF0YSkgPT4ge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgaWYgKGVyci5jb2RlICYmIGVyci5jb2RlID09PSAnRU5PRU5UJykge1xyXG4gICAgICAgICAgY2FsbGJhY2soJ0NvdWxkIG5vdCByZWFkIGRldmljZSBjb250ZW50LiBEZXZpY2UgXFwnJyArIGRldmljZSArICdcXCcgbm90IGZvdW5kJywgbnVsbCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IGRhdGFTdHIgPSBkYXRhLnRvU3RyaW5nKCk7XHJcblxyXG4gICAgICAgIGxldCByZXN1bHQgPSBmYWxzZTtcclxuICAgICAgICBpZiAoZGF0YVN0ciAmJiBkYXRhU3RyLmluZGV4T2YoJ1lFUycpID4gLTEpIHtcclxuICAgICAgICAgIGNvbnN0IHRlbXAgPSBkYXRhU3RyLm1hdGNoKC90PSgtPyhcXGQrKSkvKTtcclxuXHJcbiAgICAgICAgICBpZiAodGVtcCkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSByb3VuZChwYXJzZUludCh0ZW1wWzFdLCAxMCkgLyAxMDAwLCAxKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2V0U2FtcGxpbmdJbnRlcnZhbCgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignc2V0U2FtcGxpbmdJbnRlcnZhbCBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICByZXBvcnRBbmFsb2dQaW4oKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlcG9ydEFuYWxvZ1BpbiBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICByZXBvcnREaWdpdGFsUGluKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdyZXBvcnREaWdpdGFsUGluIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcblxyXG4gIHBpbmdSZWFkKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwaW5nUmVhZCBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICBwdWxzZUluKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwdWxzZUluIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcblxyXG4gIHN0ZXBwZXJDb25maWcoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0ZXBwZXJDb25maWcgaXMgbm90IHlldCBpbXBsZW1lbnRlZCcpO1xyXG4gIH1cclxuXHJcbiAgc3RlcHBlclN0ZXAoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0ZXBwZXJTdGVwIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcbn1cclxuXHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSYXNwaSwgJ2lzUmFzcGJlcnJ5UGknLCB7XHJcbiAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICB2YWx1ZTogKCkgPT4ge1xyXG4gICAgLy8gRGV0ZXJtaW5pbmcgaWYgYSBzeXN0ZW0gaXMgYSBSYXNwYmVycnkgUGkgaXNuJ3QgcG9zc2libGUgdGhyb3VnaFxyXG4gICAgLy8gdGhlIG9zIG1vZHVsZSBvbiBSYXNwYmlhbiwgc28gd2UgcmVhZCBpdCBmcm9tIHRoZSBmaWxlIHN5c3RlbSBpbnN0ZWFkXHJcbiAgICBsZXQgaXNSYXNwYmVycnlQaSA9IGZhbHNlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgaXNSYXNwYmVycnlQaSA9IGZzLnJlYWRGaWxlU3luYygnL2V0Yy9vcy1yZWxlYXNlJykudG9TdHJpbmcoKS5pbmRleE9mKCdSYXNwYmlhbicpICE9PSAtMTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgIH0vLyBTcXVhc2ggZmlsZSBub3QgZm91bmQsIGV0YyBlcnJvcnNcclxuICAgIHJldHVybiBpc1Jhc3BiZXJyeVBpO1xyXG4gIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJhc3BpO1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
