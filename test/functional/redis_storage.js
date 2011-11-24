var vows = require('vows')
, should = require('should')
, fs = require('fs')
, events = require('events')
, _ = require('underscore')._
, path = require('path')
, redis = require('redis');

var client = redis.createClient();

var models = require('clay');
var redis_storage = new models.storage.RedisMechanism(client);

var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("password", kind.hashOf(["name", "email"]));

    it.has.method('greet', function() {
        return [
            "Hello, my name is ", this.name, ", it's nice to meet you"
        ].join('');
    });
    it.validates.uniquenessOf("name");
    it.has.index('email');
    it.is_stored_with(redis_storage);
});

var Build = models.declare("Build", function(it, kind){
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.has.field("started_at", kind.auto);
    it.has.field("finished_at", kind.datetime);
    it.has.one("author", User, "builds");
    it.is_stored_with(redis_storage);
});
var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("build_command", kind.string);

    it.has.many("builds", Build, "instruction");
    it.has.one("owner", User, "created_instructions");
    it.is_stored_with(redis_storage);
});

function clear_redis(callback) {
    var topic = this;

    client.keys('clay*', function (err, keys){
        if (keys.length > 0) {
            _.each(keys, function(key){
                client.del(key, function(){
                    if (keys.last == key) {
                        callback.apply(topic);
                    }
                });
            });
        } else {
            callback.apply(topic);
        }
    });
}

vows.describe('Redis Storage Mechanism').addBatch({
    'by calling *store.persist(instance, callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                redis_storage.persist(zach, function(err, key, zach, store, connection){
                    client.hgetall("clay:User:id:1", function(err, data){
                        topic.callback(err, key, zach, store, connection, data);
                    });
                });
            });
        },
        'it increments the index': function(err, key, zach, store, connection, data){
            key.should.equal('clay:User:id:1')
            data.should.eql({
                __id__: '1',
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
            });
            zach.__data__.should.eql({
                __id__: 1,
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
            });
        }
    },
    'by calling *instance.save(callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function(){
                var now = new Date().toUTCString();
                Build.create({
                    status: 0,
                    error: '',
                    output: 'Worked!'
                }, function(err, key, b1, store, connection){
                    client.hgetall("clay:Build:id:1", function(err, data){
                        topic.callback(err, key, b1, store, connection, data, now);
                    });
                });
            });
        },
        'it increments the index': function(err, key, b1, store, connection, data, now) {
            key.should.equal('clay:Build:id:1')
            data.should.eql({
                __id__: '1',
                status: '0',
                error: '',
                output: 'Worked!',
                started_at: now
            });

            b1.__data__.should.eql({
                __id__: 1,
                status: 0,
                error: '',
                output: 'Worked!',
                started_at: now
            });
        },
        'changing an already saved instance just update the values': {
            topic : function(){
                var topic = this;

                clear_redis(function(){
                    User.create({
                        name: 'Benedict',
                        email: 'ben@yipit.com',
                        password: 'this is ben'
                    }, function(e, key1, u1){
                        should.ifError(e)
                        u1.name = 'Ben Plesser'
                        u1.save(function(e, key2){
                            topic.callback(null, key1, key2);
                        });

                    });
                });
            },
            'so that it keeps the key': function(e, key1, key2) {
                key1.should.eql(key2);
            }
        },
        'it is indexed': {
            topic : function(){
                var topic = this;
                var u1 = new User({
                    name: 'Adam Nelson',
                    email: 'coders@yipit.com',
                    password: 'got you a gift'
                });
                var u2 = new User({
                    name: 'Steve Pulec',
                    email: 'coders@yipit.com',
                    password: 'xpath master'
                });
                u1.save(function(e, key1){
                    u2.save(function(e, key2){
                        client.zrange("clay:User:indexes:email:coders@yipit.com", 0, -1, function(err, pks){
                            topic.callback(err, pks, key1, key2);
                        });
                    });
                });
            },
            'in a sorted set': function(e, pks, key1, key2) {
                pks.should.eql([key1, key2]);
            }
        }
    },
    'store.persist([instance1, instance2], callback) stores an array of instances': {
        topic: function() {
            var topic = this;

            clear_redis(function(){
                var nitya = new User({
                    name: 'Nitya Oberoi 2',
                    email: 'nitya@yipit.com',
                    password: 'hackoutloud'
                });
                var henri = new User({
                    name: 'Henri Xie 2',
                    email: 'henri@yipit.com',
                    password: 'switzerland'
                });
                var nitya_and_henri = [nitya, henri];

                redis_storage.persist(nitya_and_henri, function(err1, key, zach, store, connection){
                    var items = [];
                    _.each(nitya_and_henri, function(item){
                        client.hgetall("clay:User:id:" + item.__id__, function(err, data){
                            items.push(data);
                            if (items.length == 2) {
                                topic.callback(err1, items);
                            }
                        });
                    });
                });
            });
        },
        'it is stored properly': function(err, items){
            should.ifError(err);
            items.should.eql([
                {
                    __id__: '2',
                    name: 'Nitya Oberoi 2',
                    email: 'nitya@yipit.com',
                    password: '1842f3c223d89346d65f89d68f4f09189dcfe515'
                },
                {
                    __id__: '3',
                    name: 'Henri Xie 2',
                    email: 'henri@yipit.com',
                    password: 'ab2473ebd3ad20c0692f4440667c8c5b93f35db0'
                }
            ]);
        },
    },
    'by calling *instance.delete(callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function() {
                var build = new Build({
                    status: 0,
                    error: '',
                    output: 'Worked!'
                });

                build.save(function(err, key, b1, store, connection) {
                    b1.delete(function(err){
                        client.hgetall("clay:Build:id:" + b1.__id__, function(err, data){
                            topic.callback(err, data, b1.__data__);
                        });
                    });
                });
            });
        },
        'HGETALL clay:Build:id:1 gets empty': function(err, empty, full) {
            empty.should.be.eql({});
            full.should.be.eql({
                __id__: 2,
                status: 0,
                error: '',
                output: 'Worked!'
            });
            empty.should.not.be.eql(full);
        },
    },
    'by calling *instance.delete(callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function() {
                var build = new Build({
                    __id__: 66,
                    status: 0,
                    error: '',
                    output: 'Worked!'
                });

                build.save(function(err, key, b1, store, connection) {
                    b1.delete(function(err){
                        Build.find_by_id(66, function(err, b66){
                            topic.callback(err, b66);
                        });
                    });
                });
            });
        },
        'finding by id returns null': function(err, build) {
            build.should.not.be.equal(null);
        },
    }
}).addBatch({
    'by calling *store.persist(instance, callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                redis_storage.persist(zach, function(err, key, zach, store, connection){
                    client.hgetall(key, function(err, data){
                        topic.callback(err, key, zach, store, connection, data);
                    });
                });
            });
        },
        'it increments the index': function(err, key, zach, store, connection, data){
            should.deepEqual(data, {
                __id__: /\d+$/.exec(key)[0],
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
            });
            should.deepEqual(zach.__data__, {
                __id__: parseInt(/\d+$/.exec(key)[0]),
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
            });
        }
    }
}).addBatch({
    'find by id through class method on model': {
        topic: function(store, folder){
            var topic = this;
            var zach = new User({
                __id__: 1,
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: 'cheezNwine'
            });
            zach.save(function(){
                User.find_by_id(1, function(err, instance){
                    topic.callback(err, instance);
                });
            });
        },
        'instance.__id__ is in place': function(e, instance){
            instance.__id__.should.equal('1');
        },
        'instance.__model__ is in place': function(e, instance){
            instance.__model__.should.eql(User);
        },
        'instance.__data__ is also in place': function(e, instance){
            should.deepEqual(instance.__data__, {
                __id__: 1,
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: '2a30552503297ba3def8e3ac4a3471db109af763'
            });
        },
        'the data is also working through the getter': function(e, instance){
            should.equal(instance.name, 'Zach Smith')
        }
    }
}).addBatch({
    'find by indexed field through storage mechanism': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                var steve = new User({
                    name: 'Steve Pulec',
                    email: 'steve@yipit.com',
                    password: 'steeeeve'
                });

                redis_storage.persist([zach, steve], function(err, key, zach, store, connection){
                    redis_storage.find_by_regex_match(User, 'email', /.*[@]yipit.com$/, function(err, found) {
                        topic.callback(err, found);
                    });
                });
            });
        },
        'found 2 items': function(e, found){
            should.exist(found);
            found.should.have.length(2)
        },
        'they are models': function(e, found){
            found[0].should.be.an.instanceof(User);
            found[1].should.be.an.instanceof(User);

            should.equal(found[0].name, 'Zach Smith');
            should.equal(found[1].name, 'Steve Pulec');
        }
    }
}).addBatch({
    'find by indexed field, returning empty set': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                redis_storage.find_indexed_by_regex_match(User, 'email', /^gnu$/, function(err, found) {
                    topic.callback(err, found);
                });
            });
        },
        'found 0 items': function(e, found){
            should.exist(found);
            found.should.have.length(0)
        }
    }
}).addBatch({
    'find by non-indexed field, returning empty set': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                redis_storage.find_non_indexed_by_regex_match(User, 'email', /^gnu$/, function(err, found) {
                    topic.callback(err, found);
                });
            });
        },
        'found 0 items': function(e, found){
            should.exist(found);
            found.should.have.length(0)
        }
    }
}).addBatch({
    'find by indexed field through model': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                var steve = new User({
                    name: 'Steve Pulec',
                    email: 'steve@yipit.com',
                    password: 'steeeeve'
                });

                redis_storage.persist([zach, steve], function(err, key, zach, store, connection){
                    User.find_by_email(/.*[@]yipit.com$/, function(err, found) {
                        topic.callback(err, found);
                    });
                });
            });
        },
        'found 2 items': function(e, found){
            should.exist(found);
            found.should.have.length(2)
        },
        'they are models': function(e, found){
            found[0].should.be.an.instanceof(User);
            found[1].should.be.an.instanceof(User);

            should.equal(found[0].name, 'Zach Smith');
            should.equal(found[1].name, 'Steve Pulec');
        }
    }
}).addBatch({
    'find by indexed field through model when does not exist': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                var steve = new User({
                    name: 'Steve Pulec',
                    email: 'steve@yipit.com',
                    password: 'steeeeve'
                });

                redis_storage.persist([zach, steve], function(err, key, zach, store, connection){
                    User.find_by_email(/foo@gnu.org/, function(err, found) {
                        topic.callback(null, err, found);
                    });
                });
            });
        },
        'it is empty': function(e, err, items){
            should.exist(items);
            items.should.be.an.instanceof(Array)
            items.should.be.empty;
        },
        'the error says it was not found': function(e, err){
            should.exist(err);
            err.message.should.equal('could not find any "email" matching the regex /foo@gnu.org/');
        }
    }
}).addBatch({
    'find by non-indexed field through model when does not exist': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var zach = new User({
                    name: 'Zach Smith',
                    email: 'zach@yipit.com',
                    password: 'cheezNwine'
                });
                var steve = new User({
                    name: 'Steve Pulec',
                    email: 'steve@yipit.com',
                    password: 'steeeeve'
                });

                redis_storage.persist([zach, steve], function(err, key, zach, store, connection){
                    User.find_by_password(/^aaaa$/, function(err, found) {
                        topic.callback(null, err, found);
                    });
                });
            });
        },
        'it is empty': function(e, err, items){
            should.exist(items);
            items.should.be.an.instanceof(Array)
            items.should.be.empty;
        },
        'the error says it was not found': function(e, err){
            should.exist(err);
            err.message.should.equal('could not find any "password" matching the regex /^aaaa$/');
        }
    }
}).addBatch({
    'attempt to save with duplicate value in an unique field': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var zach1 = new User({
                    name: 'Zach'
                });
                var zach2 = new User({
                    name: 'Zach'
                });

                redis_storage.persist([zach1, zach2], function(err){
                    topic.callback(null, err);
                });
            });
        },
        'should have an error with a nice, meaningful message': function(e, err){
            should.exist(err);
            err.message.should.equal('the field User.name is unique, and got an attempt to save a duplicate "Zach"');
        }
    }
}).addBatch({
    'find by non-indexed field through storage mechanism': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var lettuce_unit = new BuildInstruction({
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit'
                });
                var lettuce_functional = new BuildInstruction({
                    name: "Lettuce Functional Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make functional'
                });

                redis_storage.persist([lettuce_unit, lettuce_functional], function(){
                    redis_storage.find_non_indexed_by_regex_match(BuildInstruction, 'name', /unit/i, function(err, found) {
                        topic.callback(err, found);
                    });

                });
            });
        },
        'found 2 items': function(e, found){
            should.exist(found);
            found.should.have.length(1)
        },
        'they are models': function(e, found){
            found[0].should.be.an.instanceof(BuildInstruction);
            found[0].name.should.equal('Lettuce Unit Tests');
        }
    }
}).addBatch({
    'find by non-indexed field through model': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var lettuce_unit = new BuildInstruction({
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit'
                });
                var lettuce_functional = new BuildInstruction({
                    name: "Lettuce Functional Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make functional'
                });

                redis_storage.persist([lettuce_unit, lettuce_functional], function(){
                    BuildInstruction.find_by_name(/unit/i, function(err, found) {
                        topic.callback(err, found);
                    });

                });
            });
        },
        'found 1 items': function(e, found){
            should.exist(found);
            found.should.have.length(1)
        },
        'they are models': function(e, found){
            found[0].should.be.an.instanceof(BuildInstruction);
            found[0].name.should.equal('Lettuce Unit Tests');
        }
    }
}).addBatch({
    'Model.all returns all instances': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var lettuce_unit = new BuildInstruction({
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit'
                });
                var lettuce_functional = new BuildInstruction({
                    name: "Lettuce Functional Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make functional'
                });
                lettuce_unit.save(function(){
                    lettuce_functional.save(function(){
                        BuildInstruction.all(topic.callback);
                    });
                });
            });
        },
        'found 2 items': function(e, found){
            should.exist(found);
            found.should.have.length(2)
        },
        'they are models': function(e, found){
            should.ifError(e);
            should.exist(found);
            found.should.have.length(2);
            found[0].should.be.an.instanceof(BuildInstruction);
            found[1].should.be.an.instanceof(BuildInstruction);

            found[0].name.should.equal('Lettuce Unit Tests');
            found[1].name.should.equal('Lettuce Functional Tests');
        }
    }
}).addBatch({
    'saving models with one-to-many relationships': {
        topic: function(){
            var topic = this;
            clear_redis(function(){
                var gabrielfalcao = new User({
                    name: 'Gabriel Falcão',
                    email: 'gabriel@yipit.com',
                    password: '123',
                    __id__: 1
                });

                var lettuce_unit = new BuildInstruction({
                    __id__: 1,
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit',
                    owner: gabrielfalcao
                });

                gabrielfalcao.save(function(e1, gabrielfalcao){
                    lettuce_unit.save(function(e2, lettuce_unit){
                        client.hget(lettuce_unit, 'owner', function(e, value){
                            topic.callback(e, value, lettuce_unit, gabrielfalcao);
                        });
                    });
                });
            });
        },
        'it gets stored in redis as a simple key-value': function(e, value, instruction, user){
            instruction.should.equal('clay:BuildInstruction:id:1');
            user.should.equal('clay:User:id:1');

            should.exist(value);
            value.should.equal(user);
        }
    }
}).addBatch({
    'saving models with many-to-one relationships': {
        topic: function(){
            var topic = this;
            clear_redis(function() {
                var gabrielfalcao = new Build({
                    name: 'Gabriel Falcão',
                    email: 'gabriel@yipit.com',
                    password: '123'
                });
                var b1 = new Build({
                    status: 0,
                    error: '',
                    output: 'Worked!',
                    author: gabrielfalcao
                });
                var b2 = new Build({
                    status: 32,
                    error: 'Failed!',
                    output: 'OOps',
                    author: gabrielfalcao
                });

                var lettuce_unit = new BuildInstruction({
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit',
                    owner: gabrielfalcao,
                    builds: [b1, b2]
                });

                gabrielfalcao.save(function(e1, gabrielfalcao){
                    b1.save(function(e2, b1){
                        b2.save(function(e3, b2){
                            lettuce_unit.save(function(e4, lettuce_unit){
                                client.zrevrange(lettuce_unit + ':builds', 0, -1, function(e5, items){
                                    topic.callback(e5 || e4 || e3 || e2 || e1, items, lettuce_unit, b1, b2, gabrielfalcao);
                                });
                            });
                        });
                    });
                });
            });
        },
        'it gets stored in redis as a simple key-value': function(e, items, instruction, b1, b2, user){
            should.exist(items);

            items.should.have.length(2)

            items[0].should.equal(b2)
            items[1].should.equal(b1)
        }
    }
}).addBatch({
    'storage.sync(instance, callback) fetches the immediate relationships': {
        topic: function(){
            var topic = this;
            clear_redis(function() {
                var gabrielfalcao = new User({
                    __id__: 1,
                    name: 'Gabriel Falcão',
                    email: 'gabriel@yipit.com',
                    password: '123'
                });
                var b1 = new Build({
                    __id__: 1,
                    status: 0,
                    error: '',
                    output: 'Worked!',
                    author: gabrielfalcao
                });
                var b2 = new Build({
                    __id__: 2,
                    status: 32,
                    error: 'Failed!',
                    output: 'OOps',
                    author: gabrielfalcao
                });

                var lettuce_unit = new BuildInstruction({
                    __id__: 1,
                    name: "Lettuce Unit Tests",
                    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
                    build_command: 'make unit',
                    owner: gabrielfalcao,
                    builds: [b1, b2]
                });

                gabrielfalcao.save(function(e1, pk1, user) {
                    b1.save(function(e2, pk2, b1) {
                        b2.save(function(e3, pk3, b2) {
                            lettuce_unit.save(function(e4, pk4, lettuce_unit) {
                                redis_storage.sync(user, function(e5, lettuce_unit) {
                                    topic.callback((e1 || e2 || e3 || e4 || e5), lettuce_unit, b1, b2, gabrielfalcao);
                                });
                            });
                        });
                    });
                });
            });
        },
        'many to one': function (err, lettuce_unit, b1, b2, gabrielfalcao) {
            gabrielfalcao.should.have.property('builds').with.lengthOf(2);
            gabrielfalcao.should.have.property('created_instructions').with.lengthOf(1);

            should.equal(gabrielfalcao.builds[0].__id__, 1);
            gabrielfalcao.should.have.property('created_instructions').with.lengthOf(1);
        }
    }
}).addBatch({
    'incremental ids are incremental': {
        topic: function(store, folder){
            var topic = this;
            var u1 = new User({name: 'User 1', email: 'u1@user.com', password: 'letmein'});
            var u2 = new User({name: 'User 2', email: 'u2@user.com', password: 'letmein'});
            var u3 = new User({name: 'User 3', email: 'u3@user.com', password: 'letmein'});
            u1.save(function(err1, key1){
                u2.save(function(err2, key2) {
                    u3.save(function(err3, key3){
                        topic.callback(null, key1, key2, key3);
                    });
                });
            });
        },
        'when all the fields are different': function(e, key1, key2, key3){
            key1.should.not.be.equal(key2);
            key1.should.not.be.equal(key3);

            key2.should.not.be.equal(key1);
            key2.should.not.be.equal(key3);

            key3.should.not.be.equal(key1);
            key3.should.not.be.equal(key2);
        }
    },
}).addBatch({
    'incremental ids are incremental': {
        topic: function(store, folder) {
            var topic = this;
            var u1 = new User({name: 'User 1', email: 'indexed@user.com', password: 'letmein'});
            var u2 = new User({name: 'User 2', email: 'indexed@user.com', password: 'letmein'});
            var u3 = new User({name: 'User 3', email: 'indexed@user.com', password: 'letmein'});
            u1.save(function(err1, key1){
                u2.save(function(err2, key2) {
                    u3.save(function(err3, key3){
                        topic.callback(null, key1, key2, key3);
                    });
                });
            });
        },
        'even when an indexed field is saved as the same in many fields': function(e, key1, key2, key3){
            key1.should.not.be.equal(key2);
            key1.should.not.be.equal(key3);

            key2.should.not.be.equal(key1);
            key2.should.not.be.equal(key3);

            key3.should.not.be.equal(key1);
            key3.should.not.be.equal(key2);
        }
    },
}).addBatch({
    'incremental ids are incremental': {
        topic: function(store, folder) {
            var topic = this;
            var u1 = new User({name: 'Unique User', email: 'u1@user.com', password: 'letmein'});
            var u2 = new User({name: 'Unique User', email: 'u2@user.com', password: 'letmein'});
            var u3 = new User({name: 'Unique User', email: 'u3@user.com', password: 'letmein'});

            u1.save(function(err1, key1){
                should.ifError(err1);
                u2.save(function(err2, key2) {
                    should.ifError(err2);
                    u3.save(function(err3, key3){
                        should.ifError(err3);
                        topic.callback(null, key1, key2, key3);
                    });
                });
            });
        },
        'even when an indexed field is saved as the same in many fields': function(e, key1, key2, key3){
            key1.should.not.be.equal(key2);
            key1.should.not.be.equal(key3);

            key2.should.not.be.equal(key1);
            key2.should.not.be.equal(key3);

            key3.should.not.be.equal(key1);
            key3.should.not.be.equal(key2);
        }
    },
}).export(module);
