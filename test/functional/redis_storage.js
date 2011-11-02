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
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: 'b65c43168bf3621f4abeb857ba76ab028246df34'
            });
            zach.__data__.should.eql(data);
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
        'it increments the index': function(err, key, b1, store, connection, data){
            key.should.equal('clay:Build:id:1')
            data.should.eql({
                status: '0',
                error: '',
                output: 'Worked!'
            });
            b1.__data__.should.eql({
                status: 0,
                error: '',
                output: 'Worked!'
            });
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
                        client.smembers("clay:User:indexes:email:coders@yipit.com", function(err, pks){
                            topic.callback(err, pks, key1, key2);
                        });
                    });
                });

            },
            'in a list': function(e, pks, key1, key2){
                pks.should.eql([key1, key2]);
            }
        }

    }
}).export(module);