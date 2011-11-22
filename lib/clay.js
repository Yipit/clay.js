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
    }

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
            }
            owner._meta.relationships.o2m[property] = _info
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
            }
            owner._meta.relationships.m2o[property] = _info
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
    _.each(self._registry.class_methods, function (value, key, object){
        klass[key] = value;
    });
    _.each(self._registry.instance_methods, function (value, key, object){
        klass.prototype[key] = value;
    });

    klass.prototype.save = function(callback){
        this._meta.storage.persist(this, callback);
    }
    klass.prototype.delete = function(callback){
        this._meta.storage.delete(this, callback);
    }
    klass.all = function(callback){
        this._meta.storage.fetch_all(klass, callback);
    }

    _.each(self._registry.field.names, function(property){
        var method_name = 'find_by_' + property;
        klass[method_name] = function(match, callback){
            return this._meta.storage.find_by_regex_match(klass, property, match, callback);
        }
    });
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
    auto: function(keys, instance, value){
        return new Date();
    },
    datetime: function(keys, instance, value){
        if (/\d{4}[-]\d{2}[-]\d{2}/.exec(value)) {
            value = Date.parse(value, "y-M-d");
        }
        return new Date(value);
    },
    alphanumeric: function(keys, instance, value){
        return validateField(/^\w+$/, value, '"' + value + '" is not a valid alphanumeric');
    },
    numeric: function(keys, instance, value){
        return parseInt(validateField(/^\d+$/, value, '"' + value + '" is not a valid number'));
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

        if (!data.__id__) {
            self._meta.storage.get_next_id_for('clay:' + self._meta.name + ':id', function(err, id){
                id = parseInt(id);
                self.__id__ = id;
                self.__data__.__id__ = id;
            })
        } else {
            self.__id__ = parseInt(data.__id__);
            self.__data__.__id__ = parseInt(data.__id__);
        }
        _.each(self._meta.field.definitions, function(type, key){
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
    from_json_string: function(raw){
        var self = this;
        var parsed = JSON.parse(raw);

        return new this(parsed);
    },
    from_json_buffer: function(buf){
        return this.from_json_string(buf.toString());
    },
    from_json: function(string_or_buffer){
        if (_.isString(string_or_buffer)) {
            return this.from_json_string(string_or_buffer);
        } else {
            return this.from_json_buffer(string_or_buffer);
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
        if (_.isFunction(spec)) {
                spec.apply(NewModel, [it, exports.FieldKinds]);
        }

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
                    return values.join("|sha1-clay|");
                }
            });
        });

        __declared_models__[name] = NewModel;
        return NewModel;
    },
    subclass: function(name, spec){
        return this.declare(name, spec, this);
    },
    find_by_id: function(id, callback){
        this._meta.storage.find_by_id(this, id, callback);
    }
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

