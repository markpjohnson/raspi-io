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

function toArray(buffer) {
  constresult = buffer.toString().split('\n').map(function (i) {
    return i.trim();
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
      _syncExec2['default'].run('modprobe w1-gpio');
      _syncExec2['default'].run('modprobe w1-therm');
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

          var _result = false;
          if (dataStr && dataStr.indexOf('YES') > -1) {
            var temp = dataStr.match(/t=(-?(\d+))/);

            if (temp) {
              _result = round(parseInt(temp[1], 10) / 1000, 1);
            }
          }

          callback(null, _result);
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
//# sourceMappingURL=data:application/json;base64,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QUMsQ0FBQztTQUN4QjtPQUNGLENBQUMsQ0FBQztLQUNKOzs7V0FFa0IsK0JBQUc7QUFDcEIsWUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO0tBQy9EOzs7V0FFYywyQkFBRztBQUNoQixZQUFNLElBQUksS0FBSyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7S0FDM0Q7OztXQUVlLDRCQUFHO0FBQ2pCLFlBQU0sSUFBSSxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQztLQUM1RDs7O1dBRU8sb0JBQUc7QUFDVCxZQUFNLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUM7S0FDcEQ7OztXQUVNLG1CQUFHO0FBQ1IsWUFBTSxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDO0tBQ25EOzs7V0FFWSx5QkFBRztBQUNkLFlBQU0sSUFBSSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztLQUN6RDs7O1dBRVUsdUJBQUc7QUFDWixZQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7S0FDdkQ7OztTQXZqQkcsS0FBSzs7O0FBMGpCWCxNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUU7QUFDNUMsWUFBVSxFQUFFLElBQUk7QUFDaEIsT0FBSyxFQUFFLGlCQUFNOzs7QUFHWCxRQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFDMUIsUUFBSTtBQUNGLG1CQUFhLEdBQUcsZ0JBQUcsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0tBQzFGLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFDWDtBQUNELFdBQU8sYUFBYSxDQUFDO0dBQ3RCO0NBQ0YsQ0FBQyxDQUFDOztBQUVILE1BQU0sQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDIiwiZmlsZSI6ImluZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuIENvcHlyaWdodCAoYykgMjAxNCBCcnlhbiBIdWdoZXMgPGJyeWFuQHRoZW9yZXRpY2FsaWRlYXRpb25zLmNvbT5cclxuXHJcbiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvblxyXG4gb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb25cclxuIGZpbGVzICh0aGUgJ1NvZnR3YXJlJyksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXRcclxuIHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLFxyXG4gY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcclxuIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZVxyXG4gU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmdcclxuIGNvbmRpdGlvbnM6XHJcblxyXG4gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmVcclxuIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG5cclxuIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnQVMgSVMnLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELFxyXG4gRVhQUkVTUyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTXHJcbiBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORFxyXG4gTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFRcclxuIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLFxyXG4gV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HXHJcbiBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SXHJcbiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXHJcbiAqL1xyXG5cclxuaW1wb3J0IGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IGluaXQgfSBmcm9tICdyYXNwaSc7XHJcbmltcG9ydCB7IGdldFBpbnMsIGdldFBpbk51bWJlciB9IGZyb20gJ3Jhc3BpLWJvYXJkJztcclxuaW1wb3J0IHsgUFVMTF9OT05FLCBQVUxMX1VQLCBQVUxMX0RPV04sIERpZ2l0YWxPdXRwdXQsIERpZ2l0YWxJbnB1dCB9IGZyb20gJ3Jhc3BpLWdwaW8nO1xyXG5pbXBvcnQgeyBQV00gfSBmcm9tICdyYXNwaS1wd20nO1xyXG5pbXBvcnQgeyBJMkMgfSBmcm9tICdyYXNwaS1pMmMnO1xyXG5pbXBvcnQgeyBMRUQgfSBmcm9tICdyYXNwaS1sZWQnO1xyXG5pbXBvcnQgZXhlY1N5bmMgZnJvbSAnc3luYy1leGVjJztcclxuXHJcbi8vIEhhY2t5IHF1aWNrIFN5bWJvbCBwb2x5ZmlsbCwgc2luY2UgZXM2LXN5bWJvbCByZWZ1c2VzIHRvIGluc3RhbGwgd2l0aCBOb2RlIDAuMTAgZnJvbSBodHRwOi8vbm9kZS1hcm0uaGVyb2t1YXBwLmNvbS9cclxuaWYgKHR5cGVvZiBnbG9iYWwuU3ltYm9sICE9ICdmdW5jdGlvbicpIHtcclxuICBnbG9iYWwuU3ltYm9sID0gKG5hbWUpID0+IHtcclxuICAgIHJldHVybiAnX18kcmFzcGlfc3ltYm9sXycgKyBuYW1lICsgJ18nICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMHhGRkZGRkZGKSArICckX18nO1xyXG4gIH07XHJcbn1cclxuXHJcbi8vIENvbnN0YW50c1xyXG5jb25zdCBJTlBVVF9NT0RFID0gMDtcclxuY29uc3QgT1VUUFVUX01PREUgPSAxO1xyXG5jb25zdCBBTkFMT0dfTU9ERSA9IDI7XHJcbmNvbnN0IFBXTV9NT0RFID0gMztcclxuY29uc3QgU0VSVk9fTU9ERSA9IDQ7XHJcbmNvbnN0IFVOS05PV05fTU9ERSA9IDk5O1xyXG5cclxuY29uc3QgTE9XID0gMDtcclxuY29uc3QgSElHSCA9IDE7XHJcblxyXG5jb25zdCBMRURfUElOID0gLTE7XHJcblxyXG5jb25zdCBPTkVfV0lSRV9MSVNUX1BBVEggPSAnL3N5cy9kZXZpY2VzL3cxX2J1c19tYXN0ZXIxL3cxX21hc3Rlcl9zbGF2ZXMnO1xyXG5jb25zdCBPTkVfV0lSRV9CQVNFX1BBVEggPSAnL3N5cy9idXMvdzEvZGV2aWNlcy8nO1xyXG5cclxuLy8gU2V0dGluZ3NcclxuY29uc3QgRElHSVRBTF9SRUFEX1VQREFURV9SQVRFID0gMTk7XHJcblxyXG4vLyBQcml2YXRlIHN5bWJvbHNcclxuY29uc3QgaXNSZWFkeSA9IFN5bWJvbCgnaXNSZWFkeScpO1xyXG5jb25zdCBwaW5zID0gU3ltYm9sKCdwaW5zJyk7XHJcbmNvbnN0IGluc3RhbmNlcyA9IFN5bWJvbCgnaW5zdGFuY2VzJyk7XHJcbmNvbnN0IGFuYWxvZ1BpbnMgPSBTeW1ib2woJ2FuYWxvZ1BpbnMnKTtcclxuY29uc3QgZ2V0UGluSW5zdGFuY2UgPSBTeW1ib2woJ2dldFBpbkluc3RhbmNlJyk7XHJcbmNvbnN0IGkyYyA9IFN5bWJvbCgnaTJjJyk7XHJcbmNvbnN0IGkyY0RlbGF5ID0gU3ltYm9sKCdpMmNEZWxheScpO1xyXG5jb25zdCBpMmNSZWFkID0gU3ltYm9sKCdpMmNSZWFkJyk7XHJcbmNvbnN0IGkyY0NoZWNrQWxpdmUgPSBTeW1ib2woJ2kyY0NoZWNrQWxpdmUnKTtcclxuY29uc3QgcGluTW9kZSA9IFN5bWJvbCgncGluTW9kZScpO1xyXG5cclxuZnVuY3Rpb24gdG9BcnJheShidWZmZXIpIHtcclxuICBjb25zdHJlc3VsdCA9IGJ1ZmZlci50b1N0cmluZygpLnNwbGl0KCdcXG4nKS5tYXAoaSA9PiB7XHJcbiAgICByZXR1cm4gaS50cmltKCk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiByZXN1bHQuZmlsdGVyKGl0ZW0gPT4ge1xyXG4gICAgcmV0dXJuICEhaXRlbTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcm91bmQobnVtYmVyLCBwbGFjZXMpIHtcclxuICBjb25zdCBwb3cgPSBNYXRoLnBvdygxMCwgcGxhY2VzKTtcclxuICByZXR1cm4gTWF0aC5yb3VuZChudW1iZXIgKiBwb3cpIC8gcG93O1xyXG59XHJcblxyXG5jbGFzcyBSYXNwaSBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XHJcbiAgICAgIG5hbWU6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiAnUmFzcGJlcnJ5UGktSU8nXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbaW5zdGFuY2VzXToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBbXVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgW2lzUmVhZHldOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IGZhbHNlXHJcbiAgICAgIH0sXHJcbiAgICAgIGlzUmVhZHk6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGdldCgpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzW2lzUmVhZHldO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuXHJcbiAgICAgIFtwaW5zXToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBbXVxyXG4gICAgICB9LFxyXG4gICAgICBwaW5zOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpc1twaW5zXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbYW5hbG9nUGluc106IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogW11cclxuICAgICAgfSxcclxuICAgICAgYW5hbG9nUGluczoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXNbYW5hbG9nUGluc107XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgW2kyY106IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogbmV3IEkyQygpXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbaTJjRGVsYXldOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IDBcclxuICAgICAgfSxcclxuXHJcbiAgICAgIE1PREVTOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogT2JqZWN0LmZyZWV6ZSh7XHJcbiAgICAgICAgICBJTlBVVDogSU5QVVRfTU9ERSxcclxuICAgICAgICAgIE9VVFBVVDogT1VUUFVUX01PREUsXHJcbiAgICAgICAgICBBTkFMT0c6IEFOQUxPR19NT0RFLFxyXG4gICAgICAgICAgUFdNOiBQV01fTU9ERSxcclxuICAgICAgICAgIFNFUlZPOiBTRVJWT19NT0RFXHJcbiAgICAgICAgfSlcclxuICAgICAgfSxcclxuXHJcbiAgICAgIEhJR0g6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBISUdIXHJcbiAgICAgIH0sXHJcbiAgICAgIExPVzoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IExPV1xyXG4gICAgICB9LFxyXG5cclxuICAgICAgZGVmYXVsdExlZDoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IExFRF9QSU5cclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgaW5pdCgoKSA9PiB7XHJcbiAgICAgIGNvbnN0IHBpbk1hcHBpbmdzID0gZ2V0UGlucygpO1xyXG4gICAgICB0aGlzW3BpbnNdID0gW107XHJcblxyXG4gICAgICAvLyBTbGlnaHQgaGFjayB0byBnZXQgdGhlIExFRCBpbiB0aGVyZSwgc2luY2UgaXQncyBub3QgYWN0dWFsbHkgYSBwaW5cclxuICAgICAgcGluTWFwcGluZ3NbTEVEX1BJTl0gPSB7XHJcbiAgICAgICAgcGluczogW0xFRF9QSU5dLFxyXG4gICAgICAgIHBlcmlwaGVyYWxzOiBbJ2dwaW8nXVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgT2JqZWN0LmtleXMocGluTWFwcGluZ3MpLmZvckVhY2goKHBpbikgPT4ge1xyXG4gICAgICAgIGNvbnN0IHBpbkluZm8gPSBwaW5NYXBwaW5nc1twaW5dO1xyXG4gICAgICAgIGNvbnN0IHN1cHBvcnRlZE1vZGVzID0gW107XHJcbiAgICAgICAgLy8gV2UgZG9uJ3Qgd2FudCBJMkMgdG8gYmUgdXNlZCBmb3IgYW55dGhpbmcgZWxzZSwgc2luY2UgY2hhbmdpbmcgdGhlXHJcbiAgICAgICAgLy8gcGluIG1vZGUgbWFrZXMgaXQgdW5hYmxlIHRvIGV2ZXIgZG8gSTJDIGFnYWluLlxyXG4gICAgICAgIGlmIChwaW5JbmZvLnBlcmlwaGVyYWxzLmluZGV4T2YoJ2kyYycpID09IC0xKSB7XHJcbiAgICAgICAgICBpZiAocGluID09IExFRF9QSU4pIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkTW9kZXMucHVzaChPVVRQVVRfTU9ERSk7XHJcbiAgICAgICAgICB9IGVsc2UgaWYgKHBpbkluZm8ucGVyaXBoZXJhbHMuaW5kZXhPZignZ3BpbycpICE9IC0xKSB7XHJcbiAgICAgICAgICAgIHN1cHBvcnRlZE1vZGVzLnB1c2goSU5QVVRfTU9ERSwgT1VUUFVUX01PREUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKHBpbkluZm8ucGVyaXBoZXJhbHMuaW5kZXhPZigncHdtJykgIT0gLTEpIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkTW9kZXMucHVzaChQV01fTU9ERSwgU0VSVk9fTU9ERSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gdGhpc1tpbnN0YW5jZXNdW3Bpbl0gPSB7XHJcbiAgICAgICAgICBwZXJpcGhlcmFsOiBudWxsLFxyXG4gICAgICAgICAgbW9kZTogc3VwcG9ydGVkTW9kZXMuaW5kZXhPZihPVVRQVVRfTU9ERSkgPT0gLTEgPyBVTktOT1dOX01PREUgOiBPVVRQVVRfTU9ERSxcclxuICAgICAgICAgIHByZXZpb3VzV3JpdHRlblZhbHVlOiBMT1dcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXNbcGluc11bcGluXSA9IE9iamVjdC5jcmVhdGUobnVsbCwge1xyXG4gICAgICAgICAgc3VwcG9ydGVkTW9kZXM6IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgdmFsdWU6IE9iamVjdC5mcmVlemUoc3VwcG9ydGVkTW9kZXMpXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgbW9kZToge1xyXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlLm1vZGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICAgICAgc3dpdGNoIChpbnN0YW5jZS5tb2RlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIElOUFVUX01PREU6XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZS5wZXJpcGhlcmFsLnJlYWQoKTtcclxuICAgICAgICAgICAgICAgIGNhc2UgT1VUUFVUX01PREU6XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZS5wcmV2aW91c1dyaXR0ZW5WYWx1ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc2V0KHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgaWYgKGluc3RhbmNlLm1vZGUgPT0gT1VUUFVUX01PREUpIHtcclxuICAgICAgICAgICAgICAgIGluc3RhbmNlLnBlcmlwaGVyYWwud3JpdGUodmFsdWUpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHJlcG9ydDoge1xyXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICB2YWx1ZTogMVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIGFuYWxvZ0NoYW5uZWw6IHtcclxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgdmFsdWU6IDEyN1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIGlmIChpbnN0YW5jZS5tb2RlID09IE9VVFBVVF9NT0RFKSB7XHJcbiAgICAgICAgICB0aGlzLnBpbk1vZGUocGluLCBPVVRQVVRfTU9ERSk7XHJcbiAgICAgICAgICB0aGlzLmRpZ2l0YWxXcml0ZShwaW4sIExPVyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEZpbGwgaW4gdGhlIGhvbGVzLCBzaW5zIHBpbnMgYXJlIHNwYXJzZSBvbiB0aGUgQSsvQisvMlxyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXNbcGluc10ubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBpZiAoIXRoaXNbcGluc11baV0pIHtcclxuICAgICAgICAgIHRoaXNbcGluc11baV0gPSBPYmplY3QuY3JlYXRlKG51bGwsIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkTW9kZXM6IHtcclxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgIHZhbHVlOiBPYmplY3QuZnJlZXplKFtdKVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBtb2RlOiB7XHJcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gVU5LTk9XTl9NT0RFO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGdldCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgc2V0KCkge1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVwb3J0OiB7XHJcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICB2YWx1ZTogMVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBhbmFsb2dDaGFubmVsOiB7XHJcbiAgICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICB2YWx1ZTogMTI3XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpc1tpc1JlYWR5XSA9IHRydWU7XHJcbiAgICAgIHRoaXMuZW1pdCgncmVhZHknKTtcclxuICAgICAgdGhpcy5lbWl0KCdjb25uZWN0Jyk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHJlc2V0KCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdyZXNldCBpcyBub3Qgc3VwcG9ydGVkIG9uIHRoZSBSYXNwYmVycnkgUGknKTtcclxuICB9XHJcblxyXG4gIG5vcm1hbGl6ZShwaW4pIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRQaW4gPSBnZXRQaW5OdW1iZXIocGluKTtcclxuICAgIGlmICh0eXBlb2Ygbm9ybWFsaXplZFBpbiA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gcGluIFwiJyArIHBpbiArICdcIicpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWRQaW47XHJcbiAgfVxyXG5cclxuICBbZ2V0UGluSW5zdGFuY2VdKHBpbikge1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2luc3RhbmNlc11bcGluXTtcclxuICAgIGlmICghcGluSW5zdGFuY2UpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHBpbiBcIicgKyBwaW4gKyAnXCInKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwaW5JbnN0YW5jZTtcclxuICB9XHJcblxyXG4gIHBpbk1vZGUocGluLCBtb2RlKSB7XHJcbiAgICB0aGlzW3Bpbk1vZGVdKHtcclxuICAgICAgcGluLFxyXG4gICAgICBtb2RlXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIFtwaW5Nb2RlXSh7IHBpbiwgbW9kZSwgcHVsbFJlc2lzdG9yID0gUFVMTF9OT05FIH0pIHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRQaW4gPSB0aGlzLm5vcm1hbGl6ZShwaW4pO1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2dldFBpbkluc3RhbmNlXShub3JtYWxpemVkUGluKTtcclxuICAgIHBpbkluc3RhbmNlLnB1bGxSZXNpc3RvciA9IHB1bGxSZXNpc3RvcjtcclxuICAgIGNvbnN0IGNvbmZpZyA9IHtcclxuICAgICAgcGluOiBub3JtYWxpemVkUGluLFxyXG4gICAgICBwdWxsUmVzaXN0b3I6IHBpbkluc3RhbmNlLnB1bGxSZXNpc3RvclxyXG4gICAgfTtcclxuICAgIGlmICh0aGlzW3BpbnNdW25vcm1hbGl6ZWRQaW5dLnN1cHBvcnRlZE1vZGVzLmluZGV4T2YobW9kZSkgPT0gLTEpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQaW4gXCInICsgcGluICsgJ1wiIGRvZXMgbm90IHN1cHBvcnQgbW9kZSBcIicgKyBtb2RlICsgJ1wiJyk7XHJcbiAgICB9XHJcbiAgICBpZiAocGluID09IExFRF9QSU4gJiYgIShwaW5JbnN0YW5jZS5wZXJpcGhlcmFsIGluc3RhbmNlb2YgTEVEKSkge1xyXG4gICAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsID0gbmV3IExFRCgpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgc3dpdGNoIChtb2RlKSB7XHJcbiAgICAgICAgY2FzZSBJTlBVVF9NT0RFOlxyXG4gICAgICAgICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbCA9IG5ldyBEaWdpdGFsSW5wdXQoY29uZmlnKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgT1VUUFVUX01PREU6XHJcbiAgICAgICAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsID0gbmV3IERpZ2l0YWxPdXRwdXQoY29uZmlnKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgUFdNX01PREU6XHJcbiAgICAgICAgY2FzZSBTRVJWT19NT0RFOlxyXG4gICAgICAgICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbCA9IG5ldyBQV00obm9ybWFsaXplZFBpbik7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgY29uc29sZS53YXJuKCdVbmtub3duIHBpbiBtb2RlOiAnICsgbW9kZSk7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcGluSW5zdGFuY2UubW9kZSA9IG1vZGU7XHJcbiAgfVxyXG5cclxuICBhbmFsb2dSZWFkKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdhbmFsb2dSZWFkIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgYW5hbG9nV3JpdGUocGluLCB2YWx1ZSkge1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2dldFBpbkluc3RhbmNlXSh0aGlzLm5vcm1hbGl6ZShwaW4pKTtcclxuICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlICE9IFBXTV9NT0RFKSB7XHJcbiAgICAgIHRoaXMucGluTW9kZShwaW4sIFBXTV9NT0RFKTtcclxuICAgIH1cclxuICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwud3JpdGUoTWF0aC5yb3VuZCh2YWx1ZSAqIDEwMDAgLyAyNTUpKTtcclxuICB9XHJcblxyXG4gIGRpZ2l0YWxSZWFkKHBpbiwgaGFuZGxlcikge1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2dldFBpbkluc3RhbmNlXSh0aGlzLm5vcm1hbGl6ZShwaW4pKTtcclxuICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlICE9IElOUFVUX01PREUpIHtcclxuICAgICAgdGhpcy5waW5Nb2RlKHBpbiwgSU5QVVRfTU9ERSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgbGV0IHZhbHVlO1xyXG4gICAgICBpZiAocGluSW5zdGFuY2UubW9kZSA9PSBJTlBVVF9NT0RFKSB7XHJcbiAgICAgICAgdmFsdWUgPSBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsLnJlYWQoKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB2YWx1ZSA9IHBpbkluc3RhbmNlLnByZXZpb3VzV3JpdHRlblZhbHVlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgICAgaGFuZGxlcih2YWx1ZSk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5lbWl0KCdkaWdpdGFsLXJlYWQtJyArIHBpbiwgdmFsdWUpO1xyXG4gICAgfSwgRElHSVRBTF9SRUFEX1VQREFURV9SQVRFKTtcclxuICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwub24oJ2Rlc3Ryb3llZCcsICgpID0+IHtcclxuICAgICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGRpZ2l0YWxXcml0ZShwaW4sIHZhbHVlKSB7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbZ2V0UGluSW5zdGFuY2VdKHRoaXMubm9ybWFsaXplKHBpbikpO1xyXG4gICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgPT09IElOUFVUX01PREUgJiYgdmFsdWUgPT09IEhJR0gpIHtcclxuICAgICAgdGhpc1twaW5Nb2RlXSh7XHJcbiAgICAgICAgcGluLFxyXG4gICAgICAgIG1vZGU6IElOUFVUX01PREUsXHJcbiAgICAgICAgcHVsbFJlc2lzdG9yOiBQVUxMX1VQXHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIGlmIChwaW5JbnN0YW5jZS5tb2RlICE9IE9VVFBVVF9NT0RFKSB7XHJcbiAgICAgIHRoaXNbcGluTW9kZV0oe1xyXG4gICAgICAgIHBpbixcclxuICAgICAgICBtb2RlOiBPVVRQVVRfTU9ERVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlID09PSBPVVRQVVRfTU9ERSAmJiB2YWx1ZSAhPSBwaW5JbnN0YW5jZS5wcmV2aW91c1dyaXR0ZW5WYWx1ZSkge1xyXG4gICAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsLndyaXRlKHZhbHVlID8gSElHSCA6IExPVyk7XHJcbiAgICAgIHBpbkluc3RhbmNlLnByZXZpb3VzV3JpdHRlblZhbHVlID0gdmFsdWU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBzZXJ2b1dyaXRlKHBpbiwgdmFsdWUpIHtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tnZXRQaW5JbnN0YW5jZV0odGhpcy5ub3JtYWxpemUocGluKSk7XHJcbiAgICBpZiAocGluSW5zdGFuY2UubW9kZSAhPSBTRVJWT19NT0RFKSB7XHJcbiAgICAgIHRoaXMucGluTW9kZShwaW4sIFNFUlZPX01PREUpO1xyXG4gICAgfVxyXG4gICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbC53cml0ZSg0OCArIE1hdGgucm91bmQodmFsdWUgKiA0OCAvIDE4MCkpO1xyXG4gIH1cclxuXHJcbiAgcXVlcnlDYXBhYmlsaXRpZXMoY2IpIHtcclxuICAgIGlmICh0aGlzLmlzUmVhZHkpIHtcclxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhjYik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm9uKCdyZWFkeScsIGNiKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHF1ZXJ5QW5hbG9nTWFwcGluZyhjYikge1xyXG4gICAgaWYgKHRoaXMuaXNSZWFkeSkge1xyXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGNiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMub24oJ3JlYWR5JywgY2IpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcXVlcnlQaW5TdGF0ZShwaW4sIGNiKSB7XHJcbiAgICBpZiAodGhpcy5pc1JlYWR5KSB7XHJcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY2IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vbigncmVhZHknLCBjYik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBbaTJjQ2hlY2tBbGl2ZV0oKSB7XHJcbiAgICBpZiAoIXRoaXNbaTJjXS5hbGl2ZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0kyQyBwaW5zIG5vdCBpbiBJMkMgbW9kZScpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgaTJjQ29uZmlnKG9wdGlvbnMpIHtcclxuICAgIGxldCBkZWxheTtcclxuXHJcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIGRlbGF5ID0gb3B0aW9ucztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcgJiYgb3B0aW9ucyAhPT0gbnVsbCkge1xyXG4gICAgICAgIGRlbGF5ID0gb3B0aW9ucy5kZWxheTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXNbaTJjQ2hlY2tBbGl2ZV0oKTtcclxuXHJcbiAgICB0aGlzW2kyY0RlbGF5XSA9IGRlbGF5IHx8IDA7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBpMmNXcml0ZShhZGRyZXNzLCBjbWRSZWdPckRhdGEsIGluQnl0ZXMpIHtcclxuICAgIHRoaXNbaTJjQ2hlY2tBbGl2ZV0oKTtcclxuXHJcbiAgICAvLyBJZiBpMmNXcml0ZSB3YXMgdXNlZCBmb3IgYW4gaTJjV3JpdGVSZWcgY2FsbC4uLlxyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMgJiYgIUFycmF5LmlzQXJyYXkoY21kUmVnT3JEYXRhKSAmJiAhQXJyYXkuaXNBcnJheShpbkJ5dGVzKSkge1xyXG4gICAgICByZXR1cm4gdGhpcy5pMmNXcml0ZVJlZyhhZGRyZXNzLCBjbWRSZWdPckRhdGEsIGluQnl0ZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpeCBhcmd1bWVudHMgaWYgY2FsbGVkIHdpdGggRmlybWF0YS5qcyBBUElcclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNtZFJlZ09yRGF0YSkpIHtcclxuICAgICAgICBpbkJ5dGVzID0gY21kUmVnT3JEYXRhLnNsaWNlKCk7XHJcbiAgICAgICAgY21kUmVnT3JEYXRhID0gaW5CeXRlcy5zaGlmdCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGluQnl0ZXMgPSBbXTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoW2NtZFJlZ09yRGF0YV0uY29uY2F0KGluQnl0ZXMpKTtcclxuXHJcbiAgICAvLyBPbmx5IHdyaXRlIGlmIGJ5dGVzIHByb3ZpZGVkXHJcbiAgICBpZiAoYnVmZmVyLmxlbmd0aCkge1xyXG4gICAgICB0aGlzW2kyY10ud3JpdGVTeW5jKGFkZHJlc3MsIGJ1ZmZlcik7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBpMmNXcml0ZVJlZyhhZGRyZXNzLCByZWdpc3RlciwgdmFsdWUpIHtcclxuICAgIHRoaXNbaTJjQ2hlY2tBbGl2ZV0oKTtcclxuXHJcbiAgICB0aGlzW2kyY10ud3JpdGVCeXRlU3luYyhhZGRyZXNzLCByZWdpc3RlciwgdmFsdWUpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgW2kyY1JlYWRdKGNvbnRpbnVvdXMsIGFkZHJlc3MsIHJlZ2lzdGVyLCBieXRlc1RvUmVhZCwgY2FsbGJhY2spIHtcclxuICAgIHRoaXNbaTJjQ2hlY2tBbGl2ZV0oKTtcclxuXHJcbiAgICAvLyBGaXggYXJndW1lbnRzIGlmIGNhbGxlZCB3aXRoIEZpcm1hdGEuanMgQVBJXHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PSA0ICYmIHR5cGVvZiByZWdpc3RlciA9PSAnbnVtYmVyJyAmJiB0eXBlb2YgYnl0ZXNUb1JlYWQgPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICBjYWxsYmFjayA9IGJ5dGVzVG9SZWFkO1xyXG4gICAgICBieXRlc1RvUmVhZCA9IHJlZ2lzdGVyO1xyXG4gICAgICByZWdpc3RlciA9IG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY2FsbGJhY2sgPSB0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicgPyBjYWxsYmFjayA6ICgpID0+IHtcclxuICAgIH07XHJcblxyXG4gICAgbGV0IGV2ZW50ID0gJ0kyQy1yZXBseScgKyBhZGRyZXNzICsgJy0nO1xyXG4gICAgZXZlbnQgKz0gcmVnaXN0ZXIgIT09IG51bGwgPyByZWdpc3RlciA6IDA7XHJcblxyXG4gICAgY29uc3QgcmVhZCA9ICgpID0+IHtcclxuICAgICAgY29uc3QgYWZ0ZXJSZWFkID0gKGVyciwgYnVmZmVyKSA9PiB7XHJcbiAgICAgICAgaWYgKGVycikge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ29udmVydCBidWZmZXIgdG8gQXJyYXkgYmVmb3JlIGVtaXRcclxuICAgICAgICB0aGlzLmVtaXQoZXZlbnQsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGJ1ZmZlcikpO1xyXG5cclxuICAgICAgICBpZiAoY29udGludW91cykge1xyXG4gICAgICAgICAgc2V0VGltZW91dChyZWFkLCB0aGlzW2kyY0RlbGF5XSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdGhpcy5vbmNlKGV2ZW50LCBjYWxsYmFjayk7XHJcblxyXG4gICAgICBpZiAocmVnaXN0ZXIgIT09IG51bGwpIHtcclxuICAgICAgICB0aGlzW2kyY10ucmVhZChhZGRyZXNzLCByZWdpc3RlciwgYnl0ZXNUb1JlYWQsIGFmdGVyUmVhZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpc1tpMmNdLnJlYWQoYWRkcmVzcywgYnl0ZXNUb1JlYWQsIGFmdGVyUmVhZCk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgc2V0VGltZW91dChyZWFkLCB0aGlzW2kyY0RlbGF5XSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBpMmNSZWFkKC4uLnJlc3QpIHtcclxuICAgIHJldHVybiB0aGlzW2kyY1JlYWRdKHRydWUsIC4uLnJlc3QpO1xyXG4gIH1cclxuXHJcbiAgaTJjUmVhZE9uY2UoLi4ucmVzdCkge1xyXG4gICAgcmV0dXJuIHRoaXNbaTJjUmVhZF0oZmFsc2UsIC4uLnJlc3QpO1xyXG4gIH1cclxuXHJcbiAgc2VuZEkyQ0NvbmZpZyguLi5yZXN0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5pMmNDb25maWcoLi4ucmVzdCk7XHJcbiAgfVxyXG5cclxuICBzZW5kSTJDV3JpdGVSZXF1ZXN0KC4uLnJlc3QpIHtcclxuICAgIHJldHVybiB0aGlzLmkyY1dyaXRlKC4uLnJlc3QpO1xyXG4gIH1cclxuXHJcbiAgc2VuZEkyQ1JlYWRSZXF1ZXN0KC4uLnJlc3QpIHtcclxuICAgIHJldHVybiB0aGlzLmkyY1JlYWRPbmNlKC4uLnJlc3QpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVDb25maWcocGluLCBlbmFibGVQYXJhc2l0aWNQb3dlcikge1xyXG4gICAgZXhlY1N5bmMucnVuKCdtb2Rwcm9iZSB3MS1ncGlvJyk7XHJcbiAgICBleGVjU3luYy5ydW4oJ21vZHByb2JlIHcxLXRoZXJtJyk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZVNlYXJjaChwaW4sIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLl9zZW5kT25lV2lyZVNlYXJjaChjYWxsYmFjayk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZUFsYXJtc1NlYXJjaChwaW4sIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLl9zZW5kT25lV2lyZVNlYXJjaChjYWxsYmFjayk7XHJcbiAgfVxyXG5cclxuICBfc2VuZE9uZVdpcmVTZWFyY2goY2FsbGJhY2spIHtcclxuICAgIGZzLnJlYWRGaWxlKE9ORV9XSVJFX0xJU1RfUEFUSCwgKGVyciwgZGF0YSkgPT4ge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCB0b0FycmF5KGRhdGEpKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZVJlYWQocGluLCBkZXZpY2UsIG51bUJ5dGVzVG9SZWFkLCBjYWxsYmFjaykge1xyXG4gICAgdGhpcy5fc2VuZE9uZVdpcmVSZXF1ZXN0KHBpbiwgZGV2aWNlLCBjYWxsYmFjayk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZVJlc2V0KHBpbikge1xyXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKCdzZW5kT25lV2lyZUNvbmZpZyBpcyBub3Qgc3VwcG9ydGVkIG9uIHRoZSBSYXNwYmVycnkgUGknKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlV3JpdGUocGluLCBkZXZpY2UsIGRhdGEpIHtcclxuICAgIC8vIHRocm93IG5ldyBFcnJvcignc2VuZE9uZVdpcmVXcml0ZSBpcyBub3Qgc3VwcG9ydGVkIG9uIHRoZSBSYXNwYmVycnkgUGknKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlRGVsYXkocGluLCBkZWxheSkge1xyXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKCdzZW5kT25lV2lyZURlbGF5IGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVXcml0ZUFuZFJlYWQocGluLCBkZXZpY2UsIGRhdGEsIG51bUJ5dGVzVG9SZWFkLCBjYWxsYmFjaykge1xyXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKCdzZW5kT25lV2lyZVdyaXRlQW5kUmVhZCBpcyBub3Qgc3VwcG9ydGVkIG9uIHRoZSBSYXNwYmVycnkgUGknKTtcclxuICB9XHJcblxyXG4gIF9nZXRPbmVXaXJlRmlsZU5hbWUoZGV2aWNlSWQpIHtcclxuICAgIHJldHVybiBwYXRoLnJlc29sdmUoT05FX1dJUkVfQkFTRV9QQVRILCBkZXZpY2VJZCwgJ3cxX3NsYXZlJyk7XHJcbiAgfVxyXG5cclxuICBfc2VuZE9uZVdpcmVSZXF1ZXN0KHBpbiwgZGV2aWNlLCBjYWxsYmFjaykge1xyXG4gICAgZnMucmVhZEZpbGUodGhpcy5fZ2V0T25lV2lyZUZpbGVOYW1lKGRldmljZSksIChlcnIsIGRhdGEpID0+IHtcclxuICAgICAgaWYgKGVycikge1xyXG4gICAgICAgIGlmIChlcnIuY29kZSAmJiBlcnIuY29kZSA9PT0gJ0VOT0VOVCcpIHtcclxuICAgICAgICAgIGNhbGxiYWNrKCdDb3VsZCBub3QgcmVhZCBkZXZpY2UgY29udGVudC4gRGV2aWNlIFxcJycgKyBkZXZpY2UgKyAnXFwnIG5vdCBmb3VuZCcsIG51bGwpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBkYXRhU3RyID0gZGF0YS50b1N0cmluZygpO1xyXG5cclxuICAgICAgICBsZXQgcmVzdWx0ID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKGRhdGFTdHIgJiYgZGF0YVN0ci5pbmRleE9mKCdZRVMnKSA+IC0xKSB7XHJcbiAgICAgICAgICBjb25zdCB0ZW1wID0gZGF0YVN0ci5tYXRjaCgvdD0oLT8oXFxkKykpLyk7XHJcblxyXG4gICAgICAgICAgaWYgKHRlbXApIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gcm91bmQocGFyc2VJbnQodGVtcFsxXSwgMTApIC8gMTAwMCwgMSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHNldFNhbXBsaW5nSW50ZXJ2YWwoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFNhbXBsaW5nSW50ZXJ2YWwgaXMgbm90IHlldCBpbXBsZW1lbnRlZCcpO1xyXG4gIH1cclxuXHJcbiAgcmVwb3J0QW5hbG9nUGluKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdyZXBvcnRBbmFsb2dQaW4gaXMgbm90IHlldCBpbXBsZW1lbnRlZCcpO1xyXG4gIH1cclxuXHJcbiAgcmVwb3J0RGlnaXRhbFBpbigpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcigncmVwb3J0RGlnaXRhbFBpbiBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICBwaW5nUmVhZCgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcigncGluZ1JlYWQgaXMgbm90IHlldCBpbXBsZW1lbnRlZCcpO1xyXG4gIH1cclxuXHJcbiAgcHVsc2VJbigpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcigncHVsc2VJbiBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICBzdGVwcGVyQ29uZmlnKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdzdGVwcGVyQ29uZmlnIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcblxyXG4gIHN0ZXBwZXJTdGVwKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdzdGVwcGVyU3RlcCBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG59XHJcblxyXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUmFzcGksICdpc1Jhc3BiZXJyeVBpJywge1xyXG4gIGVudW1lcmFibGU6IHRydWUsXHJcbiAgdmFsdWU6ICgpID0+IHtcclxuICAgIC8vIERldGVybWluaW5nIGlmIGEgc3lzdGVtIGlzIGEgUmFzcGJlcnJ5IFBpIGlzbid0IHBvc3NpYmxlIHRocm91Z2hcclxuICAgIC8vIHRoZSBvcyBtb2R1bGUgb24gUmFzcGJpYW4sIHNvIHdlIHJlYWQgaXQgZnJvbSB0aGUgZmlsZSBzeXN0ZW0gaW5zdGVhZFxyXG4gICAgbGV0IGlzUmFzcGJlcnJ5UGkgPSBmYWxzZTtcclxuICAgIHRyeSB7XHJcbiAgICAgIGlzUmFzcGJlcnJ5UGkgPSBmcy5yZWFkRmlsZVN5bmMoJy9ldGMvb3MtcmVsZWFzZScpLnRvU3RyaW5nKCkuaW5kZXhPZignUmFzcGJpYW4nKSAhPT0gLTE7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICB9Ly8gU3F1YXNoIGZpbGUgbm90IGZvdW5kLCBldGMgZXJyb3JzXHJcbiAgICByZXR1cm4gaXNSYXNwYmVycnlQaTtcclxuICB9XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBSYXNwaTtcclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
