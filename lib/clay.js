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

exports.base = require('./clay/base');
var storage = require('./clay/storage');

var events = require('events'),
    crypto = require('crypto'),
      path = require('path'),
      util = require('util'),
         _ = require('underscore')._;

var FieldValidationError = function(message){
    this.message = message;
    Error.call(this);
}
util.inherits(FieldValidationError, Error);

var FieldSpec = function(model_name, owner, parent){
    var self = this;
    parent = parent || {_meta: {field: {}}}

    var _indexes           = _.clone(parent._meta.indexes           || []);
    var _field_names       = _.clone(parent._meta.field.names       || []);
    var _field_definitions = _.clone(parent._meta.field.definitions || {});
    var _class_methods     = _.clone(parent._meta.class_methods     || {});
    var _instance_methods  = _.clone(parent._meta.instance_methods  || {});

    owner._meta = self._registry = {
        name: model_name,
        indexes: _indexes,
        field: {
            names: _field_names,
            definitions: _field_definitions
        },
        storage: storage.primary || new storage.RedisMechanism(),
        class_methods: _class_methods,
        instance_methods: _instance_methods,
        required_fields: [],
        unique_fields: [],
        relationships: {
            has_one: [],
            has_many: []
        }
    };

    self.is_stored_with = function(storage){
        owner._meta.storage = storage;
    };

    self.has = {
        index: function(name) {
            _indexes.push(name);
            self._registry.indexes = _.uniq(_indexes);
        },
        field: function(name, kind) {
            _field_names.push(name);
            _field_definitions[name] = kind;

            owner.prototype.__defineGetter__(name, function(){
                return this.__data__[name];
            });

            owner.prototype.__defineSetter__(name, function(value){
                var newvalue = kind(self._registry.indexes, this, value);
                if ((_.isUndefined(newvalue)) || (_.isNull(newvalue))) {
                    throw new FieldValidationError(['could not process the field ', name,''].join('"'));
                }
                this.__data__[name] = newvalue;
            });
        },
        setter: function(name, callback) {
            owner.prototype.__defineSetter__(name, callback);
        },
        getter: function(name, callback) {
            owner.prototype.__defineGetter__(name, callback);
        },
        one: function(property, model, reverse_name){
            owner._meta.relationships.has_one.push({
                property: property,
                model: model,
                reverse_name: reverse_name
            });

            model._meta.relationships.has_many.push({
                property: reverse_name,
                model: owner,
                reverse_name: property
            });

            owner.prototype.__defineGetter__(property, function(){
                var value = this.__data__[property];
                var instance = new model(value, model);
                instance[reverse_name] = [this];
                return instance;
            });

            owner.prototype.__defineSetter__(property, function(value) {
                if (_.isObject(value._meta)) {
                    this.__data__[property] = value.__data__;
                } else if (_.isString(value)) {
                    try {
                        this.__data__[property] = JSON.parse(value);
                    } catch (e) {
                        this.__data__[property] = null;
                        var msg = [
                            "",
                            value,
                            " is an invalid JSON, so that it can't be set in ",
                            [owner._meta.name, property].join('.'),
                            " instead it should be an object respecting the definition of the ",
                            model._meta.name,
                            " model"
                        ].join("'");
                        throw new Error(msg);
                    }
                } else {
                    this.__data__[property] = value;
                }
            });
        },
        many: function(property, model, reverse_name){
            owner._meta.relationships.has_many.push({
                property: property,
                model: model,
                reverse_name: reverse_name
            });
            model._meta.relationships.has_one.push({
                property: reverse_name,
                model: owner,
                reverse_name: property
            });
            owner.prototype.__defineGetter__(property, function(){
                var self = this;
                var list = this.__data__[property];
                var res = _.map(list, function (x){ var __instance = new model(x, model); __instance[reverse_name] = self; return __instance});
                return res;
            });
            owner.prototype.__defineSetter__(property, function(value){
                if (_.isArray(value)) {
                    this.__data__[property] = _.map(value, function(x){
                        if (_.isObject(x._meta)) {
                            return x.__data__;
                        } else if (_.isString(x)) {
                            try {
                                return JSON.parse(x);
                            } catch (e) {
                                var msg = [
                                    "",
                                    value,
                                    " is an invalid JSON, so that it can't be added to the Array ",
                                    [owner._meta.name, property].join('.'),
                                    " on position " + list.length + ", instead it should be an object respecting the definition of the ",
                                    model._meta.name,
                                    " model"
                                ].join("'");
                                throw new Error(msg);
                            }
                        } else {
                            return x;
                        }
                    });
                } else {
                    this.__data__[property] = value;
                }
            });
        },
        method: function(name, callback){
            self._registry.instance_methods[name] = callback;
        },
        class_method: function(name, callback){
            self._registry.class_methods[name] = callback;
        }
    };

    self.validates = {
        uniquenessOf: function(name) {
            self.has.index(name);
            self._registry.unique_fields.push(name);
            self._registry.unique_fields = _.uniq(self._registry.unique_fields);
        },
        presenceOf: function(name) {
            self._registry.required_fields.push(name);
            self._registry.required_fields = _.uniq(self._registry.required_fields);
        }
    };
};

FieldSpec.prototype.bind_methods_to = function(klass){
    var self = this;
    _.map(self._registry.class_methods, function (value, key, object){
        klass[key] = value;
    });
    _.map(self._registry.instance_methods, function (value, key, object){
        klass.prototype[key] = value;
    });

    klass.prototype.save = function(callback){
        self._meta.storage.persist(this, callback);
    }
}
var validateField = function(regex, value, message) {
    var matched = regex.exec(value);
    if (matched) {
        return matched[0];
    } else {
        throw new exports.FieldValidationError(message);
    }
}

exports.FieldKinds = {
    hashers: {},
    alphanumeric: function(keys, instance, value){
        return validateField(/^\w+$/, value, '"' + value + '" is not a valid alphanumeric');
    },
    numeric: function(keys, instance, value){
        return validateField(/^\d+$/, value, '"' + value + '" is not a valid number');
    },
    email: function(keys, instance, value){
        return validateField(/^\w+[@]\w+[.]\w{2,}$/, value);
    },
    string: function(keys, instance, value){
        return (value + "").trim()
    },
    slug: function(keys, instance, value){
        if ((!_.isUndefined(value)) || (!_.isNull(value))) {
            return (value + "").slugify();
        }
    },
    hashOf: function(involved_keys){
        var index = involved_keys.join('|');
        this.hashers[index] = function(keys, instance, value) {
            var shasum = crypto.createHash('sha1');
            shasum.update(instance._meta.get_key(involved_keys, value));
            return shasum.digest('hex');
        }
        return this.hashers[index];
    }
};

var __declared_models__ = {};

var Model = {
    __base__: function(data) {
        var self = this;
        events.EventEmitter.call(this);
        self.__data__ = {};

        _.each(data, function(value, key, dict){
            if (key === '__id__') {
                self.__id__ = value;
            } else {
                self[key] = value;
            }
        });

        if ((typeof self._meta !== 'undefined') && (self._meta !== null)) {
            _.each(self._meta.required_fields, function(name){
                var __value__ = self[name];

                if ((typeof __value__ === 'undefined') || (__value__ === null)) {
                    throw new FieldValidationError(['the ', name, ' field is required'].join('"'));
                };
            });
        }
        if (_.isFunction(this.initialize)) {
            this.initialize(data);
        }
        return self;
    },
    create: function(data, callback){
        var instance;
        try {
            instance = new this(data);
            return callback.apply(instance, [null, instance]);
        } catch (e) {
            return callback.apply(this, [e, data, this]);
        }
    },
    from_json_string: function(raw, filename){
        var self = this;
        var parsed = JSON.parse(raw);

        var file_id = get_id_from_filename(filename);
        if (!_.isNull(file_id)) {
            if (_.isUndefined(parsed.__id__)) {
                throw new Error(
                    [
                        'when parsing ',
                        filename,
                        ', the internal id is not defined'
                    ].join('"'));

            } else if (_.isNull(parsed.__id__)) {
                throw new Error(
                    [
                        'when parsing ',
                        filename,
                        ', the internal id is null'
                    ].join('"'));
            } else {
                if (parseInt(parsed.__id__) !== file_id) {
                    throw new Error(
                        [
                            'when finding ',
                            self._meta.name,
                            ' by id, the internal id does not match the filename'
                        ].join('"'));
                }
            }
        }
        return new this(parsed, this);
    },
    from_json_buffer: function(buf, filename){
        if ((_.isUndefined(buf)) || (_.isNull(filename))){
            throw new Error('son of a bitch, where is the buffer?');
        }
        return this.from_json_string(buf.toString(), filename);
    },
    from_json: function(string_or_buffer, filename){
        if (_.isString(string_or_buffer)) {
            return this.from_json_string(string_or_buffer, filename);
        } else {
            return this.from_json_buffer(string_or_buffer, filename);
        }
    },
    declare: function (name, spec, parent) {
        var self = Model;
        var Clean = eval("(" + Model.__base__.toString() + ")")
        var NewModel = _.extend(Clean, Model, {_meta: {field: {}}});
        util.inherits(NewModel, events.EventEmitter);
        NewModel.prototype.__defineGetter__('__model__', function(){
            return NewModel;
        });
        NewModel.prototype.toString = function() {
            return [
                this.__model__._meta.name,
                '(', JSON.stringify(self.__data__), ')'
            ].join('');
        };

        var it = new FieldSpec(name, NewModel, parent);
        spec.apply(NewModel, [it, exports.FieldKinds]);
        it.bind_methods_to(NewModel)

        NewModel.prototype.__defineGetter__('_meta', function (){
            var instance = this;
            return _.extend(it._registry, {
                spec: it,
                get_key: function (attributes, value) {
                    var values = _.map(attributes, function(attr){
                        return instance[attr]
                    });
                    values.push(value);
                    return values.join("|sha1-emerald|");
                }
            });
        });

        __declared_models__[name] = NewModel;
        return NewModel;
    },
    subclass: function(name, spec){
        return this.declare(name, spec, this);
    }
}

function get_id_from_filename (filename){
    if ((!_.isUndefined(filename)) && (!_.isNull(filename))) {
        var base = path.basename(filename, '.json');
        var filename_regex = /\d+$/.exec(base);
        return parseInt(filename_regex[0]);
    }
    return null;
}

exports.declare = function(name, spec){
    return Model.declare(name, spec);
};

exports.use = function(name){
    return __declared_models__[name];
};

exports.set_primary_storage = function(custom){
    storage.primary = custom;
};

exports.storage = storage
exports.FieldSpec = FieldSpec;
exports.FieldValidationError = FieldValidationError;