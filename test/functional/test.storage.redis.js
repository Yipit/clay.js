var
  async = require('async')
, client = require('redis').createClient();

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

    async.waterfall([
        function wait_for_lock(callback) {
            var counter = 0;
            var handle = setInterval(function(){
                client.get('clay|lock|persist', function(err, locked){
                    counter++;
                    if (err || (!locked) ) {
                        clearInterval(handle);
                        callback(err);
                    } else if (counter >= 1000){
                        clearInterval(handle);
                        throw Error('lock timeout');
                    }
                });
            }, 10);
        },
        function get_keys(callback) {
            client.keys('clay:*', callback);
        },
        function delete_keys (keys, callback) {
            async.map(keys, function(key, callback){
                client.del(key, function(err){
                    return callback(err, key);
                });
            }, callback);
        }
    ], callback);
}

describe('Persisting '+'fresh'.yellow.bold+' instances to the redis storage backend', function(){
    beforeEach(clear_redis);
    describe('through '+'store.persist(instance, callback)'.yellow.bold, function() {

        it('should increment the index', function(done){
            async.waterfall([
                function Given_I_create_an_instance(callback){
                    var zach = new User({
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: 'cheezNwine'
                    });
                    callback(null, zach);
                },
                function And_I_persist_it(zach, callback){
                    redis_storage.persist(zach, callback);
                },
                function When_I_fetch_the_equivalent_key_from_redis(pks, instances, storage, connection, callback) {
                    pks.should.be.ok;
                    pks.should.be.an.instanceof(Array);
                    pks.should.have.length(1);
                    pks[0].should.equal('clay:User:id:1');

                    instances.should.be.ok;
                    instances.should.be.an.instanceof(Array);
                    instances.should.have.length(1);
                    instances[0].should.have.property('__id__', 1);
                    instances[0].should.have.property('name', 'Zach Smith');
                    instances[0].should.have.property('email', 'zach@yipit.com');
                    instances[0].should.have.property('password', '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06');

                    connection.hgetall("clay:User:id:1", callback);
                },
                function test_it(data, callback) {
                    data.should.eql({
                        __id__: '1',
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
                    });
                    callback();
                }
            ], done);
        });
    });
    describe('through '+'instance.save(callback)'.yellow.bold, function() {
        it('should increment the index', function(done){
            async.waterfall([
                function Given_I_create_an_instance(callback){
                    callback(null, new User({
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: 'cheezNwine'
                    }));
                },
                function And_I_save_it(zach, callback){
                    zach.save(callback);
                },
                function When_I_fetch_the_equivalent_key_from_redis(pk, instance, storage, connection, callback) {
                    pk.should.be.ok;
                    pk.should.equal('clay:User:id:1');

                    instance.should.be.ok;
                    instance.should.have.property('__id__', 1);
                    instance.should.have.property('name', 'Zach Smith');
                    instance.should.have.property('email', 'zach@yipit.com');
                    instance.should.have.property('password', '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06');

                    connection.hgetall("clay:User:id:1", callback);
                },
                function test_it(data, callback) {
                    data.should.eql({
                        __id__: '1',
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
                    });
                    callback();
                }
            ], done);
        });
    });
    describe('through '+'Model.create({data}, callback)'.yellow.bold, function() {
        it('should increment the index', function(done){
            async.waterfall([
                function Given_I_create_an_instance(callback){
                    User.create({
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: 'cheezNwine'
                    }, callback);
                },
                function When_I_fetch_the_equivalent_key_from_redis(pk, instance, storage, connection, callback) {
                    pk.should.be.ok;
                    pk.should.equal('clay:User:id:1');

                    instance.should.be.ok;
                    instance.should.have.property('__id__', 1);
                    instance.should.have.property('name', 'Zach Smith');
                    instance.should.have.property('email', 'zach@yipit.com');
                    instance.should.have.property('password', '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06');

                    connection.hgetall("clay:User:id:1", callback);
                },
                function test_it(data, callback) {
                    data.should.eql({
                        __id__: '1',
                        name: 'Zach Smith',
                        email: 'zach@yipit.com',
                        password: '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06'
                    });
                    callback();
                }
            ], done);
        });
    });
});

describe('Persisting '+'an existing'.yellow.bold+' instance to the redis storage backend', function(){
    beforeEach(function(done){
        clear_redis(function(){
            Build.create({
                status: 0,
                error: 'none',
                output: 'I am new, buddy!'
            }, done);
        });
    });
    describe('through '+'store.persist(instance, callback)'.yellow.bold, function() {
        it('should keep the index');
    });
    describe('through '+'instance.save(callback)'.yellow.bold, function() {
        it('should increment the index');
    });
});