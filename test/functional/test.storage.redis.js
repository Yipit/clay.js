var
_        = require('underscore')._
, async  = require('async')
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

function create_a_lot_of_records (done){
    clear_redis(function(){
        async.map(_.range(100), function(index, callback){
            var num = (index + 1);
            BuildInstruction.create({
                name: 'Lorem Ipsum project #' + num,
                repository_address: 'git@github.com:lorem/ipsum-'+num+'-sit-amet.git',
                build_command: 'make test:unit:' + num
            }, callback);
        }, done);
    });
}
describe('Persisting '+'fresh'.yellow.bold+' instances to the redis storage backend', function(){
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
                    pks.first.should.equal('clay:User:id:1');

                    instances.should.be.ok;
                    instances.should.be.an.instanceof(Array);
                    instances.should.have.length(1);
                    instances.first.should.have.property('__id__', 1);
                    instances.first.should.have.property('name', 'Zach Smith');
                    instances.first.should.have.property('email', 'zach@yipit.com');
                    instances.first.should.have.property('password', '8e5a04ac30cf92eafe36e7a6f9ae9e3af240dc06');

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
describe('Given a lot of models are created '+'(100+)'.green.bold, function(){
    beforeEach(create_a_lot_of_records);

    it('the counter should match', function(done){
        client.get('clay:BuildInstruction:count', function(with_problems, total){
            if (with_problems) return done(with_problems);

            total.should.be.ok;
            total.should.equal('100');

            done();
        })
    });
    it('all of them should be there', function(done){
        client.keys('clay:BuildInstruction:id:*', function(with_problems, items){
            if (with_problems) return done(with_problems);

            items.should.be.an.instanceof(Array);
            items.should.have.length(100);
            done();
        })
    });
});

describe('Instance lookup', function(){
    beforeEach(function(done){
        clear_redis(function(){
            async.mapSeries(_.range(100), function(index, callback){
                var num = (index + 1);
                BuildInstruction.create({
                    name: 'Lorem Ipsum project #' + num,
                    repository_address: 'git@github.com:lorem/ipsum-'+num+'-sit-amet.git',
                    build_command: 'make test:unit:' + num
                }, callback);
            }, done);
        });
    });
    describe('calling Model#find_by_field_name("value")'.yellow.bold, function() {
        it('does not fail', function(done){
            BuildInstruction.find_by_name(/project.*1/, done);
        });

        it('returns results ordered by id descending', function(done){
            BuildInstruction.find_by_name(/project.*1/, function(err, found){
                found.should.be.ok;
                found.should.have.length(20);

                found.first.should.have.property('name', 'Lorem Ipsum project #100');
                found.last.should.have.property('name', 'Lorem Ipsum project #1');

                done();
            });
        });
    });
    describe('calling Model#get_by_field_name("value")'.yellow.bold, function() {
        it('does not fail', function(done){
            BuildInstruction.get_by_build_command(/.*1/, done);
        });

        it('returns the first result', function(done){
            BuildInstruction.get_by_build_command(/.*1/, function(with_problems, item){
                if (with_problems) return done(with_problems);

                item.should.be.an.instanceof(BuildInstruction);
                item.should.have.property('name', 'Lorem Ipsum project #100');
                done();
            });
        });
    });
    describe('calling Model#ordered_by.one_field.find_by_field_name'.yellow.bold, function() {
        it('returns the many results given the order by "one_field"');
    });
    describe('calling Model#ordered_by.one_field.get_by_field_name'.yellow.bold, function() {
        it('returns the first result given the order by "one_field"');
    });
});

describe('Persisting '+'an existing'.yellow.bold+' instance to the redis storage backend', function(){
    before(function(done){
        clear_redis(function(){
            async.waterfall([
                function(callback){
                    Build.create({
                        status: 33,
                        error: 'a lot of problems, dude',
                        output: 'damn'
                    }, callback);
                },
                function (pk, instance, storage, connection, callback){
                    async.mapSeries(_.range(10), function(index, callback){
                        Build.create({
                            __id__: 568,
                            status: 0,
                            error: 'none',
                            output: 'I am new, buddy!'
                        }, callback);
                    }, callback);

                },
                function(results, callback){
                    Build.create({
                        status: 88,
                        error: 'a third one',
                        output: 'yep'
                    }, function(pk, instance, storage, connection){
                        return callback();
                    });
                }
            ], done);
        });
    });
    it('the counter should match', function(done){
        client.get('clay:Build:count', function(with_problems, total){
            if (with_problems) return done(with_problems);

            total.should.be.ok;
            total.should.equal('578');

            done();
        })
    });

    describe('through '+'store.persist(instance, callback)'.yellow.bold, function() {
        it('should keep the index');
    });
    describe('through '+'instance.save(callback)'.yellow.bold, function() {
        it('should increment the index');
    });
});