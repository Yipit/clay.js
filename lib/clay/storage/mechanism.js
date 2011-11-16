var events = require('events'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
         _ = require('underscore')._;

function Mechanism (){
    this.ids = {};
    events.EventEmitter.call(this);
};

util.inherits(Mechanism, events.EventEmitter);
Mechanism.prototype.get_next_id_for = function(key, callback){
    if (_.isUndefined(this.ids[key])) {
        this.ids[key] = 1;
    }
    callback(null, this.ids[key]++);
}
module.exports.Mechanism = Mechanism;
