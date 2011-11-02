var vows = require('vows')
, assert = require('assert')
, fs = require('fs')
, events = require('events')
, _ = require('underscore')._
, path = require('path')
, redis = require('redis');
var client = redis.createClient();

var models = require('clay');

var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("repository_address", kind.string);
    it.validates.uniquenessOf("name");
    it.has.index("repository_address");
});

var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("password", kind.hashOf(["name", "email"]));
    it.has.index("email");
});

function clear_redis(callback) {
    console.log('x');
    return function() {
        var topic = this;

        client.keys('clay*', function (err, keys){
            _.each(keys, function(key){
                client.del(key, function(){
                    if (keys.last == key) {
                        callback(topic);
                    }
                });
            });
        });
    }
}

vows.describe('Redis Storage Mechanism').addBatch({
    'by calling *store.persist(instance, callback)*': {
        topic: clear_redis(function(topic){
            var zach = new User({
                name: 'Zach Smith',
                email: 'zach@yipit.com',
                password: 'cheezNwine'
            });
            console.log(topic);
            zach.save(function(err, key, zach, store, connection){
                topic.callback(err, key, zach, store, connection);
            });
        }),
        'it increments the index': function(err, key, zach, store, connection){
            assert.deepEqual('clay:User:id:1', key);
        }
    }
}).export(module);