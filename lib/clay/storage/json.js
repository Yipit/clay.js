var  _  = require('underscore')._,
path    = require('path'),
glob    = require('glob'),
events    = require('events'),
fs      = require('fs');

var mkdir_p = require("mkdirp").mkdirp;
var isfalsy = function(what) {return ((_.isUndefined(what)) || (_.isNull(what)));};
var istruthy = function(what) {return ((!_.isUndefined(what)) && (!_.isNull(what)));};

var QUERY_PHASES = {
    PREPARING: 0,
    FETCHING: 1
};

var JSONStore = function(folder, options){
    var defaults = {
        encoder: JSON.stringify,
        decoder: JSON.parse
    };
    options = _.isObject(options) ? _.extend(options, defaults) : defaults;
    this.folder = path.resolve(folder);
    this.query_stack = [];
};

JSONStore.setup = function(folder, callback){
    var store = new this(folder);
    process.nextTick(function (e) {
        store.prepare_environment(callback);
    });
};

JSONStore.prototype.toString = function(){
    return 'JSONStore(path="'+this.folder+'")';
};

JSONStore.prototype.prepare_environment = function(callback){
    var self = this;
    var index_filename = path.join(self.folder, 'indexes.json');

    var pathes = _.compact(self.folder.split("/"));

    mkdir_p(self.folder, 0755, function(folder_creation_error) {
        if (folder_creation_error) {
            callback.apply(self, [folder_creation_error]);
        }
        fs.open(index_filename, 'a+', function(indexes_creation_error, fd){
            fs.write(fd, '{"worked":true}');
            fs.close(fd);
            callback.apply(self, [indexes_creation_error, self]);
        });
    });
};

JSONStore.prototype.path_for_model = function(M){
    var name = M._meta.name;
    return path.join(this.folder, name);
};

JSONStore.prototype.prepare_folder = function(folder, callback){
    var self = this;
    var exception = null;
    var index_filename = path.join(folder, 'indexes.json');
    var index = {'indexes':{}};

    mkdir_p(folder, 0755, function(err){
        exception = err;
        fs.exists(index_filename, function (exists){
            if (exists) {
                fs.readFile(index_filename, function (err, read){
                    if (err) {
                        fs.unlink(index_filename, function(err){
                            if (!err) {
                                self.prepare_folder(folder, callback);
                            }
                        });
                    } else {
                        callback(err, index, index_filename);
                    }
                });
            } else {
                fs.writeFile(index_filename, JSON.stringify(index), function(err){
                    callback(err, index, index_filename);
                });
            }
        });
    });
};

JSONStore.prototype._save_instance_and_index = function(instance, data_filename, data, callback) {
    var index_filename = path.join(this.folder, instance._meta.name, 'indexes.json');
    fs.readFile(index_filename, function (err, _index_buf){
        var index;
        try {
            index = JSON.parse(_index_buf.toString());
        } catch(e) {
            index = {indexes: {}};
        }

        _.each(instance._meta.indexes, function(name){
            var value_to_be_indexed = instance[name];
            if (_.isUndefined(index.indexes[name])) {
                index.indexes[name] = {};
            }
            if (_.isUndefined(index.indexes[name][value_to_be_indexed])) {
                index.indexes[name][value_to_be_indexed] = [];
            }
            index.indexes[name][value_to_be_indexed].push(data_filename);
        });

        fs.writeFile(index_filename, JSON.stringify(index), function (err){
            fs.writeFile(data_filename, JSON.stringify(data), 'utf-8', function(err){
                callback(err, data_filename, data, index_filename, index);
            });
        });

    });
};

JSONStore.prototype.persist = function(instances, callback) {
    var self = this;
    if (!_.isArray(instances)) {
        var _single_ = instances;
        instances = [_single_];
    }
    var _length = instances.length,
    _count = 0;

    var final_callback = function(err, data_filename, data, index_filename, index){
        if (_count === _length) {
            callback(err, data_filename, data, index_filename, index);
        }
    };

    _.each(instances, function(instance){
        var name = instance.__model__._meta.name;
        var folder = self.path_for_model(instance.__model__);
        self.prepare_folder(folder, function(err, index, index_filename){
            glob.glob(path.join(folder, 'instance.*.json'), function(err, matches){
                var new_id = instance.__id__ || matches.length || 1;

                var fullname = path.join(folder, ['instance', new_id, 'json'].join('.'));
                var almost_data = _.extend(instance.__data__, {__id__: new_id});

                fs.exists(fullname, function(already_exists){
                    _count++;
                    if (already_exists) {
                        fs.readFile(fullname, function(err, read){
                            var d = _.extend(JSON.parse(read), almost_data);
                            self._save_instance_and_index(instance, fullname, d, callback);
                        });
                    } else {
                        self._save_instance_and_index(instance, fullname, almost_data, callback);
                    }
                });
            });
        });
    });
};

JSONStore.prototype.find_by_id = function(Model, id, callback){
    var self = this;
    var name = Model._meta.name;
    var folder = self.path_for_model(Model);
    var fullname = path.join(folder, ['instance', id, 'json'].join('.'));

    fs.readFile(fullname, function(e, read){
        var instance = null,
           exception = e;

        if ((istruthy(e)) && (!_.isNull((/No such file/i).exec(e.message)))) {
            var _message_ = ['could not find the ', name, ' with id ', id, ''].join('"');
            exception = new Error(_message_);
            callback.apply(self, [exception, instance]);
            return;
        }

        try {
            instance = Model.from_json(read, fullname);
        } catch (e) {
            exception = e;
        }
        callback.apply(self, [exception, instance]);
    });
};

JSONStore.prototype.find = function(Model){
    var self = this;
    self.last_query = {
        model: Model,
        indexed: false,
        phase: QUERY_PHASES.PREPARING
    };
    self.query_stack.push(self.last_query);
    return new LazyFetcher(this, self.last_query);
};

var LazyFetcher = function(store, query){
    var self = this;
    self.store = store;
    self.query = query;
    _.each(self.query.model._meta.field.names, function (field_name) {
        var method_name = 'matching_' + field_name.methodify();
        self[method_name] = function(regex, callback){
            return self._fetch_by_regex(method_name, regex, callback);
        };
    });
};

LazyFetcher.prototype._fetch_by_regex = function(_field, regex, callback){
    var self = this;
    return this._fetch_by_regex_in_indexed_field(_field, regex, function(exception_1, results_1){
        if ((results_1.length === 0) && (istruthy(exception_1))) {
            this._fetch_by_regex_in_nonindexed_field(_field, regex, callback);
        } else {
            callback(exception_1, results_1);
        }
    });
};

LazyFetcher.prototype._fetch_by_regex_in_nonindexed_field = function(_field, regex, callback){
    console.log(_field);
    callback();
};

LazyFetcher.prototype._fetch_by_regex_in_indexed_field = function(_field, regex, callback){
    var self = this;

    var Model = self.query.model;
    var field = _.last(_field.split('_'));
    var promise = new events.EventEmitter();

    var folder = self.store.path_for_model(Model);
    var index_path = path.join(folder, 'indexes.json');
    var model_name = Model._meta.name;

    fs.readFile(index_path, function(e, read){
        var exception = null;
        var index = JSON.parse(read);
        var indexes_for_field = index.indexes[field];
        var results = [];

        if (_.isUndefined(indexes_for_field)) {
            var field_name = [model_name, field].join('.'),
            _msg_ = ["the field ", field_name, " is not indexed"].join('"');
            exception = new Error(_msg_);
            callback.apply(self.store, [exception, results]);
            return;
        }

        var _count = 0;
        var _length = 0;

        var has_finished_loading = function (){ return _count === _length; };

        _.each(indexes_for_field, function(paths_to_entities, value) {
            _length += paths_to_entities.length;
            if (regex.test(value)) {
                _.each(paths_to_entities, function(json_path){
                    _count ++;
                    fs.readFile(json_path, function(e, json){
                        if (istruthy(e)) {
                            callback.apply(self.store, [e, results]);
                        }
                        var item = Model.from_json(json);
                        promise.emit('result', item);
                        results.push(item);

                        if (has_finished_loading()) { /*is the last element*/
                            callback.apply(self.store, [exception, results]);
                        }
                    });
                });
            }
        });
    });

    return promise;
};

exports.Store = JSONStore;
