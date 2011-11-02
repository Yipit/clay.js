(function(){
    require('../../base');

    var events = require('events'),
        crypto = require('crypto'),
          path = require('path'),
          util = require('util'),
          base = require('./mechanism'),
             _ = require('underscore')._;

    function RedisMechanism (){base.Mechanism.call(this);};
    util.inherits(RedisMechanism, base.Mechanism);
    module.exports.RedisMechanism = RedisMechanism;
})();