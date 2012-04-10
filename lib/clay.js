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
};

util.inherits(FieldValidationError, Error);

var FieldSpec = function(model_name, owner, parent){
    var self = this;
    parent = parent || {_meta: {field: {}}};

    var _indexes           = _.clone(parent._meta.indexes           || []);
    var _field_names       = _.clone(parent._meta.field.names       || []);
    var _field_definitions = _.clone(parent._meta.field.definitions || {});
    var _class_methods     = _.clone(parent._meta.class_methods     || {});
    var _instance_methods  = _.clone(parent._meta.instance_methods  || {});

    owner._spec = this;
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
            has_many: [],
            o2m: {},
            m2o: {}
        }
    };

    self.is_stored_with = function(storage){
        owner._meta.storage = storage;
    };

    var validate_fieldish_name = function(name, kind){
        var m = 'The declaration of the model "{name}" specifies {kind} with a bad name: "{field}". In those cases use just numbers, letters and underscore';
        if (!/^[\w_]+$/.test(name)) {
            throw new FieldValidationError(m.render({name: model_name, field: name, kind: kind}));
        }
    };

    self.has = {
        index: function(name) {
            validate_fieldish_name(name, 'an index');
            _indexes.push(name);
            self._registry.indexes = _.uniq(_indexes);
        },
        field: function(name, kind) {
            validate_fieldish_name(name, 'a field');
            _field_names.push(name);
            _field_definitions[name] = kind;

            owner.prototype.__defineGetter__(name, function(){
                var val = this.__data__[name];
                if (kind === exports.FieldKinds.auto) {return new Date(val);}
                if (!val) { return val;}
                var hashers = _.values(exports.FieldKinds);

                if (_.include(hashers, kind)) {
                    val = kind(self._registry.indexes, this, val);
                }
                return val;
            });

            owner.prototype.__defineSetter__(name, function(value){
                var newvalue = kind(self._registry.indexes, this, value);
                if ((_.isUndefined(newvalue)) || (_.isNull(newvalue))) {
                    throw new FieldValidationError(['could not process the field ', name,''].join('"'));
                }
                if (newvalue instanceof Date) {
                    newvalue = newvalue.toString();
                }
                this.__data__[name] = newvalue;
            });
        },
        setter: function(name, callback) {
            validate_fieldish_name(name, 'a setter');
            owner.prototype.__defineSetter__(name, callback);
        },
        getter: function(name, callback) {
            validate_fieldish_name(name, 'a getter');
            owner.prototype.__defineGetter__(name, callback);
        },
        one: function(property, model, reverse_name){
            /* skipping relationships already declared */
            if (!_.isUndefined(owner._meta.relationships.o2m[property])) {return;}

            validate_fieldish_name(property, 'a relationship');
            var _info = {
                property: property,
                model: model,
                reverse_name: reverse_name
            };
            owner._meta.relationships.o2m[property] = _info;
            owner._meta.relationships.has_one.push(_info);
            model._spec.has.many(reverse_name, owner, property);

            owner.prototype.__defineGetter__(property, function(){
                var res = new model(this.__data__[property]);
                return res;
            });

            owner.prototype.__defineSetter__(property, function(value) {
                if (value._meta) {
                    this.__data__[property] = value.__data__;
                    if (!_.isArray(value.__data__[reverse_name])) {
                        value.__data__[reverse_name] = [];
                    }
                    value.__data__[reverse_name].add(this.__data__);
                } else {
                    this.__data__[property] = value;
                }
            });
        },
        many: function(property, model, reverse_name){
            /* skipping relationships already declared */
            if (!_.isUndefined(owner._meta.relationships.m2o[property])) {return;}

            validate_fieldish_name(property, 'a relationship');
            var _info = {
                property: property,
                model: model,
                reverse_name: reverse_name
            };
            owner._meta.relationships.m2o[property] = _info;
            owner._meta.relationships.has_many.push(_info);
            model._spec.has.one(reverse_name, owner, property);

            owner.prototype.__defineGetter__(property, function(){
                var res = _.map(_.filter(this.__data__[property], _.identity), function(data){ return new model(data);});
                return res;
            });
            owner.prototype.__defineSetter__(property, function(value){
                var self = this;

                this.__data__[property] = _.map(value, function(x){
                    var reverse_id = (x.__id__ || (x.__data__ && x.__data__.__id__));
                    var reverse_object = x;

                    if (!reverse_id) {
                        /* the object has no id, let's pick one */
                        reverse_object = new model(x.__data__);
                    }
                    reverse_object[reverse_name] = self;
                    return reverse_name.__data__ || reverse_object;
                });
            });

        },
        method: function(name, callback){
            validate_fieldish_name(name, 'a method');
            self._registry.instance_methods[name] = callback;
        },
        class_method: function(name, callback){
            validate_fieldish_name(name, 'a class method');
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
    _.each(self._registry.class_methods, function (value, key, object) {
        klass[key] = value;
    });

    _.each(self._registry.instance_methods, function (value, key, object) {
        klass.prototype[key] = value;
    });

    klass.prototype.save = function(callback){
        this._meta.storage.persist(this, function(err, pks, instances, store, connection){
            return callback(
                err,
                _.isArray(pks) ? pks[0] : pks,
                _.isArray(instances) ? instances[0] : instances,
                store,
                connection
            );
        });
    };
    klass.prototype.erase = function(callback){
        this._meta.storage.erase(this, callback);
    };
    klass.all = function(callback){
        this._meta.storage.fetch_all(klass, callback);
    };
    klass.prototype.sync = function(callback){
        this._meta.storage.sync(this, callback);
    };

    _.each(self._registry.field.names, function(property){
        _.each(['find', 'get'], function(prefix){
            var method_name = [prefix, property].join('_by_');
            klass[method_name] = function(match, callback){
                var callable = this._meta.storage[prefix + '_by_regex_match'];
                return callable.apply(klass._meta.storage, [klass, property, match, callback]);
            };
        });
    });
};

var validateField = function(regex, value, message) {
    var matched = regex.exec(value);
    if (matched) {
        return matched[0];
    } else {
        throw new exports.FieldValidationError(message);
    }
};

exports.FieldKinds = {
    hashers: {},
    auto: function(keys, instance, value){
        return (new Date()).getTime();
    },
    datetime: function(keys, instance, value){
        if (/\d{4}[\-]\d{2}[\-]\d{2}/.exec(value)) {
            value = Date.parse(value, "y-M-d");
        }
        return new Date(value);
    },
    alphanumeric: function(keys, instance, value){
        return validateField(/^\w+$/, value, '"' + value + '" is not a valid alphanumeric');
    },
    numeric: function(keys, instance, value){
        return parseInt(validateField(/^\d+$/, value, '"' + value + '" is not a valid number'), 10);
    },
    email: function(keys, instance, value){
        return validateField(/^\w+[@]\w+[.]\w{2,}$/, value);
    },
    string: function(keys, instance, value){
        return (value + "").trim();
    },
    slug: function(keys, instance, value) {
        if ((!_.isUndefined(value)) || (!_.isNull(value))) {
            return (value + "").slugify();
        }
        return null;
    }
};

var __declared_models__ = {};

function Model(data) {
    events.EventEmitter.call(this);

    var meta = this._meta;
    var self = this;
    self.__data__ = {};

    if (data && data.__id__) {
        self.__id__ = parseInt(data.__id__, 10);
        self.__data__.__id__ = parseInt(data.__id__, 10);
    }

    _.each(meta.field.definitions, function(type, key){
        if (type === exports.FieldKinds.auto) {
            self[key] = type();
        }
    });

    _.each(data, function(value, key, dict){
        if (key === '__id__') {
            self.__id__ = value;
        }
        self[key] = value;
    });

    if ((typeof meta !== 'undefined') && (meta !== null)) {
        _.each(meta.required_fields, function(name){
            var __value__ = self[name];

            if ((typeof __value__ === 'undefined') || (__value__ === null)) {
                throw new FieldValidationError(['the ', name, ' field is required'].join('"'));
            }
        });
    }
    if (_.isFunction(this.initialize)) {
        this.initialize(data);
    }
}

util.inherits(Model, events.EventEmitter);


Model.prototype = {
    toString: function() {
        return [
            this.__model__._meta.name,
            '(', JSON.stringify(this.__data__), ')'
        ].join('');
    }
};


Model.class_methods = {
    from_json_string: function(raw) {
        var self = this;
        var parsed = JSON.parse(raw);
        return new this(parsed);
    },

    from_json_buffer: function(buf) {
        return this.from_json_string(buf.toString());
    },

    from_json: function(string_or_buffer) {
        if (_.isString(string_or_buffer)) {
            return this.from_json_string(string_or_buffer);
        } else {
            return this.from_json_buffer(string_or_buffer);
        }
    },

    find_by_id: function(id, callback) {
        this._meta.storage.find_by_id(this, id, callback);
    },

    get_by_id: function(id, callback) {
        this._meta.storage.find_by_id(this, id, callback);
    },

    subclass: function(name, spec) {
        return Model.declare(name, spec, this);
    },

    create: function(data, callback) {
        var instance;
        try {
            instance = new this(data);
            return instance.save(callback);
        } catch (e) {
            return callback.apply(this, [e, data]);
        }
    },

    declare: function (name, spec, parent) {
        var NewModel = function (data) {
            Model.call(this, data);
        };

        util.inherits(NewModel, Model);
        NewModel = _.extend(NewModel, Model.class_methods);
        NewModel.__name__ = name;

        var it = new FieldSpec(name, NewModel, parent);

        NewModel.prototype.__defineGetter__('__model__', function() {
            return NewModel;
        });

        NewModel.prototype.__defineGetter__('__name__', function() {
            return this.__model__.__name__;
        });

        NewModel.prototype.__defineGetter__('_meta', function() {
            return NewModel._meta;
        });

        if (_.isFunction(spec)) {
            spec.apply(NewModel, [it, exports.FieldKinds]);
        }

        it.bind_methods_to(NewModel);

        __declared_models__[name] = NewModel;
        return NewModel;
    }
};

Model = _.extend(Model, Model.class_methods);

exports.declare = function(name, spec){
    return Model.declare(name, spec);
};

exports.use = function(name){
    return __declared_models__[name];
};

exports.set_primary_storage = function(custom){
    storage.primary = custom;
};

exports.storage = storage;
exports.FieldSpec = FieldSpec;
exports.FieldValidationError = FieldValidationError;

