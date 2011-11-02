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
    it.has.index('email');
    it.is_stored_with(redis_storage);
});

var Build = models.declare("Build", function(it, kind){
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
    it.is_stored_with(redis_storage);
});
var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("repository_address", kind.string);
    it.validates.uniquenessOf("name");
    it.has.index("repository_address");
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
                password: 'b65c43168bf3621f4abeb857ba76ab028246df34'
            });
            zach.__data__.should.eql({
                __id__: 1,
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: 'b65c43168bf3621f4abeb857ba76ab028246df34'
            });
        }
    },
    'by calling *instance.save(callback)*': {
        topic: function() {
            var topic = this;

            clear_redis(function(){
                var b1 = new Build({
                    status: 0,
                    error: '',
                    output: 'Worked!'
                });
                b1.save(function(err, key, b1, store, connection){
                    client.hgetall("clay:Build:id:1", function(err, data){
                        topic.callback(err, key, b1, store, connection, data);
                    });
                });
            });
        },
        'it increments the index': function(err, key, b1, store, connection, data) {
            key.should.equal('clay:Build:id:1')
            data.should.eql({
                __id__: '1',
                status: '0',
                error: '',
                output: 'Worked!'
            });

            b1.__data__.should.eql({
                __id__: 1,
                status: 0,
                error: '',
                output: 'Worked!'
            });
        },
        'changing an already saved instance just update the values': {
            topic : function(){
                var topic = this;
                var u3 = new User({
                    name: 'Ben',
                    email: 'ben@yipit.com',
                    password: 'this is ben'
                });
                u3.save(function(e, key1){
                    u3.name = 'Ben Plesser'
                    u3.save(function(e, key2){
                        topic.callback(null, key1, key2);
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
                    name: 'Nitya Oberoi',
                    email: 'nitya@yipit.com',
                    password: 'hackoutloud'
                });
                var henri = new User({
                    name: 'Henri Xie',
                    email: 'henri@yipit.com',
                    password: 'switzerland'
                });
                var nitya_and_henri = [nitya, henri];

                redis_storage.persist(nitya_and_henri, function(err, key, zach, store, connection){
                    var items = [];
                    _.each(nitya_and_henri, function(item){
                        client.hgetall("clay:User:id:" + item.__id__, function(err, data){
                            items.push(data);
                            if (items.length == 2) {
                                topic.callback(null, items);
                            }
                        });
                    });
                });
            });
        },
        'it is stored properly': function(err, items){
            items.should.eql([
                {
                    __id__: '2',
                    name: 'Nitya Oberoi',
                    email: 'nitya@yipit.com',
                    password: '6a3245c020e827d762dd7dc55a1196a5c3fda2e1'
                },
                {
                    __id__: '3',
                    name: 'Henri Xie',
                    email: 'henri@yipit.com',
                    password: '9921510a6f322a268fdec1ebd8efd2e067fb1d29'
                }
            ]);
        }
    }
}).export(module);
