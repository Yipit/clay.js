var events = require('events'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
         _ = require('underscore')._;

function Mechanism (){
    events.EventEmitter.call(this);
};

util.inherits(Mechanism, events.EventEmitter);
Mechanism.prototype.persist = function(instance, callback){
    var pk = _.uniqueId('clay:' + instance._meta.name + ':id:');
    callback(null, pk, instance);
}

module.exports.Mechanism = Mechanism;
