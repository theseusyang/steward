// YoctoHub-Ethernet: http://www.yoctopuce.com/EN/products/extensions-and-networking/yoctohub-ethernet

var util        = require('util')
  , yapi        = require('yoctolib')
  , devices     = require('./../../core/device')
  , steward     = require('./../../core/steward')
  , utility     = require('./../../core/utility')
  , broker      = utility.broker
  ;


var logger   = exports.logger = utility.logger('gateway');

var modules  = {};
var products = {};


var Hub = exports.Device = function(deviceID, deviceUID, info) {
  var result;

  var self = this;

  self.whatami = '/device/gateway/yoctopuce/ethernet';
  self.deviceID = deviceID.toString();
  self.deviceUID = deviceUID;
  self.name = info.device.name;
  self.getName();

  self.url = info.url;
  self.status = 'ready';
  self.changed();
  self.info = {};

  broker.subscribe('actors', function(request, taskID, actor, perform, parameter) {/* jshint unused: false */
    if (actor !== ('device/' + self.deviceID)) return;

    if (request === 'perform') return devices.perform(self, taskID, perform, parameter);
  });

  result = yapi.yRegisterHub(self.url);
  if (result != yapi.YAPI_SUCCESS) return logger.error('device/' + self.deviceID, { event: 'yRegisterHub', result: result });

  yapi.yUpdateDeviceList();
  setTimeout(function() {
    var module;

    for (module = yapi.yFirstModule(); !!module; module = module.nextModule()) self.addstation(module);
  }, 0);
};
util.inherits(Hub, require('./../device-gateway').Device);


Hub.prototype.addstation = function(module) {
  var info, modelNumber, productName, serialNumber, suffix, x;

  var self = this;

  serialNumber = module.get_serialNumber();
  if (!!modules[serialNumber]) return;

  productName = module.get_productName();
  suffix =  (productName.indexOf('Yocto-') !== 0) ? productName : productName.substring(6);

  x = serialNumber.indexOf('-');
  if (x !== -1) modelNumber = serialNumber.substring(0, x);

  switch (productName) {
    case 'YoctoHub-Ethernet':
      return;

    default:
      if (!!products[productName]) break;
      return logger.warning('device/' + self.deviceID, { event: 'unknown module', result: productName });
  }

  info =  { source: self.deviceID, gateway: self, module: module };
  info.device = { url                          : null
                , name                         : module.get_logicalName() || productName
                , manufacturer                 : 'Yoctopuce'
                , model        : { name        : productName
                                 , description : ''
                                 , number      : modelNumber
                                 }
                , unit         : { serial      : serialNumber
                                 , udn         : 'yoctopuce:' + serialNumber
                                 }
                };
  info.url = info.device.url;
  info.deviceType = products[productName];
  info.id = info.device.unit.udn;

  logger.info('device/' + self.deviceID, { name: info.device.name, id: info.device.unit.serial, type: productName });
  devices.discover(info);
  self.changed();
};

exports.validate_perform = function(perform, parameter) {
  var params = {}
    , result = { invalid: [], requires: [] }
    ;

  if (perform !== 'set') {
    result.invalid.push('perform');
    return result;
  }
  if (!parameter) {
    result.requires.push('parameter');
    return result;
  }

  try { params = JSON.parse(parameter); } catch(ex) { result.invalid.push('parameter'); }

  if (!params.name) result.requires.push('name');

  if (!yapi.yCheckLogicalName(params.name)) result.invalid.push('name');

  return result;
};


exports.register = function(productName, deviceType) {
  products[productName] = deviceType;
};


exports.start = function() {
  yapi.yDisableExceptions();

  steward.actors.device.gateway.yoctopuce = steward.actors.device.gateway.yoctopuce ||
      { $info     : { type: '/device/gateway/yoctopuce' } };

  steward.actors.device.gateway.yoctopuce.ethernet =
      { $info     : { type       : '/device/gateway/yoctopuce/ethernet'
                    , observe    : [ ]
                    , perform    : [ ]
                    , properties : { name   : true
                                   , status : [ 'ready' ]
                                   }
                    }
      , $validate : { perform    : exports.validate_perform
                    }
      };
  devices.makers['YoctoHub-Ethernet'] = Hub;
};
