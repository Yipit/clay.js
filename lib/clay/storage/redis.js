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

var LOCKS = {
    persist: 'clay|lock|persist'
};

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

    var atomic_connection = self.connection; //.multi();
    if (!_.isArray(input)) {
        input = [input];
    }
    var lock_err = [
        'could not acquire the lock within 1 second.',
        ' Something went pretty wrong when persisting:\n\n'
    ].join('');

    async.waterfall([
        function wait_for_lock(callback){
            var counting = 0;
            function has_timed_out (){
                return counting > 1000;
            }
            var my_handle = setInterval(function(){
                /* increasing the counter, acoiding to get stuck too many times */
                counting++;
                atomic_connection.get(LOCKS.persist, function(err, locked){
                    if (err) {
                        return callback(err);
                    } else if (!locked) {
                        clearInterval(my_handle);
                        return callback(null, locked);
                    } else if (has_timed_out()) {
                        var when = new Date(locked);
                        err = new Error('['+when+']' + input);
                        clearInterval(my_handle);
                        return callback(err);
                    }
                });
            }, 1);
        },
        function acquire_the_lock(locked, callback) {
            var when = (new Date()).toString();
            atomic_connection.set(LOCKS.persist, when, callback);
        }
    ], function(err){
        if (err) {
            throw err;
        }

        async.mapSeries(input, function(instance, callback){
            var key = 'clay:' + instance._meta.name + ':id:';
            var glob_pattern = key + '*';
            async.waterfall([
                function get_previous_index(callback){
                    var current_id = parseInt(instance.__id__ || instance.__data__.__id__, 10);
                    if (current_id) {
                        return callback(null, current_id);
                    } else {
                        atomic_connection.keys(glob_pattern, callback);
                    }
                },
                function increment_index_if_necessary(keys, callback){
                    if (_.isNumber(keys)) {
                        var id = keys;
                    } else {
                        var id = (keys.length + 1);
                    }
                    var primary_key = key + id;
                    instance.__data__.__id__ = instance.__id__ = id;

                    atomic_connection.hmset(primary_key, instance.__data__, function(err){
                        return callback(err, id, primary_key);
                    });
                },
                function persist_indexes_if_needed(id, primary_key, callback){
                    if (instance._meta.indexes.length === 0) {
                        return callback(err, id, primary_key, []);
                    }
                    async.mapSeries(instance._meta.indexes, function(attr, callback) {
                        var value = instance[attr];
                        var index_key = 'clay:' + instance._meta.name + ':indexes:' + attr + ':' + value;
                        atomic_connection.zadd(index_key, id, primary_key, function(err){
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

            atomic_connection.del(LOCKS.persist, function (){
                return callback_complete(err, primary_keys, instances, self, self.connection);
            });
        });
    });
};

RedisMechanism.prototype.find_by_id = function(Model, id, callback){
    var self = this;
    var key = 'clay:' + Model._meta.name + ':id:' + id;
    this.connection.hgetall(key, function(err, data){
        return self._make_model(Model, data, err, callback);
    });
};

RedisMechanism.prototype.erase = function(instance, callback){
    var self = this;
    var pk = 'clay:' + instance._meta.name + ':id:' + instance.__id__;
    var wildcard = pk + '*';

    _.each(instance._meta.indexes, function(index){
        var in_the_last_index = index === _.last(instance._meta.indexes);
        var key = 'clay:'+instance._meta.name+':indexes:'+index+':'+instance[index];
        self.connection.zrem(key, pk, function(){
            if (in_the_last_index) {
                self.connection.keys(wildcard, function(err, keys){
                    if (err) {return callback(err);}
                    self.connection.del(keys, callback);
                });
            }
        });
    });
};

RedisMechanism.prototype.find_indexed_by_regex_match = function(Model, field, match, callback){
    var self = this;
    var key = 'clay:' + Model._meta.name + ':indexes:' + field + ':';

    self.connection.keys(key + '*', function(err, indexes){
        var instances = [];
        if (indexes.length == 0) {
            return callback(err, indexes);
        }
        _.each(indexes, function(index){
            var in_the_last_index = (index === _.last(indexes));

            self.connection.zrange(index, 0, -1, function(e, res) {
                _.each(res, function(pk) {
                    self.connection.hgetall(pk, function(e, data) {
                        var matches = false;
                        var value = data[field];

                        if (_.isRegExp(match)) {
                            matches = match.test(value);
                        } else {
                            matches = match === value;
                        }

                        if (matches) {
                            instances.push(new Model(data));
                        }

                        if (in_the_last_index) {
                            if (instances.length === 0) {
                                var e = new Error('could not find any "' + field + '" matching the regex ' + match.toString());
                            }
                            callback(e, instances);
                        }
                    })
                });
            });
        });
    });
};

RedisMechanism.prototype.find_non_indexed_by_regex_match = function(Model, field, match, callback){
    var self = this;
    var criteria = 'clay:' + Model._meta.name + ':id:*';

    self.connection.keys(criteria, function(err, indexes){
        var instances = [];
        var valid_keys = _.map(indexes, function(key){ var matched = /\d+$/.test(key); if (matched) {return key;}});
        if (valid_keys.length == 0) {
            return callback(err, valid_keys);
        }

        _.each(valid_keys, function(pk){
            var err = null;
            if (instances.length === 0) {
                err = new Error('could not find any "' + field + '" matching the regex ' + match.toString());
            }

            self.connection.hgetall(pk, function(e, data){
                var matches = false;
                var value = data[field];
                if (_.isRegExp(match)) {
                    matches = match.exec(value);
                } else {
                    matches = match === value;
                }

                if (matches) {
                    instances.push(new Model(data));
                }
                if (pk === _.last(valid_keys)) {
                    callback(e || err, instances);
                }
            });
        });
    });
};

RedisMechanism.prototype.fetch_all = function(Model, callback){
    var self = this;
    var criteria = 'clay:' + Model._meta.name + ':id:*';

    self.connection.keys(criteria, function(err, indexes){
        var instances = [];
        var valid_keys = _.map(indexes, function(key){ var regex = /\d+$/.exec(key); if (regex) {return key;}});
        if (valid_keys.length == 0) {
            return callback(err, valid_keys);
        }

        _.each(valid_keys, function(pk){
            self.connection.hgetall(pk, function(e, data){
                instances.push(new Model(data));
                if (pk === _.last(valid_keys)) {
                    callback(e, instances);
                }
            });
        });
    });
};

RedisMechanism.prototype.find_by_regex_match = function(Model, field, match, callback){
    if (_.include(Model._meta.indexes, field)) {
        return this.find_indexed_by_regex_match(Model, field, match, callback);
    } else {
        return this.find_non_indexed_by_regex_match(Model, field, match, callback);
    }
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
