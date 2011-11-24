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
    events = require('events'),
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

RedisMechanism.prototype._make_model = function(Model, data, err, callback){
    var self = this;
    var m = new Model(data);
    return callback(err, m);
}

RedisMechanism.prototype._get_data_and_relationships = function(pk, key, index, instance){
    var self = this;

    function is_instance_and_has_id (v){
        return ((!_.isUndefined(v)) && (_.isNumber(v.__id__) || (!_.isUndefined(v.__data__) && _.isNumber(v.__data__.__id__))));
    }

    var data = {};
    var _filter_keys = function(list){
        return _.map(list,function(i){return i.property;});
    }

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
        many_to_one_items[many_to_one_items.length-1].last = true
    }
    return {
        empty_many_to_one_items: (many_to_one_items.length == 0),
        data: data,
        many_to_one_items: many_to_one_items
    };
}

RedisMechanism.prototype._convert_relationships_into_its_refs = function(pk, key, index, instance, callback){
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
}

RedisMechanism.prototype._save_with_index = function(key, index, instance, callback){
    var self = this;
    var pk = key + ":" + index;

    self._convert_relationships_into_its_refs(pk, key, index, instance, function (err, data) {
        self.connection.hmset(pk, data, function (err) {
            if (instance._meta.indexes.length > 0) {
                _.each(instance._meta.indexes, function(attr){
                    var value = instance[attr];
                    var key = 'clay:' + instance._meta.name + ':indexes:' + attr + ':' + value;
                    self.connection.zadd(key, parseInt(index), pk, function(err){
                        if ((attr == instance._meta.indexes.last) && (callback)) {
                            callback(err, pk, instance, self, self.connection);
                        }
                    });
                });
            } else if (callback) {
                callback(err, pk, instance, self, self.connection);
            }
        });
    });
}
RedisMechanism.prototype._grant_uniqueness = function(instance, callback){
    var self = this;
    var Model = instance.__model__;
    var error = null;

    _.each(instance._meta.unique_fields, function(field){
        var key = 'clay:' + Model._meta.name + ':indexes:' + field + ':';
        var is_last = (field === _.last(instance._meta.unique_fields));
        self.connection.keys(key + '*', function(err, keys) {
            var problematic = null;
            _.each(keys, function(x) {
                x = x.replace(key, "");
                if (x === instance.__data__[field];});
            });
            if ((!(error)) && (found.length > 0)) {
                error = new Error(
                    'the field ' + instance._meta.name + '.' + field + ' is unique, and got an attempt to save a duplicate "' + instance[field] + '"'
                );
            }
            if (is_last) { callback(error); }
        });
    });

    if (instance._meta.unique_fields.length === 0) {
        return callback(null);
    }
}

RedisMechanism.prototype.persist = function(input, callback){
    var self = this;
    if (!_.isArray(input)) {
        var input = [input];
    }

    _.each(input, function(instance){
        var key = 'clay:' + instance._meta.name + ':id';
        var cb = instance === _.last(input) ? callback : null;
        self._grant_uniqueness(instance, function (err){
            if (err) {if (cb) {return cb(err);};return;}

            if (!instance.__id__) {
                self.connection.incr(key, function(err, index) {
                    self.ids[key] = index;
                    if (err) {return callback(err, pk, instance, self, self.connection)};
                    instance.__data__.__id__ = instance.__id__ = parseInt(index);
                    self._save_with_index(key, index, instance, cb);
                });
            } else {
                self._save_with_index(key, instance.__data__.__id__, instance, cb);
            }
        });
    });
}

RedisMechanism.prototype.find_by_id = function(Model, id, callback){
    var self = this;
    var key = 'clay:' + Model._meta.name + ':id:' + id;
    this.connection.hgetall(key, function(err, data){
        return self._make_model(Model, data, err, callback);
    });
}

RedisMechanism.prototype.delete = function(instance, callback){
    var self = this;
    var wildcard = 'clay:' + instance._meta.name + ':id:' + instance.__id__ + '*';
    self.connection.keys(wildcard, function(err, keys){
        if (err) {return callback(err);}
        self.connection.del(keys, callback);
    });
}

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

            var value = index.replace(key, "");
            var did_not_match = (!(match.exec(value)));

            if (did_not_match) {
                if (in_the_last_index) {
                    var err = null;
                    if (instances.length === 0) {
                        err = new Error('could not find any "' + field + '" matching the regex ' + match.toString());
                    }
                    return callback(err, instances);
                }
                return;
            }

            self.connection.zrange(index, 0, -1, function(e, res) {
                _.each(res, function(pk) {
                    var is_last_pk = (pk === _.last(res));
                    self.connection.hgetall(pk, function(e, data) {
                        instances.push(new Model(data));
                        if (in_the_last_index && is_last_pk) {
                            callback(e, instances);
                        }

                    })
                });

            });
        });
    });
}

RedisMechanism.prototype.find_non_indexed_by_regex_match = function(Model, field, match, callback){
    var self = this;
    var criteria = 'clay:' + Model._meta.name + ':id:*';

    self.connection.keys(criteria, function(err, indexes){
        var instances = [];
        var valid_keys = _.map(indexes, function(key){ var regex = /\d+$/.exec(key); if (regex) {return key;}});
        if (valid_keys.length == 0) {
            return callback(err, valid_keys);
        }

        _.each(valid_keys, function(pk){
            var err = null;
            if (instances.length === 0) {
                err = new Error('could not find any "' + field + '" matching the regex ' + match.toString());
            }

            self.connection.hgetall(pk, function(e, data){
                if (match.exec(data[field])) {
                    instances.push(new Model(data));
                }
                if (pk === _.last(valid_keys)) {
                    callback(e || err, instances);
                }
            });
        });
    });
}
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
}

RedisMechanism.prototype.find_by_regex_match = function(Model, field, match, callback){
    if (_.include(Model._meta.indexes, field)) {
        return this.find_indexed_by_regex_match(Model, field, match, callback);
    } else {
        return this.find_non_indexed_by_regex_match(Model, field, match, callback);
    }
}

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
}

module.exports.RedisMechanism = RedisMechanism;
