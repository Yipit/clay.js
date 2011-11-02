/* -*- coding: utf-8 -*-
<clay - active record for node.js with redis backend>
Copyright (C) <2011>  Gabriel Falcão <gabriel@yipit.com>

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE. */

var events = require('events'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
      base = require('./mechanism'),
         _ = require('underscore')._,
     redis = require('redis');

function RedisMechanism (){
    base.Mechanism.call(this);
    this.name = 'RedisMechanism';
    this.initialize.apply(this, arguments);
};

util.inherits(RedisMechanism, base.Mechanism);

RedisMechanism.prototype.initialize = function(client){
    this.connection = client || redis.createClient();
}

RedisMechanism.prototype.persist = function(instance, callback){
    var self = this;
    var key = 'clay:' + instance._meta.name + ':id';

    self.connection.incr(key, function(err, index){
        var pk = key + ":" + index;
        if (err) {return callback(err, pk, instance, self, self.connection)};

        self.connection.hmset(pk, instance.__data__, function (err) {
            if (instance._meta.indexes.length > 0) {
                _.each(instance._meta.indexes, function(attr){
                    var value = instance[attr];
                    var key = 'clay:' + instance._meta.name + ':indexes:' + attr + ':' + value;
                    self.connection.sadd(key, pk, function(err){
                        if (attr == instance._meta.indexes.last) {
                            callback(err, pk, instance, self, self.connection);
                        }
                    });
                });
            } else {
                callback(err, pk, instance, self, self.connection);
            }
        });
    });
}

module.exports.RedisMechanism = RedisMechanism;