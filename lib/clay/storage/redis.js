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

var
    async = require('async'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
      fs = require('fs'),
      base = require('./mechanism'),
         _ = require('underscore')._,
     redis = require('redis');

function RedisMechanism (){
    base.Mechanism.call(this);
    this.name = 'RedisMechanism';
    this.initialize.apply(this, arguments);
}

util.inherits(RedisMechanism, base.Mechanism);

RedisMechanism.prototype.initialize = function(client){
    this.connection = client || redis.createClient();
};

RedisMechanism.prototype._make_model = function(Model, data, err, callback){
    var self = this;
    var m = new Model(data);
    return callback(err, m);
};

RedisMechanism.prototype._get_data_and_relationships = function(pk, key, index, instance){
    var self = this;

    function is_instance_and_has_id (v){
        return ((!_.isUndefined(v)) && (_.isNumber(v.__id__) || (!_.isUndefined(v.__data__) && _.isNumber(v.__data__.__id__))));
    }

    var data = {};
    var _filter_keys = function(list){
        return _.map(list,function(i){return i.property;});
    };

    var one_to_many_keys = _filter_keys(instance._meta.relationships.has_one);
    var many_to_one_keys = instance._meta.relationships.has_many;

    _.each(instance.__data__, function(value, key) {
        if (_.include(one_to_many_keys, key)) {
            var rel = instance[key];
            var v = 'clay:' + rel._meta.name + ':id:' + (rel.__id__ || rel.__data__.__id__);
            data[key] = v;
        } else {
            data[key] = instance[key];
        }
    });
    var many_to_one_items = [];

    _.each(instance._meta.relationships.has_many, function(rel){
        var items = instance.__data__[rel.property];
        _.each(items, function(obj){
            many_to_one_items.push({
                spec: rel,
                obj: obj,
                first: false,
                last: false
            });
        });
    });
    if (many_to_one_items.length > 0) {
        many_to_one_items[0].first = true;
        many_to_one_items[many_to_one_items.length-1].last = true;
    }
    return {
        empty_many_to_one_items: (many_to_one_items.length === 0),
        data: data,
        many_to_one_items: many_to_one_items
    };
};

RedisMechanism.prototype._convert_relationships_into_its_refs = function(pk, key, index, instance, callback){
    /* should be called before hmset(pk, instance.__data__) */
    var self = this;
    var predicates = self._get_data_and_relationships(pk, key, index, instance);
    if (predicates.empty_many_to_one_items) {
        callback(null, predicates.data);
    }
    _.each(predicates.many_to_one_items, function(item){
        var rel_pk = 'clay:' + item.spec.model._meta.name + ':id:' + item.obj.__id__;
        var many_key = pk + ':' + item.spec.property;
        self.connection.zadd(many_key, item.obj.__id__, rel_pk, function(err){
            if (item.last) {
                callback(null, predicates.data);
            }
        });
    });
};


RedisMechanism.prototype.persist = function(input, callback_complete){
    var self = this;

    if (!_.isArray(input)) {
        input = [input];
    }
    var lock_err = [
        'could not acquire the lock within 1 second.',
        ' Something went pretty wrong when persisting:\n\n'
    ].join('');

    async.mapSeries(input, function(instance, callback){
        var key = 'clay:' + instance._meta.name + ':id:';
        var count_key = 'clay:' + instance._meta.name + ':count';

        var instance_id = instance.__id__ || instance.__data__.__id__;
        var instance_has_an_id_already = Boolean(instance_id);

        async.waterfall([
            function increment_index_preemptively (callback){
                return self.connection.incr(count_key, callback);
            },
            function get_previous_index (_index, callback){
                var index = parseInt(_index, 10);
                var current_id = parseInt(instance.__id__ || instance.__data__.__id__ || index, 10);

                return callback(null, current_id, index);
            },
            function decrement_index_if_necessary (current_id, index, callback){
                if (instance_has_an_id_already && current_id > index) {
                    return self.connection.set(count_key, current_id, callback);
                } else {
                    return callback(null, current_id);
                }
            },
            function persist_model_data (id, callback){
                var primary_key = key + id;
                instance.__data__.__id__ = instance.__id__ = id;

                self.connection.hmset(primary_key, instance.__data__, function(err){
                    return callback(err, id, primary_key);
                });
            },
            function persist_indexes_if_needed (id, primary_key, callback){
                if (instance._meta.indexes.length === 0) {
                    return callback(null, id, primary_key, []);
                }
                async.mapSeries(instance._meta.indexes, function(attr, callback) {
                    var value = instance[attr];
                    var index_key = 'clay:' + instance._meta.name + ':indexes:' + attr + ':' + value;
                    self.connection.zadd(index_key, id, primary_key, function(err){
                        return callback(err, index_key);
                    });
                }, function(err, indexes){
                    return callback(err, id, primary_key, indexes);
                });
            }
        ], function(err, id, primary_key, indexes) {
            return callback(err, {
                pk: primary_key,
                instance: instance,
                id: id,
                indexes: indexes
            });
        });
    }, function (err, results){
        var primary_keys = _.pluck(results, 'pk');
        var instances = _.pluck(results, 'instance');
        if (err) {return callback_complete(err, primary_keys, instance, self, self.connection);}

        self.connection.save(function(err){
            return callback_complete(err, primary_keys, instances, self, self.connection);
        });

    });
};

RedisMechanism.prototype.find_by_id = function(Model, id, callback){
    var self = this;
    var key = 'clay:' + Model._meta.name + ':id:' + id;
    var notfound = new Error('could not find a ' + Model._meta.name + ' with the id ' + id);
    async.waterfall([
        function lookup(callback) {
            self.connection.hlen(key, callback);
        }
    ], function(err, found){
        if (err) return callback(err, null);
        if (found) {
            self.connection.hgetall(key, function(err, data){
                return self._make_model(Model, data, err, callback);
            });
        } else {

            callback(notfound, null);
        }
    });
};

RedisMechanism.prototype.erase = function(instance, callback){
    var self = this;
    var key = 'clay:' + instance._meta.name + ':id:' + instance.__id__;

    self.connection.del(key, function(err, total_removed){
        return callback(err);
    });
};

RedisMechanism.prototype.populate_model_from_key = function(Model, key, callback){
    var self = this;
    self.connection.hgetall(key, function(err, data){
        if (err) return callback(err);
        callback(null, new Model(data));
    });
};

RedisMechanism.prototype.find_by_regex_match = function(Model, field, match, callback){
    var self = this;
    var glob = 'clay:' + Model._meta.name + ':id:*';

    async.waterfall([
        function get_all_keys(callback) {
            self.connection.keys(glob, callback);
        },
        function filter_by_the_ones_that_match(keys, callback){
            async.filter(keys, function(key, callback){
                self.connection.hget(key, field, function(err, value){
                    return callback(match.test(value) ? value : null);
                });
            }, function(keys){
                callback(null, keys);
            });
        },
        function sort_by_index_descending(keys, callback) {
            var sorted_keys = _.sortBy(keys, function(key){
                var id = parseInt(/\d+$/.exec(key)[0], 10);
                return id * -1; /* times -1 so that it will be reversed */
            });
            callback(null, sorted_keys);
        },
        function fetch_all_the_fields_for_the_matched_keys(keys, callback){
            async.mapSeries(keys, function(key, callback){
                self.populate_model_from_key(Model, key, callback);
            }, callback);
        }
    ], callback);
};

RedisMechanism.prototype.get_by_regex_match = function(Model, field, match, callback){
    var self = this;
    return self.find_by_regex_match(Model, field, match, function(err, results){
        var item = (results.length > 0) ? results.first : null;
        return callback(err, item);
    });
};

RedisMechanism.prototype.sync = function(instance, callback){
    var self = this;
    var finished = true;
    _.each(instance._meta.relationships.has_many, function(spec){
        finished = false;
        var key = 'clay:' + instance._meta.name + ':id:' + instance.__data__.__id__ + ':' + spec.property;

        self.connection.zrange(key, 0, -1, function(e, res) {
            if (spec === _.last(instance._meta.relationships.has_many)) {
                callback(null, instance);
            }
        });
    });
    if (finished) {
        callback(null, instance);
    }
};

module.exports.RedisMechanism = RedisMechanism;
