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
      _syncExec.execSync.run('modprobe w1-gpio');
      _syncExec.execSync.run('modprobe w1-therm');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztrQkF5QmUsSUFBSTs7OztvQkFDRixNQUFNOzs7O3NCQUNNLFFBQVE7O3FCQUNoQixPQUFPOzswQkFDVSxhQUFhOzt5QkFDd0IsWUFBWTs7d0JBQ25FLFdBQVc7O3dCQUNYLFdBQVc7O3dCQUNYLFdBQVc7O3dCQUNOLFdBQVc7OztBQUdwQyxJQUFJLE9BQU8sTUFBTSxDQUFDLE1BQU0sSUFBSSxVQUFVLEVBQUU7QUFDdEMsUUFBTSxDQUFDLE1BQU0sR0FBRyxVQUFDLElBQUksRUFBSztBQUN4QixXQUFPLGtCQUFrQixHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDO0dBQ3hGLENBQUM7Q0FDSDs7O0FBR0QsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3JCLElBQU0sV0FBVyxHQUFHLENBQUMsQ0FBQztBQUN0QixJQUFNLFdBQVcsR0FBRyxDQUFDLENBQUM7QUFDdEIsSUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztBQUNyQixJQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7O0FBRXhCLElBQU0sR0FBRyxHQUFHLENBQUMsQ0FBQztBQUNkLElBQU0sSUFBSSxHQUFHLENBQUMsQ0FBQzs7QUFFZixJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQzs7QUFFbkIsSUFBTSxrQkFBa0IsR0FBRyw4Q0FBOEMsQ0FBQztBQUMxRSxJQUFNLGtCQUFrQixHQUFHLHNCQUFzQixDQUFDOzs7QUFHbEQsSUFBTSx3QkFBd0IsR0FBRyxFQUFFLENBQUM7OztBQUdwQyxJQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbEMsSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzVCLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN0QyxJQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDeEMsSUFBTSxjQUFjLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDaEQsSUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzFCLElBQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwQyxJQUFNLFFBQU8sR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDbEMsSUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQzlDLElBQU0sUUFBTyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQzs7QUFFbEMsU0FBUyxPQUFPLENBQUMsTUFBTSxFQUFFO0FBQ3ZCLGFBQVcsR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsRUFBSTtBQUNuRCxXQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztHQUNqQixDQUFDLENBQUM7O0FBRUgsU0FBTyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQUEsSUFBSSxFQUFJO0FBQzNCLFdBQU8sQ0FBQyxDQUFDLElBQUksQ0FBQztHQUNmLENBQUMsQ0FBQztDQUNKOztBQUVELFNBQVMsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDN0IsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDakMsU0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7Q0FDdkM7O0lBRUssS0FBSztZQUFMLEtBQUs7O0FBRUUsV0FGUCxLQUFLLEdBRUs7Ozs7MEJBRlYsS0FBSzs7QUFHUCwrQkFIRSxLQUFLLDZDQUdDOztBQUVSLFVBQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJO0FBQzFCLFVBQUksRUFBRTtBQUNKLGtCQUFVLEVBQUUsSUFBSTtBQUNoQixhQUFLLEVBQUUsZ0JBQWdCO09BQ3hCOztpREFFQSxTQUFTLEVBQUc7QUFDWCxjQUFRLEVBQUUsSUFBSTtBQUNkLFdBQUssRUFBRSxFQUFFO0tBQ1YsNkNBRUEsT0FBTyxFQUFHO0FBQ1QsY0FBUSxFQUFFLElBQUk7QUFDZCxXQUFLLEVBQUUsS0FBSztLQUNiLHdEQUNRO0FBQ1AsZ0JBQVUsRUFBRSxJQUFJO0FBQ2hCLFNBQUcsRUFBQSxlQUFHO0FBQ0osZUFBTyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7T0FDdEI7S0FDRiw2Q0FFQSxJQUFJLEVBQUc7QUFDTixjQUFRLEVBQUUsSUFBSTtBQUNkLFdBQUssRUFBRSxFQUFFO0tBQ1YscURBQ0s7QUFDSixnQkFBVSxFQUFFLElBQUk7QUFDaEIsU0FBRyxFQUFBLGVBQUc7QUFDSixlQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztPQUNuQjtLQUNGLDZDQUVBLFVBQVUsRUFBRztBQUNaLGNBQVEsRUFBRSxJQUFJO0FBQ2QsV0FBSyxFQUFFLEVBQUU7S0FDViwyREFDVztBQUNWLGdCQUFVLEVBQUUsSUFBSTtBQUNoQixTQUFHLEVBQUEsZUFBRztBQUNKLGVBQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO09BQ3pCO0tBQ0YsNkNBRUEsR0FBRyxFQUFHO0FBQ0wsY0FBUSxFQUFFLElBQUk7QUFDZCxXQUFLLEVBQUUsbUJBQVM7S0FDakIsNkNBRUEsUUFBUSxFQUFHO0FBQ1YsY0FBUSxFQUFFLElBQUk7QUFDZCxXQUFLLEVBQUUsQ0FBQztLQUNULHNEQUVNO0FBQ0wsZ0JBQVUsRUFBRSxJQUFJO0FBQ2hCLFdBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ25CLGFBQUssRUFBRSxVQUFVO0FBQ2pCLGNBQU0sRUFBRSxXQUFXO0FBQ25CLGNBQU0sRUFBRSxXQUFXO0FBQ25CLFdBQUcsRUFBRSxRQUFRO0FBQ2IsYUFBSyxFQUFFLFVBQVU7T0FDbEIsQ0FBQztLQUNILHFEQUVLO0FBQ0osZ0JBQVUsRUFBRSxJQUFJO0FBQ2hCLFdBQUssRUFBRSxJQUFJO0tBQ1osb0RBQ0k7QUFDSCxnQkFBVSxFQUFFLElBQUk7QUFDaEIsV0FBSyxFQUFFLEdBQUc7S0FDWCwyREFFVztBQUNWLGdCQUFVLEVBQUUsSUFBSTtBQUNoQixXQUFLLEVBQUUsT0FBTztLQUNmLDZCQUNELENBQUM7O0FBRUgscUJBQUssWUFBTTtBQUNULFVBQU0sV0FBVyxHQUFHLDBCQUFTLENBQUM7QUFDOUIsWUFBSyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7OztBQUdoQixpQkFBVyxDQUFDLE9BQU8sQ0FBQyxHQUFHO0FBQ3JCLFlBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQztBQUNmLG1CQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUM7T0FDdEIsQ0FBQzs7QUFFRixZQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEdBQUcsRUFBSztBQUN4QyxZQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakMsWUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDOzs7QUFHMUIsWUFBSSxPQUFPLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUM1QyxjQUFJLEdBQUcsSUFBSSxPQUFPLEVBQUU7QUFDbEIsMEJBQWMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7V0FDbEMsTUFBTSxJQUFJLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFO0FBQ3BELDBCQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsQ0FBQztXQUM5QztBQUNELGNBQUksT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUU7QUFDNUMsMEJBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1dBQzNDO1NBQ0Y7QUFDRCxZQUFNLFFBQVEsR0FBRyxNQUFLLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHO0FBQ3RDLG9CQUFVLEVBQUUsSUFBSTtBQUNoQixjQUFJLEVBQUUsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxZQUFZLEdBQUcsV0FBVztBQUM1RSw4QkFBb0IsRUFBRSxHQUFHO1NBQzFCLENBQUM7QUFDRixjQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO0FBQ3BDLHdCQUFjLEVBQUU7QUFDZCxzQkFBVSxFQUFFLElBQUk7QUFDaEIsaUJBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztXQUNyQztBQUNELGNBQUksRUFBRTtBQUNKLHNCQUFVLEVBQUUsSUFBSTtBQUNoQixlQUFHLEVBQUEsZUFBRztBQUNKLHFCQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUM7YUFDdEI7V0FDRjtBQUNELGVBQUssRUFBRTtBQUNMLHNCQUFVLEVBQUUsSUFBSTtBQUNoQixlQUFHLEVBQUEsZUFBRztBQUNKLHNCQUFRLFFBQVEsQ0FBQyxJQUFJO0FBQ25CLHFCQUFLLFVBQVU7QUFDYix5QkFBTyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQUEsQUFDcEMscUJBQUssV0FBVztBQUNkLHlCQUFPLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQztBQUFBLEFBQ3ZDO0FBQ0UseUJBQU8sSUFBSSxDQUFDO0FBQUEsZUFDZjthQUNGO0FBQ0QsZUFBRyxFQUFBLGFBQUMsS0FBSyxFQUFFO0FBQ1Qsa0JBQUksUUFBUSxDQUFDLElBQUksSUFBSSxXQUFXLEVBQUU7QUFDaEMsd0JBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO2VBQ2xDO2FBQ0Y7V0FDRjtBQUNELGdCQUFNLEVBQUU7QUFDTixzQkFBVSxFQUFFLElBQUk7QUFDaEIsaUJBQUssRUFBRSxDQUFDO1dBQ1Q7QUFDRCx1QkFBYSxFQUFFO0FBQ2Isc0JBQVUsRUFBRSxJQUFJO0FBQ2hCLGlCQUFLLEVBQUUsR0FBRztXQUNYO1NBQ0YsQ0FBQyxDQUFDO0FBQ0gsWUFBSSxRQUFRLENBQUMsSUFBSSxJQUFJLFdBQVcsRUFBRTtBQUNoQyxnQkFBSyxPQUFPLENBQUMsR0FBRyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQy9CLGdCQUFLLFlBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDN0I7T0FDRixDQUFDLENBQUM7OztBQUdILFdBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFLLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMxQyxZQUFJLENBQUMsTUFBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNsQixnQkFBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRTtBQUNsQywwQkFBYyxFQUFFO0FBQ2Qsd0JBQVUsRUFBRSxJQUFJO0FBQ2hCLG1CQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7YUFDekI7QUFDRCxnQkFBSSxFQUFFO0FBQ0osd0JBQVUsRUFBRSxJQUFJO0FBQ2hCLGlCQUFHLEVBQUEsZUFBRztBQUNKLHVCQUFPLFlBQVksQ0FBQztlQUNyQjthQUNGO0FBQ0QsaUJBQUssRUFBRTtBQUNMLHdCQUFVLEVBQUUsSUFBSTtBQUNoQixpQkFBRyxFQUFBLGVBQUc7QUFDSix1QkFBTyxDQUFDLENBQUM7ZUFDVjtBQUNELGlCQUFHLEVBQUEsZUFBRyxFQUNMO2FBQ0Y7QUFDRCxrQkFBTSxFQUFFO0FBQ04sd0JBQVUsRUFBRSxJQUFJO0FBQ2hCLG1CQUFLLEVBQUUsQ0FBQzthQUNUO0FBQ0QseUJBQWEsRUFBRTtBQUNiLHdCQUFVLEVBQUUsSUFBSTtBQUNoQixtQkFBSyxFQUFFLEdBQUc7YUFDWDtXQUNGLENBQUMsQ0FBQztTQUNKO09BQ0Y7O0FBRUQsWUFBSyxPQUFPLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDckIsWUFBSyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbkIsWUFBSyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7S0FDdEIsQ0FBQyxDQUFDO0dBQ0o7O2VBck1HLEtBQUs7O1dBdU1KLGlCQUFHO0FBQ04sWUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO0tBQy9EOzs7V0FFUSxtQkFBQyxHQUFHLEVBQUU7QUFDYixVQUFNLGFBQWEsR0FBRyw4QkFBYSxHQUFHLENBQUMsQ0FBQztBQUN4QyxVQUFJLE9BQU8sYUFBYSxJQUFJLFdBQVcsRUFBRTtBQUN2QyxjQUFNLElBQUksS0FBSyxDQUFDLGVBQWUsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7T0FDOUM7QUFDRCxhQUFPLGFBQWEsQ0FBQztLQUN0Qjs7U0FFQSxjQUFjO1dBQUMsZUFBQyxHQUFHLEVBQUU7QUFDcEIsVUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pDLFVBQUksQ0FBQyxXQUFXLEVBQUU7QUFDaEIsY0FBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO09BQzlDO0FBQ0QsYUFBTyxXQUFXLENBQUM7S0FDcEI7OztXQUVNLGlCQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7QUFDakIsVUFBSSxDQUFDLFFBQU8sQ0FBQyxDQUFDO0FBQ1osV0FBRyxFQUFILEdBQUc7QUFDSCxZQUFJLEVBQUosSUFBSTtPQUNMLENBQUMsQ0FBQztLQUNKOztTQUVBLFFBQU87V0FBQyxlQUFDLElBQXVDLEVBQUU7VUFBdkMsR0FBRyxHQUFMLElBQXVDLENBQXJDLEdBQUc7VUFBRSxJQUFJLEdBQVgsSUFBdUMsQ0FBaEMsSUFBSTs4QkFBWCxJQUF1QyxDQUExQixZQUFZO1VBQVosWUFBWTs7QUFDakMsVUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxQyxVQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDeEQsaUJBQVcsQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDO0FBQ3hDLFVBQU0sTUFBTSxHQUFHO0FBQ2IsV0FBRyxFQUFFLGFBQWE7QUFDbEIsb0JBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtPQUN2QyxDQUFDO0FBQ0YsVUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRTtBQUNoRSxjQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sR0FBRyxHQUFHLEdBQUcsMkJBQTJCLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO09BQzNFO0FBQ0QsVUFBSSxHQUFHLElBQUksT0FBTyxJQUFJLEVBQUUsV0FBVyxDQUFDLFVBQVUsMEJBQWUsQUFBQyxFQUFFO0FBQzlELG1CQUFXLENBQUMsVUFBVSxHQUFHLG1CQUFTLENBQUM7T0FDcEMsTUFBTTtBQUNMLGdCQUFRLElBQUk7QUFDVixlQUFLLFVBQVU7QUFDYix1QkFBVyxDQUFDLFVBQVUsR0FBRyw0QkFBaUIsTUFBTSxDQUFDLENBQUM7QUFDbEQsa0JBQU07QUFBQSxBQUNSLGVBQUssV0FBVztBQUNkLHVCQUFXLENBQUMsVUFBVSxHQUFHLDZCQUFrQixNQUFNLENBQUMsQ0FBQztBQUNuRCxrQkFBTTtBQUFBLEFBQ1IsZUFBSyxRQUFRLENBQUM7QUFDZCxlQUFLLFVBQVU7QUFDYix1QkFBVyxDQUFDLFVBQVUsR0FBRyxrQkFBUSxhQUFhLENBQUMsQ0FBQztBQUNoRCxrQkFBTTtBQUFBLEFBQ1I7QUFDRSxtQkFBTyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUMsQ0FBQztBQUMxQyxrQkFBTTtBQUFBLFNBQ1Q7T0FDRjtBQUNELGlCQUFXLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztLQUN6Qjs7O1dBRVMsc0JBQUc7QUFDWCxZQUFNLElBQUksS0FBSyxDQUFDLGlEQUFpRCxDQUFDLENBQUM7S0FDcEU7OztXQUVVLHFCQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDdEIsVUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM5RCxVQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksUUFBUSxFQUFFO0FBQ2hDLFlBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO09BQzdCO0FBQ0QsaUJBQVcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0tBQzlEOzs7V0FFVSxxQkFBQyxHQUFHLEVBQUUsT0FBTyxFQUFFOzs7QUFDeEIsVUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM5RCxVQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksVUFBVSxFQUFFO0FBQ2xDLFlBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO09BQy9CO0FBQ0QsVUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFlBQU07QUFDakMsWUFBSSxLQUFLLFlBQUEsQ0FBQztBQUNWLFlBQUksV0FBVyxDQUFDLElBQUksSUFBSSxVQUFVLEVBQUU7QUFDbEMsZUFBSyxHQUFHLFdBQVcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDdkMsTUFBTTtBQUNMLGVBQUssR0FBRyxXQUFXLENBQUMsb0JBQW9CLENBQUM7U0FDMUM7QUFDRCxZQUFJLE9BQU8sRUFBRTtBQUNYLGlCQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDaEI7QUFDRCxlQUFLLElBQUksQ0FBQyxlQUFlLEdBQUcsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO09BQ3pDLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztBQUM3QixpQkFBVyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLFlBQU07QUFDM0MscUJBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztPQUN6QixDQUFDLENBQUM7S0FDSjs7O1dBRVcsc0JBQUMsR0FBRyxFQUFFLEtBQUssRUFBRTtBQUN2QixVQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlELFVBQUksV0FBVyxDQUFDLElBQUksS0FBSyxVQUFVLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtBQUNyRCxZQUFJLENBQUMsUUFBTyxDQUFDLENBQUM7QUFDWixhQUFHLEVBQUgsR0FBRztBQUNILGNBQUksRUFBRSxVQUFVO0FBQ2hCLHNCQUFZLG9CQUFTO1NBQ3RCLENBQUMsQ0FBQztPQUNKLE1BQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxJQUFJLFdBQVcsRUFBRTtBQUMxQyxZQUFJLENBQUMsUUFBTyxDQUFDLENBQUM7QUFDWixhQUFHLEVBQUgsR0FBRztBQUNILGNBQUksRUFBRSxXQUFXO1NBQ2xCLENBQUMsQ0FBQztPQUNKO0FBQ0QsVUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLFdBQVcsSUFBSSxLQUFLLElBQUksV0FBVyxDQUFDLG9CQUFvQixFQUFFO0FBQ2pGLG1CQUFXLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELG1CQUFXLENBQUMsb0JBQW9CLEdBQUcsS0FBSyxDQUFDO09BQzFDO0tBQ0Y7OztXQUVTLG9CQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUU7QUFDckIsVUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM5RCxVQUFJLFdBQVcsQ0FBQyxJQUFJLElBQUksVUFBVSxFQUFFO0FBQ2xDLFlBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO09BQy9CO0FBQ0QsaUJBQVcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztLQUNqRTs7O1dBRWdCLDJCQUFDLEVBQUUsRUFBRTtBQUNwQixVQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsZUFBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUN0QixNQUFNO0FBQ0wsWUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7T0FDdEI7S0FDRjs7O1dBRWlCLDRCQUFDLEVBQUUsRUFBRTtBQUNyQixVQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsZUFBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUN0QixNQUFNO0FBQ0wsWUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7T0FDdEI7S0FDRjs7O1dBRVksdUJBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRTtBQUNyQixVQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsZUFBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUN0QixNQUFNO0FBQ0wsWUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7T0FDdEI7S0FDRjs7U0FFQSxhQUFhO1dBQUMsaUJBQUc7QUFDaEIsVUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUU7QUFDcEIsY0FBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO09BQzdDO0tBQ0Y7OztXQUVRLG1CQUFDLE9BQU8sRUFBRTtBQUNqQixVQUFJLEtBQUssWUFBQSxDQUFDOztBQUVWLFVBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxFQUFFO0FBQy9CLGFBQUssR0FBRyxPQUFPLENBQUM7T0FDakIsTUFBTTtBQUNMLFlBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7QUFDbkQsZUFBSyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7U0FDdkI7T0FDRjs7QUFFRCxVQUFJLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQzs7QUFFdEIsVUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUM7O0FBRTVCLGFBQU8sSUFBSSxDQUFDO0tBQ2I7OztXQUVPLGtCQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFO0FBQ3ZDLFVBQUksQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDOzs7QUFHdEIsVUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ3JGLGVBQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDO09BQ3pEOzs7QUFHRCxVQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFCLFlBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsRUFBRTtBQUMvQixpQkFBTyxHQUFHLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUMvQixzQkFBWSxHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztTQUNoQyxNQUFNO0FBQ0wsaUJBQU8sR0FBRyxFQUFFLENBQUM7U0FDZDtPQUNGOztBQUVELFVBQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7OztBQUcxRCxVQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7QUFDakIsWUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7T0FDdEM7O0FBRUQsYUFBTyxJQUFJLENBQUM7S0FDYjs7O1dBRVUscUJBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7QUFDcEMsVUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7O0FBRXRCLFVBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsQ0FBQzs7QUFFbEQsYUFBTyxJQUFJLENBQUM7S0FDYjs7U0FFQSxRQUFPO1dBQUMsZUFBQyxVQUFVLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFOzs7QUFDOUQsVUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7OztBQUd0QixVQUFJLFNBQVMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLE9BQU8sUUFBUSxJQUFJLFFBQVEsSUFBSSxPQUFPLFdBQVcsSUFBSSxVQUFVLEVBQUU7QUFDNUYsZ0JBQVEsR0FBRyxXQUFXLENBQUM7QUFDdkIsbUJBQVcsR0FBRyxRQUFRLENBQUM7QUFDdkIsZ0JBQVEsR0FBRyxJQUFJLENBQUM7T0FDakI7O0FBRUQsY0FBUSxHQUFHLE9BQU8sUUFBUSxLQUFLLFVBQVUsR0FBRyxRQUFRLEdBQUcsWUFBTSxFQUM1RCxDQUFDOztBQUVGLFVBQUksS0FBSyxHQUFHLFdBQVcsR0FBRyxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLFdBQUssSUFBSSxRQUFRLEtBQUssSUFBSSxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUM7O0FBRTFDLFVBQU0sSUFBSSxHQUFHLFNBQVAsSUFBSSxHQUFTO0FBQ2pCLFlBQU0sU0FBUyxHQUFHLFNBQVosU0FBUyxDQUFJLEdBQUcsRUFBRSxNQUFNLEVBQUs7QUFDakMsY0FBSSxHQUFHLEVBQUU7QUFDUCxtQkFBTyxPQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLENBQUM7V0FDaEM7OztBQUdELGlCQUFLLElBQUksQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7O0FBRXJELGNBQUksVUFBVSxFQUFFO0FBQ2Qsc0JBQVUsQ0FBQyxJQUFJLEVBQUUsT0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO1dBQ2xDO1NBQ0YsQ0FBQzs7QUFFRixlQUFLLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7O0FBRTNCLFlBQUksUUFBUSxLQUFLLElBQUksRUFBRTtBQUNyQixpQkFBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7U0FDM0QsTUFBTTtBQUNMLGlCQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1NBQ2pEO09BQ0YsQ0FBQzs7QUFFRixnQkFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzs7QUFFakMsYUFBTyxJQUFJLENBQUM7S0FDYjs7O1dBRU0sbUJBQVU7d0NBQU4sSUFBSTtBQUFKLFlBQUk7OztBQUNiLGFBQU8sSUFBSSxDQUFDLFFBQU8sT0FBQyxDQUFiLElBQUksR0FBVSxJQUFJLFNBQUssSUFBSSxFQUFDLENBQUM7S0FDckM7OztXQUVVLHVCQUFVO3lDQUFOLElBQUk7QUFBSixZQUFJOzs7QUFDakIsYUFBTyxJQUFJLENBQUMsUUFBTyxPQUFDLENBQWIsSUFBSSxHQUFVLEtBQUssU0FBSyxJQUFJLEVBQUMsQ0FBQztLQUN0Qzs7O1dBRVkseUJBQVU7QUFDckIsYUFBTyxJQUFJLENBQUMsU0FBUyxNQUFBLENBQWQsSUFBSSxZQUFtQixDQUFDO0tBQ2hDOzs7V0FFa0IsK0JBQVU7QUFDM0IsYUFBTyxJQUFJLENBQUMsUUFBUSxNQUFBLENBQWIsSUFBSSxZQUFrQixDQUFDO0tBQy9COzs7V0FFaUIsOEJBQVU7QUFDMUIsYUFBTyxJQUFJLENBQUMsV0FBVyxNQUFBLENBQWhCLElBQUksWUFBcUIsQ0FBQztLQUNsQzs7O1dBRWdCLDJCQUFDLEdBQUcsRUFBRSxvQkFBb0IsRUFBRTtBQUMzQyx5QkFBUyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUNqQyx5QkFBUyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztLQUNuQzs7O1dBRWdCLDJCQUFDLEdBQUcsRUFBRSxRQUFRLEVBQUU7QUFDL0IsVUFBSSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0tBQ25DOzs7V0FFc0IsaUNBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRTtBQUNyQyxVQUFJLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbkM7OztXQUVpQiw0QkFBQyxRQUFRLEVBQUU7QUFDM0Isc0JBQUcsUUFBUSxDQUFDLGtCQUFrQixFQUFFLFVBQUMsR0FBRyxFQUFFLElBQUksRUFBSztBQUM3QyxZQUFJLEdBQUcsRUFBRTtBQUNQLGtCQUFRLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3JCLE1BQU07QUFDTCxrQkFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMvQjtPQUNGLENBQUMsQ0FBQztLQUNKOzs7V0FFYyx5QkFBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUU7QUFDckQsVUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7S0FDakQ7OztXQUVlLDBCQUFDLEdBQUcsRUFBRTs7S0FFckI7OztXQUVlLDBCQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFOztLQUVuQzs7O1dBRWUsMEJBQUMsR0FBRyxFQUFFLEtBQUssRUFBRTs7S0FFNUI7OztXQUVzQixpQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsUUFBUSxFQUFFOztLQUVwRTs7O1dBRWtCLDZCQUFDLFFBQVEsRUFBRTtBQUM1QixhQUFPLGtCQUFLLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUM7S0FDL0Q7OztXQUVrQiw2QkFBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTtBQUN6QyxzQkFBRyxRQUFRLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxFQUFFLFVBQUMsR0FBRyxFQUFFLElBQUksRUFBSztBQUMzRCxZQUFJLEdBQUcsRUFBRTtBQUNQLGNBQUksR0FBRyxDQUFDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUNyQyxvQkFBUSxDQUFDLDBDQUEwQyxHQUFHLE1BQU0sR0FBRyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7V0FDdEYsTUFBTTtBQUNMLG9CQUFRLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1dBQ3JCO1NBQ0YsTUFBTTtBQUNMLGNBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzs7QUFFaEMsY0FBSSxPQUFNLEdBQUcsS0FBSyxDQUFDO0FBQ25CLGNBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDMUMsZ0JBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRTFDLGdCQUFJLElBQUksRUFBRTtBQUNSLHFCQUFNLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ2pEO1dBQ0Y7O0FBRUQsa0JBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTSxDQUFDLENBQUM7U0FDeEI7T0FDRixDQUFDLENBQUM7S0FDSjs7O1dBRWtCLCtCQUFHO0FBQ3BCLFlBQU0sSUFBSSxLQUFLLENBQUMsNENBQTRDLENBQUMsQ0FBQztLQUMvRDs7O1dBRWMsMkJBQUc7QUFDaEIsWUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0tBQzNEOzs7V0FFZSw0QkFBRztBQUNqQixZQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7S0FDNUQ7OztXQUVPLG9CQUFHO0FBQ1QsWUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ3BEOzs7V0FFTSxtQkFBRztBQUNSLFlBQU0sSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQztLQUNuRDs7O1dBRVkseUJBQUc7QUFDZCxZQUFNLElBQUksS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7S0FDekQ7OztXQUVVLHVCQUFHO0FBQ1osWUFBTSxJQUFJLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO0tBQ3ZEOzs7U0F2akJHLEtBQUs7OztBQTBqQlgsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFO0FBQzVDLFlBQVUsRUFBRSxJQUFJO0FBQ2hCLE9BQUssRUFBRSxpQkFBTTs7O0FBR1gsUUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO0FBQzFCLFFBQUk7QUFDRixtQkFBYSxHQUFHLGdCQUFHLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztLQUMxRixDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQ1g7QUFDRCxXQUFPLGFBQWEsQ0FBQztHQUN0QjtDQUNGLENBQUMsQ0FBQzs7QUFFSCxNQUFNLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyIsImZpbGUiOiJpbmRleC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiBDb3B5cmlnaHQgKGMpIDIwMTQgQnJ5YW4gSHVnaGVzIDxicnlhbkB0aGVvcmV0aWNhbGlkZWF0aW9ucy5jb20+XHJcblxyXG4gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb25cclxuIG9idGFpbmluZyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uXHJcbiBmaWxlcyAodGhlICdTb2Z0d2FyZScpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0XHJcbiByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSxcclxuIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXHJcbiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGVcclxuIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nXHJcbiBjb25kaXRpb25zOlxyXG5cclxuIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlXHJcbiBpbmNsdWRlZCBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cclxuXHJcbiBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgJ0FTIElTJywgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCxcclxuIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFU1xyXG4gT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkRcclxuIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUXHJcbiBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSxcclxuIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lOR1xyXG4gRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUlxyXG4gT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxyXG4gKi9cclxuXHJcbmltcG9ydCBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgeyBpbml0IH0gZnJvbSAncmFzcGknO1xyXG5pbXBvcnQgeyBnZXRQaW5zLCBnZXRQaW5OdW1iZXIgfSBmcm9tICdyYXNwaS1ib2FyZCc7XHJcbmltcG9ydCB7IFBVTExfTk9ORSwgUFVMTF9VUCwgUFVMTF9ET1dOLCBEaWdpdGFsT3V0cHV0LCBEaWdpdGFsSW5wdXQgfSBmcm9tICdyYXNwaS1ncGlvJztcclxuaW1wb3J0IHsgUFdNIH0gZnJvbSAncmFzcGktcHdtJztcclxuaW1wb3J0IHsgSTJDIH0gZnJvbSAncmFzcGktaTJjJztcclxuaW1wb3J0IHsgTEVEIH0gZnJvbSAncmFzcGktbGVkJztcclxuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdzeW5jLWV4ZWMnO1xyXG5cclxuLy8gSGFja3kgcXVpY2sgU3ltYm9sIHBvbHlmaWxsLCBzaW5jZSBlczYtc3ltYm9sIHJlZnVzZXMgdG8gaW5zdGFsbCB3aXRoIE5vZGUgMC4xMCBmcm9tIGh0dHA6Ly9ub2RlLWFybS5oZXJva3VhcHAuY29tL1xyXG5pZiAodHlwZW9mIGdsb2JhbC5TeW1ib2wgIT0gJ2Z1bmN0aW9uJykge1xyXG4gIGdsb2JhbC5TeW1ib2wgPSAobmFtZSkgPT4ge1xyXG4gICAgcmV0dXJuICdfXyRyYXNwaV9zeW1ib2xfJyArIG5hbWUgKyAnXycgKyBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAweEZGRkZGRkYpICsgJyRfXyc7XHJcbiAgfTtcclxufVxyXG5cclxuLy8gQ29uc3RhbnRzXHJcbmNvbnN0IElOUFVUX01PREUgPSAwO1xyXG5jb25zdCBPVVRQVVRfTU9ERSA9IDE7XHJcbmNvbnN0IEFOQUxPR19NT0RFID0gMjtcclxuY29uc3QgUFdNX01PREUgPSAzO1xyXG5jb25zdCBTRVJWT19NT0RFID0gNDtcclxuY29uc3QgVU5LTk9XTl9NT0RFID0gOTk7XHJcblxyXG5jb25zdCBMT1cgPSAwO1xyXG5jb25zdCBISUdIID0gMTtcclxuXHJcbmNvbnN0IExFRF9QSU4gPSAtMTtcclxuXHJcbmNvbnN0IE9ORV9XSVJFX0xJU1RfUEFUSCA9ICcvc3lzL2RldmljZXMvdzFfYnVzX21hc3RlcjEvdzFfbWFzdGVyX3NsYXZlcyc7XHJcbmNvbnN0IE9ORV9XSVJFX0JBU0VfUEFUSCA9ICcvc3lzL2J1cy93MS9kZXZpY2VzLyc7XHJcblxyXG4vLyBTZXR0aW5nc1xyXG5jb25zdCBESUdJVEFMX1JFQURfVVBEQVRFX1JBVEUgPSAxOTtcclxuXHJcbi8vIFByaXZhdGUgc3ltYm9sc1xyXG5jb25zdCBpc1JlYWR5ID0gU3ltYm9sKCdpc1JlYWR5Jyk7XHJcbmNvbnN0IHBpbnMgPSBTeW1ib2woJ3BpbnMnKTtcclxuY29uc3QgaW5zdGFuY2VzID0gU3ltYm9sKCdpbnN0YW5jZXMnKTtcclxuY29uc3QgYW5hbG9nUGlucyA9IFN5bWJvbCgnYW5hbG9nUGlucycpO1xyXG5jb25zdCBnZXRQaW5JbnN0YW5jZSA9IFN5bWJvbCgnZ2V0UGluSW5zdGFuY2UnKTtcclxuY29uc3QgaTJjID0gU3ltYm9sKCdpMmMnKTtcclxuY29uc3QgaTJjRGVsYXkgPSBTeW1ib2woJ2kyY0RlbGF5Jyk7XHJcbmNvbnN0IGkyY1JlYWQgPSBTeW1ib2woJ2kyY1JlYWQnKTtcclxuY29uc3QgaTJjQ2hlY2tBbGl2ZSA9IFN5bWJvbCgnaTJjQ2hlY2tBbGl2ZScpO1xyXG5jb25zdCBwaW5Nb2RlID0gU3ltYm9sKCdwaW5Nb2RlJyk7XHJcblxyXG5mdW5jdGlvbiB0b0FycmF5KGJ1ZmZlcikge1xyXG4gIGNvbnN0cmVzdWx0ID0gYnVmZmVyLnRvU3RyaW5nKCkuc3BsaXQoJ1xcbicpLm1hcChpID0+IHtcclxuICAgIHJldHVybiBpLnRyaW0oKTtcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHJlc3VsdC5maWx0ZXIoaXRlbSA9PiB7XHJcbiAgICByZXR1cm4gISFpdGVtO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiByb3VuZChudW1iZXIsIHBsYWNlcykge1xyXG4gIGNvbnN0IHBvdyA9IE1hdGgucG93KDEwLCBwbGFjZXMpO1xyXG4gIHJldHVybiBNYXRoLnJvdW5kKG51bWJlciAqIHBvdykgLyBwb3c7XHJcbn1cclxuXHJcbmNsYXNzIFJhc3BpIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBzdXBlcigpO1xyXG5cclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcclxuICAgICAgbmFtZToge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6ICdSYXNwYmVycnlQaS1JTydcclxuICAgICAgfSxcclxuXHJcbiAgICAgIFtpbnN0YW5jZXNdOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IFtdXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbaXNSZWFkeV06IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogZmFsc2VcclxuICAgICAgfSxcclxuICAgICAgaXNSZWFkeToge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXNbaXNSZWFkeV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgW3BpbnNdOiB7XHJcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IFtdXHJcbiAgICAgIH0sXHJcbiAgICAgIHBpbnM6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIGdldCgpIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzW3BpbnNdO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuXHJcbiAgICAgIFthbmFsb2dQaW5zXToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBbXVxyXG4gICAgICB9LFxyXG4gICAgICBhbmFsb2dQaW5zOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICBnZXQoKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpc1thbmFsb2dQaW5zXTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBbaTJjXToge1xyXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBuZXcgSTJDKClcclxuICAgICAgfSxcclxuXHJcbiAgICAgIFtpMmNEZWxheV06IHtcclxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogMFxyXG4gICAgICB9LFxyXG5cclxuICAgICAgTU9ERVM6IHtcclxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgIHZhbHVlOiBPYmplY3QuZnJlZXplKHtcclxuICAgICAgICAgIElOUFVUOiBJTlBVVF9NT0RFLFxyXG4gICAgICAgICAgT1VUUFVUOiBPVVRQVVRfTU9ERSxcclxuICAgICAgICAgIEFOQUxPRzogQU5BTE9HX01PREUsXHJcbiAgICAgICAgICBQV006IFBXTV9NT0RFLFxyXG4gICAgICAgICAgU0VSVk86IFNFUlZPX01PREVcclxuICAgICAgICB9KVxyXG4gICAgICB9LFxyXG5cclxuICAgICAgSElHSDoge1xyXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgdmFsdWU6IEhJR0hcclxuICAgICAgfSxcclxuICAgICAgTE9XOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogTE9XXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBkZWZhdWx0TGVkOiB7XHJcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICAgICAgICB2YWx1ZTogTEVEX1BJTlxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBpbml0KCgpID0+IHtcclxuICAgICAgY29uc3QgcGluTWFwcGluZ3MgPSBnZXRQaW5zKCk7XHJcbiAgICAgIHRoaXNbcGluc10gPSBbXTtcclxuXHJcbiAgICAgIC8vIFNsaWdodCBoYWNrIHRvIGdldCB0aGUgTEVEIGluIHRoZXJlLCBzaW5jZSBpdCdzIG5vdCBhY3R1YWxseSBhIHBpblxyXG4gICAgICBwaW5NYXBwaW5nc1tMRURfUElOXSA9IHtcclxuICAgICAgICBwaW5zOiBbTEVEX1BJTl0sXHJcbiAgICAgICAgcGVyaXBoZXJhbHM6IFsnZ3BpbyddXHJcbiAgICAgIH07XHJcblxyXG4gICAgICBPYmplY3Qua2V5cyhwaW5NYXBwaW5ncykuZm9yRWFjaCgocGluKSA9PiB7XHJcbiAgICAgICAgY29uc3QgcGluSW5mbyA9IHBpbk1hcHBpbmdzW3Bpbl07XHJcbiAgICAgICAgY29uc3Qgc3VwcG9ydGVkTW9kZXMgPSBbXTtcclxuICAgICAgICAvLyBXZSBkb24ndCB3YW50IEkyQyB0byBiZSB1c2VkIGZvciBhbnl0aGluZyBlbHNlLCBzaW5jZSBjaGFuZ2luZyB0aGVcclxuICAgICAgICAvLyBwaW4gbW9kZSBtYWtlcyBpdCB1bmFibGUgdG8gZXZlciBkbyBJMkMgYWdhaW4uXHJcbiAgICAgICAgaWYgKHBpbkluZm8ucGVyaXBoZXJhbHMuaW5kZXhPZignaTJjJykgPT0gLTEpIHtcclxuICAgICAgICAgIGlmIChwaW4gPT0gTEVEX1BJTikge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWRNb2Rlcy5wdXNoKE9VVFBVVF9NT0RFKTtcclxuICAgICAgICAgIH0gZWxzZSBpZiAocGluSW5mby5wZXJpcGhlcmFscy5pbmRleE9mKCdncGlvJykgIT0gLTEpIHtcclxuICAgICAgICAgICAgc3VwcG9ydGVkTW9kZXMucHVzaChJTlBVVF9NT0RFLCBPVVRQVVRfTU9ERSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAocGluSW5mby5wZXJpcGhlcmFscy5pbmRleE9mKCdwd20nKSAhPSAtMSkge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWRNb2Rlcy5wdXNoKFBXTV9NT0RFLCBTRVJWT19NT0RFKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgaW5zdGFuY2UgPSB0aGlzW2luc3RhbmNlc11bcGluXSA9IHtcclxuICAgICAgICAgIHBlcmlwaGVyYWw6IG51bGwsXHJcbiAgICAgICAgICBtb2RlOiBzdXBwb3J0ZWRNb2Rlcy5pbmRleE9mKE9VVFBVVF9NT0RFKSA9PSAtMSA/IFVOS05PV05fTU9ERSA6IE9VVFBVVF9NT0RFLFxyXG4gICAgICAgICAgcHJldmlvdXNXcml0dGVuVmFsdWU6IExPV1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpc1twaW5zXVtwaW5dID0gT2JqZWN0LmNyZWF0ZShudWxsLCB7XHJcbiAgICAgICAgICBzdXBwb3J0ZWRNb2Rlczoge1xyXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICB2YWx1ZTogT2JqZWN0LmZyZWV6ZShzdXBwb3J0ZWRNb2RlcylcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBtb2RlOiB7XHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIGdldCgpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UubW9kZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIGdldCgpIHtcclxuICAgICAgICAgICAgICBzd2l0Y2ggKGluc3RhbmNlLm1vZGUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgSU5QVVRfTU9ERTpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlLnBlcmlwaGVyYWwucmVhZCgpO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBPVVRQVVRfTU9ERTpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlLnByZXZpb3VzV3JpdHRlblZhbHVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzZXQodmFsdWUpIHtcclxuICAgICAgICAgICAgICBpZiAoaW5zdGFuY2UubW9kZSA9PSBPVVRQVVRfTU9ERSkge1xyXG4gICAgICAgICAgICAgICAgaW5zdGFuY2UucGVyaXBoZXJhbC53cml0ZSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgcmVwb3J0OiB7XHJcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgIHZhbHVlOiAxXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgYW5hbG9nQ2hhbm5lbDoge1xyXG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICB2YWx1ZTogMTI3XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGluc3RhbmNlLm1vZGUgPT0gT1VUUFVUX01PREUpIHtcclxuICAgICAgICAgIHRoaXMucGluTW9kZShwaW4sIE9VVFBVVF9NT0RFKTtcclxuICAgICAgICAgIHRoaXMuZGlnaXRhbFdyaXRlKHBpbiwgTE9XKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gRmlsbCBpbiB0aGUgaG9sZXMsIHNpbnMgcGlucyBhcmUgc3BhcnNlIG9uIHRoZSBBKy9CKy8yXHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpc1twaW5zXS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmICghdGhpc1twaW5zXVtpXSkge1xyXG4gICAgICAgICAgdGhpc1twaW5zXVtpXSA9IE9iamVjdC5jcmVhdGUobnVsbCwge1xyXG4gICAgICAgICAgICBzdXBwb3J0ZWRNb2Rlczoge1xyXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgdmFsdWU6IE9iamVjdC5mcmVlemUoW10pXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1vZGU6IHtcclxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGdldCgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBVTktOT1dOX01PREU7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgZ2V0KCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICBzZXQoKSB7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICByZXBvcnQ6IHtcclxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgIHZhbHVlOiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGFuYWxvZ0NoYW5uZWw6IHtcclxuICAgICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxyXG4gICAgICAgICAgICAgIHZhbHVlOiAxMjdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzW2lzUmVhZHldID0gdHJ1ZTtcclxuICAgICAgdGhpcy5lbWl0KCdyZWFkeScpO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmVzZXQoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Jlc2V0IGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgbm9ybWFsaXplKHBpbikge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZFBpbiA9IGdldFBpbk51bWJlcihwaW4pO1xyXG4gICAgaWYgKHR5cGVvZiBub3JtYWxpemVkUGluID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBwaW4gXCInICsgcGluICsgJ1wiJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbm9ybWFsaXplZFBpbjtcclxuICB9XHJcblxyXG4gIFtnZXRQaW5JbnN0YW5jZV0ocGluKSB7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbaW5zdGFuY2VzXVtwaW5dO1xyXG4gICAgaWYgKCFwaW5JbnN0YW5jZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gcGluIFwiJyArIHBpbiArICdcIicpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHBpbkluc3RhbmNlO1xyXG4gIH1cclxuXHJcbiAgcGluTW9kZShwaW4sIG1vZGUpIHtcclxuICAgIHRoaXNbcGluTW9kZV0oe1xyXG4gICAgICBwaW4sXHJcbiAgICAgIG1vZGVcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgW3Bpbk1vZGVdKHsgcGluLCBtb2RlLCBwdWxsUmVzaXN0b3IgPSBQVUxMX05PTkUgfSkge1xyXG4gICAgY29uc3Qgbm9ybWFsaXplZFBpbiA9IHRoaXMubm9ybWFsaXplKHBpbik7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbZ2V0UGluSW5zdGFuY2VdKG5vcm1hbGl6ZWRQaW4pO1xyXG4gICAgcGluSW5zdGFuY2UucHVsbFJlc2lzdG9yID0gcHVsbFJlc2lzdG9yO1xyXG4gICAgY29uc3QgY29uZmlnID0ge1xyXG4gICAgICBwaW46IG5vcm1hbGl6ZWRQaW4sXHJcbiAgICAgIHB1bGxSZXNpc3RvcjogcGluSW5zdGFuY2UucHVsbFJlc2lzdG9yXHJcbiAgICB9O1xyXG4gICAgaWYgKHRoaXNbcGluc11bbm9ybWFsaXplZFBpbl0uc3VwcG9ydGVkTW9kZXMuaW5kZXhPZihtb2RlKSA9PSAtMSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BpbiBcIicgKyBwaW4gKyAnXCIgZG9lcyBub3Qgc3VwcG9ydCBtb2RlIFwiJyArIG1vZGUgKyAnXCInKTtcclxuICAgIH1cclxuICAgIGlmIChwaW4gPT0gTEVEX1BJTiAmJiAhKHBpbkluc3RhbmNlLnBlcmlwaGVyYWwgaW5zdGFuY2VvZiBMRUQpKSB7XHJcbiAgICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwgPSBuZXcgTEVEKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzd2l0Y2ggKG1vZGUpIHtcclxuICAgICAgICBjYXNlIElOUFVUX01PREU6XHJcbiAgICAgICAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsID0gbmV3IERpZ2l0YWxJbnB1dChjb25maWcpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBPVVRQVVRfTU9ERTpcclxuICAgICAgICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwgPSBuZXcgRGlnaXRhbE91dHB1dChjb25maWcpO1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBQV01fTU9ERTpcclxuICAgICAgICBjYXNlIFNFUlZPX01PREU6XHJcbiAgICAgICAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsID0gbmV3IFBXTShub3JtYWxpemVkUGluKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1Vua25vd24gcGluIG1vZGU6ICcgKyBtb2RlKTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBwaW5JbnN0YW5jZS5tb2RlID0gbW9kZTtcclxuICB9XHJcblxyXG4gIGFuYWxvZ1JlYWQoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2FuYWxvZ1JlYWQgaXMgbm90IHN1cHBvcnRlZCBvbiB0aGUgUmFzcGJlcnJ5IFBpJyk7XHJcbiAgfVxyXG5cclxuICBhbmFsb2dXcml0ZShwaW4sIHZhbHVlKSB7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbZ2V0UGluSW5zdGFuY2VdKHRoaXMubm9ybWFsaXplKHBpbikpO1xyXG4gICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgIT0gUFdNX01PREUpIHtcclxuICAgICAgdGhpcy5waW5Nb2RlKHBpbiwgUFdNX01PREUpO1xyXG4gICAgfVxyXG4gICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbC53cml0ZShNYXRoLnJvdW5kKHZhbHVlICogMTAwMCAvIDI1NSkpO1xyXG4gIH1cclxuXHJcbiAgZGlnaXRhbFJlYWQocGluLCBoYW5kbGVyKSB7XHJcbiAgICBjb25zdCBwaW5JbnN0YW5jZSA9IHRoaXNbZ2V0UGluSW5zdGFuY2VdKHRoaXMubm9ybWFsaXplKHBpbikpO1xyXG4gICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgIT0gSU5QVVRfTU9ERSkge1xyXG4gICAgICB0aGlzLnBpbk1vZGUocGluLCBJTlBVVF9NT0RFKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICBsZXQgdmFsdWU7XHJcbiAgICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlID09IElOUFVUX01PREUpIHtcclxuICAgICAgICB2YWx1ZSA9IHBpbkluc3RhbmNlLnBlcmlwaGVyYWwucmVhZCgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhbHVlID0gcGluSW5zdGFuY2UucHJldmlvdXNXcml0dGVuVmFsdWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgICBoYW5kbGVyKHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgICB0aGlzLmVtaXQoJ2RpZ2l0YWwtcmVhZC0nICsgcGluLCB2YWx1ZSk7XHJcbiAgICB9LCBESUdJVEFMX1JFQURfVVBEQVRFX1JBVEUpO1xyXG4gICAgcGluSW5zdGFuY2UucGVyaXBoZXJhbC5vbignZGVzdHJveWVkJywgKCkgPT4ge1xyXG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgZGlnaXRhbFdyaXRlKHBpbiwgdmFsdWUpIHtcclxuICAgIGNvbnN0IHBpbkluc3RhbmNlID0gdGhpc1tnZXRQaW5JbnN0YW5jZV0odGhpcy5ub3JtYWxpemUocGluKSk7XHJcbiAgICBpZiAocGluSW5zdGFuY2UubW9kZSA9PT0gSU5QVVRfTU9ERSAmJiB2YWx1ZSA9PT0gSElHSCkge1xyXG4gICAgICB0aGlzW3Bpbk1vZGVdKHtcclxuICAgICAgICBwaW4sXHJcbiAgICAgICAgbW9kZTogSU5QVVRfTU9ERSxcclxuICAgICAgICBwdWxsUmVzaXN0b3I6IFBVTExfVVBcclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2UgaWYgKHBpbkluc3RhbmNlLm1vZGUgIT0gT1VUUFVUX01PREUpIHtcclxuICAgICAgdGhpc1twaW5Nb2RlXSh7XHJcbiAgICAgICAgcGluLFxyXG4gICAgICAgIG1vZGU6IE9VVFBVVF9NT0RFXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgaWYgKHBpbkluc3RhbmNlLm1vZGUgPT09IE9VVFBVVF9NT0RFICYmIHZhbHVlICE9IHBpbkluc3RhbmNlLnByZXZpb3VzV3JpdHRlblZhbHVlKSB7XHJcbiAgICAgIHBpbkluc3RhbmNlLnBlcmlwaGVyYWwud3JpdGUodmFsdWUgPyBISUdIIDogTE9XKTtcclxuICAgICAgcGluSW5zdGFuY2UucHJldmlvdXNXcml0dGVuVmFsdWUgPSB2YWx1ZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHNlcnZvV3JpdGUocGluLCB2YWx1ZSkge1xyXG4gICAgY29uc3QgcGluSW5zdGFuY2UgPSB0aGlzW2dldFBpbkluc3RhbmNlXSh0aGlzLm5vcm1hbGl6ZShwaW4pKTtcclxuICAgIGlmIChwaW5JbnN0YW5jZS5tb2RlICE9IFNFUlZPX01PREUpIHtcclxuICAgICAgdGhpcy5waW5Nb2RlKHBpbiwgU0VSVk9fTU9ERSk7XHJcbiAgICB9XHJcbiAgICBwaW5JbnN0YW5jZS5wZXJpcGhlcmFsLndyaXRlKDQ4ICsgTWF0aC5yb3VuZCh2YWx1ZSAqIDQ4IC8gMTgwKSk7XHJcbiAgfVxyXG5cclxuICBxdWVyeUNhcGFiaWxpdGllcyhjYikge1xyXG4gICAgaWYgKHRoaXMuaXNSZWFkeSkge1xyXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGNiKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMub24oJ3JlYWR5JywgY2IpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcXVlcnlBbmFsb2dNYXBwaW5nKGNiKSB7XHJcbiAgICBpZiAodGhpcy5pc1JlYWR5KSB7XHJcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY2IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5vbigncmVhZHknLCBjYik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBxdWVyeVBpblN0YXRlKHBpbiwgY2IpIHtcclxuICAgIGlmICh0aGlzLmlzUmVhZHkpIHtcclxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhjYik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLm9uKCdyZWFkeScsIGNiKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIFtpMmNDaGVja0FsaXZlXSgpIHtcclxuICAgIGlmICghdGhpc1tpMmNdLmFsaXZlKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSTJDIHBpbnMgbm90IGluIEkyQyBtb2RlJyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpMmNDb25maWcob3B0aW9ucykge1xyXG4gICAgbGV0IGRlbGF5O1xyXG5cclxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ251bWJlcicpIHtcclxuICAgICAgZGVsYXkgPSBvcHRpb25zO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0JyAmJiBvcHRpb25zICE9PSBudWxsKSB7XHJcbiAgICAgICAgZGVsYXkgPSBvcHRpb25zLmRlbGF5O1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpc1tpMmNDaGVja0FsaXZlXSgpO1xyXG5cclxuICAgIHRoaXNbaTJjRGVsYXldID0gZGVsYXkgfHwgMDtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIGkyY1dyaXRlKGFkZHJlc3MsIGNtZFJlZ09yRGF0YSwgaW5CeXRlcykge1xyXG4gICAgdGhpc1tpMmNDaGVja0FsaXZlXSgpO1xyXG5cclxuICAgIC8vIElmIGkyY1dyaXRlIHdhcyB1c2VkIGZvciBhbiBpMmNXcml0ZVJlZyBjYWxsLi4uXHJcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMyAmJiAhQXJyYXkuaXNBcnJheShjbWRSZWdPckRhdGEpICYmICFBcnJheS5pc0FycmF5KGluQnl0ZXMpKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmkyY1dyaXRlUmVnKGFkZHJlc3MsIGNtZFJlZ09yRGF0YSwgaW5CeXRlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRml4IGFyZ3VtZW50cyBpZiBjYWxsZWQgd2l0aCBGaXJtYXRhLmpzIEFQSVxyXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY21kUmVnT3JEYXRhKSkge1xyXG4gICAgICAgIGluQnl0ZXMgPSBjbWRSZWdPckRhdGEuc2xpY2UoKTtcclxuICAgICAgICBjbWRSZWdPckRhdGEgPSBpbkJ5dGVzLnNoaWZ0KCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgaW5CeXRlcyA9IFtdO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgYnVmZmVyID0gbmV3IEJ1ZmZlcihbY21kUmVnT3JEYXRhXS5jb25jYXQoaW5CeXRlcykpO1xyXG5cclxuICAgIC8vIE9ubHkgd3JpdGUgaWYgYnl0ZXMgcHJvdmlkZWRcclxuICAgIGlmIChidWZmZXIubGVuZ3RoKSB7XHJcbiAgICAgIHRoaXNbaTJjXS53cml0ZVN5bmMoYWRkcmVzcywgYnVmZmVyKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIGkyY1dyaXRlUmVnKGFkZHJlc3MsIHJlZ2lzdGVyLCB2YWx1ZSkge1xyXG4gICAgdGhpc1tpMmNDaGVja0FsaXZlXSgpO1xyXG5cclxuICAgIHRoaXNbaTJjXS53cml0ZUJ5dGVTeW5jKGFkZHJlc3MsIHJlZ2lzdGVyLCB2YWx1ZSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBbaTJjUmVhZF0oY29udGludW91cywgYWRkcmVzcywgcmVnaXN0ZXIsIGJ5dGVzVG9SZWFkLCBjYWxsYmFjaykge1xyXG4gICAgdGhpc1tpMmNDaGVja0FsaXZlXSgpO1xyXG5cclxuICAgIC8vIEZpeCBhcmd1bWVudHMgaWYgY2FsbGVkIHdpdGggRmlybWF0YS5qcyBBUElcclxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDQgJiYgdHlwZW9mIHJlZ2lzdGVyID09ICdudW1iZXInICYmIHR5cGVvZiBieXRlc1RvUmVhZCA9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgIGNhbGxiYWNrID0gYnl0ZXNUb1JlYWQ7XHJcbiAgICAgIGJ5dGVzVG9SZWFkID0gcmVnaXN0ZXI7XHJcbiAgICAgIHJlZ2lzdGVyID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjYWxsYmFjayA9IHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJyA/IGNhbGxiYWNrIDogKCkgPT4ge1xyXG4gICAgfTtcclxuXHJcbiAgICBsZXQgZXZlbnQgPSAnSTJDLXJlcGx5JyArIGFkZHJlc3MgKyAnLSc7XHJcbiAgICBldmVudCArPSByZWdpc3RlciAhPT0gbnVsbCA/IHJlZ2lzdGVyIDogMDtcclxuXHJcbiAgICBjb25zdCByZWFkID0gKCkgPT4ge1xyXG4gICAgICBjb25zdCBhZnRlclJlYWQgPSAoZXJyLCBidWZmZXIpID0+IHtcclxuICAgICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5lbWl0KCdlcnJvcicsIGVycik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBDb252ZXJ0IGJ1ZmZlciB0byBBcnJheSBiZWZvcmUgZW1pdFxyXG4gICAgICAgIHRoaXMuZW1pdChldmVudCwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYnVmZmVyKSk7XHJcblxyXG4gICAgICAgIGlmIChjb250aW51b3VzKSB7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KHJlYWQsIHRoaXNbaTJjRGVsYXldKTtcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgICB0aGlzLm9uY2UoZXZlbnQsIGNhbGxiYWNrKTtcclxuXHJcbiAgICAgIGlmIChyZWdpc3RlciAhPT0gbnVsbCkge1xyXG4gICAgICAgIHRoaXNbaTJjXS5yZWFkKGFkZHJlc3MsIHJlZ2lzdGVyLCBieXRlc1RvUmVhZCwgYWZ0ZXJSZWFkKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzW2kyY10ucmVhZChhZGRyZXNzLCBieXRlc1RvUmVhZCwgYWZ0ZXJSZWFkKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBzZXRUaW1lb3V0KHJlYWQsIHRoaXNbaTJjRGVsYXldKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIGkyY1JlYWQoLi4ucmVzdCkge1xyXG4gICAgcmV0dXJuIHRoaXNbaTJjUmVhZF0odHJ1ZSwgLi4ucmVzdCk7XHJcbiAgfVxyXG5cclxuICBpMmNSZWFkT25jZSguLi5yZXN0KSB7XHJcbiAgICByZXR1cm4gdGhpc1tpMmNSZWFkXShmYWxzZSwgLi4ucmVzdCk7XHJcbiAgfVxyXG5cclxuICBzZW5kSTJDQ29uZmlnKC4uLnJlc3QpIHtcclxuICAgIHJldHVybiB0aGlzLmkyY0NvbmZpZyguLi5yZXN0KTtcclxuICB9XHJcblxyXG4gIHNlbmRJMkNXcml0ZVJlcXVlc3QoLi4ucmVzdCkge1xyXG4gICAgcmV0dXJuIHRoaXMuaTJjV3JpdGUoLi4ucmVzdCk7XHJcbiAgfVxyXG5cclxuICBzZW5kSTJDUmVhZFJlcXVlc3QoLi4ucmVzdCkge1xyXG4gICAgcmV0dXJuIHRoaXMuaTJjUmVhZE9uY2UoLi4ucmVzdCk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZUNvbmZpZyhwaW4sIGVuYWJsZVBhcmFzaXRpY1Bvd2VyKSB7XHJcbiAgICBleGVjU3luYy5ydW4oJ21vZHByb2JlIHcxLWdwaW8nKTtcclxuICAgIGV4ZWNTeW5jLnJ1bignbW9kcHJvYmUgdzEtdGhlcm0nKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlU2VhcmNoKHBpbiwgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuX3NlbmRPbmVXaXJlU2VhcmNoKGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlQWxhcm1zU2VhcmNoKHBpbiwgY2FsbGJhY2spIHtcclxuICAgIHRoaXMuX3NlbmRPbmVXaXJlU2VhcmNoKGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIF9zZW5kT25lV2lyZVNlYXJjaChjYWxsYmFjaykge1xyXG4gICAgZnMucmVhZEZpbGUoT05FX1dJUkVfTElTVF9QQVRILCAoZXJyLCBkYXRhKSA9PiB7XHJcbiAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnIsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRvQXJyYXkoZGF0YSkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlUmVhZChwaW4sIGRldmljZSwgbnVtQnl0ZXNUb1JlYWQsIGNhbGxiYWNrKSB7XHJcbiAgICB0aGlzLl9zZW5kT25lV2lyZVJlcXVlc3QocGluLCBkZXZpY2UsIGNhbGxiYWNrKTtcclxuICB9XHJcblxyXG4gIHNlbmRPbmVXaXJlUmVzZXQocGluKSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlQ29uZmlnIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVXcml0ZShwaW4sIGRldmljZSwgZGF0YSkge1xyXG4gICAgLy8gdGhyb3cgbmV3IEVycm9yKCdzZW5kT25lV2lyZVdyaXRlIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgc2VuZE9uZVdpcmVEZWxheShwaW4sIGRlbGF5KSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlRGVsYXkgaXMgbm90IHN1cHBvcnRlZCBvbiB0aGUgUmFzcGJlcnJ5IFBpJyk7XHJcbiAgfVxyXG5cclxuICBzZW5kT25lV2lyZVdyaXRlQW5kUmVhZChwaW4sIGRldmljZSwgZGF0YSwgbnVtQnl0ZXNUb1JlYWQsIGNhbGxiYWNrKSB7XHJcbiAgICAvLyB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRPbmVXaXJlV3JpdGVBbmRSZWFkIGlzIG5vdCBzdXBwb3J0ZWQgb24gdGhlIFJhc3BiZXJyeSBQaScpO1xyXG4gIH1cclxuXHJcbiAgX2dldE9uZVdpcmVGaWxlTmFtZShkZXZpY2VJZCkge1xyXG4gICAgcmV0dXJuIHBhdGgucmVzb2x2ZShPTkVfV0lSRV9CQVNFX1BBVEgsIGRldmljZUlkLCAndzFfc2xhdmUnKTtcclxuICB9XHJcblxyXG4gIF9zZW5kT25lV2lyZVJlcXVlc3QocGluLCBkZXZpY2UsIGNhbGxiYWNrKSB7XHJcbiAgICBmcy5yZWFkRmlsZSh0aGlzLl9nZXRPbmVXaXJlRmlsZU5hbWUoZGV2aWNlKSwgKGVyciwgZGF0YSkgPT4ge1xyXG4gICAgICBpZiAoZXJyKSB7XHJcbiAgICAgICAgaWYgKGVyci5jb2RlICYmIGVyci5jb2RlID09PSAnRU5PRU5UJykge1xyXG4gICAgICAgICAgY2FsbGJhY2soJ0NvdWxkIG5vdCByZWFkIGRldmljZSBjb250ZW50LiBEZXZpY2UgXFwnJyArIGRldmljZSArICdcXCcgbm90IGZvdW5kJywgbnVsbCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGNhbGxiYWNrKGVyciwgbnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IGRhdGFTdHIgPSBkYXRhLnRvU3RyaW5nKCk7XHJcblxyXG4gICAgICAgIGxldCByZXN1bHQgPSBmYWxzZTtcclxuICAgICAgICBpZiAoZGF0YVN0ciAmJiBkYXRhU3RyLmluZGV4T2YoJ1lFUycpID4gLTEpIHtcclxuICAgICAgICAgIGNvbnN0IHRlbXAgPSBkYXRhU3RyLm1hdGNoKC90PSgtPyhcXGQrKSkvKTtcclxuXHJcbiAgICAgICAgICBpZiAodGVtcCkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSByb3VuZChwYXJzZUludCh0ZW1wWzFdLCAxMCkgLyAxMDAwLCAxKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgc2V0U2FtcGxpbmdJbnRlcnZhbCgpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignc2V0U2FtcGxpbmdJbnRlcnZhbCBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICByZXBvcnRBbmFsb2dQaW4oKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlcG9ydEFuYWxvZ1BpbiBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICByZXBvcnREaWdpdGFsUGluKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdyZXBvcnREaWdpdGFsUGluIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcblxyXG4gIHBpbmdSZWFkKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwaW5nUmVhZCBpcyBub3QgeWV0IGltcGxlbWVudGVkJyk7XHJcbiAgfVxyXG5cclxuICBwdWxzZUluKCkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdwdWxzZUluIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcblxyXG4gIHN0ZXBwZXJDb25maWcoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0ZXBwZXJDb25maWcgaXMgbm90IHlldCBpbXBsZW1lbnRlZCcpO1xyXG4gIH1cclxuXHJcbiAgc3RlcHBlclN0ZXAoKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3N0ZXBwZXJTdGVwIGlzIG5vdCB5ZXQgaW1wbGVtZW50ZWQnKTtcclxuICB9XHJcbn1cclxuXHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSYXNwaSwgJ2lzUmFzcGJlcnJ5UGknLCB7XHJcbiAgZW51bWVyYWJsZTogdHJ1ZSxcclxuICB2YWx1ZTogKCkgPT4ge1xyXG4gICAgLy8gRGV0ZXJtaW5pbmcgaWYgYSBzeXN0ZW0gaXMgYSBSYXNwYmVycnkgUGkgaXNuJ3QgcG9zc2libGUgdGhyb3VnaFxyXG4gICAgLy8gdGhlIG9zIG1vZHVsZSBvbiBSYXNwYmlhbiwgc28gd2UgcmVhZCBpdCBmcm9tIHRoZSBmaWxlIHN5c3RlbSBpbnN0ZWFkXHJcbiAgICBsZXQgaXNSYXNwYmVycnlQaSA9IGZhbHNlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgaXNSYXNwYmVycnlQaSA9IGZzLnJlYWRGaWxlU3luYygnL2V0Yy9vcy1yZWxlYXNlJykudG9TdHJpbmcoKS5pbmRleE9mKCdSYXNwYmlhbicpICE9PSAtMTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgIH0vLyBTcXVhc2ggZmlsZSBub3QgZm91bmQsIGV0YyBlcnJvcnNcclxuICAgIHJldHVybiBpc1Jhc3BiZXJyeVBpO1xyXG4gIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFJhc3BpO1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
