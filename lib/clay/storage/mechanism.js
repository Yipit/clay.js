var events = require('events'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
         _ = require('underscore')._;

function Mechanism (){events.EventEmitter.call(this);};
util.inherits(Mechanism, events.EventEmitter);
module.exports.Mechanism = Mechanism;