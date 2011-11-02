// var vows = require('vows')
// , assert = require('assert')
// , fs = require('fs')
// , events = require('events')
// , _ = require('underscore')._
// , path = require('path')
// , mkdirp = require("mkdirp");

// var models = require('../../models');

// function rm_rf (folder) {
//     if (path.existsSync(folder)) {
//         _.each(fs.readdirSync(folder), function(name){
//             var x = path.join(folder, name);
//             var stat = fs.statSync(x);
//             if (stat.isDirectory()) {rm_rf(x);}
//             else {fs.unlinkSync(x);}
//         });
//     }
// }
// var TOPICS = {
//     prepare_json_store: function(callback){
//         var folder = path.resolve('.test/database-folder/');
//         return function(){
//             var promise = new events.EventEmitter();
//             models.stores.JSON.setup(folder, function(e, store){
//                 var last_param = _.isFunction(callback) ? callback(e, store, folder) : null;
//                 if (e) {
//                     promise.emit('error', e);
//                 } else {
//                     promise.emit('success', store, folder, last_param);
//                 }
//             });
//             return promise;
//         }
//     }
// }

// var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
//     it.has.field("name", kind.string);
//     it.has.field("repository_address", kind.string);
//     it.validates.uniquenessOf("name");
//     it.has.index("repository_address");
// });

// var User = models.declare("User", function(it, kind){
//     it.has.field("name", kind.string);
//     it.has.field("email", kind.email);
//     it.has.field("password", kind.hashOf(["name", "email"]));
//     it.has.index("email");
// });

// vows.describe('The JSON model store').addBatch({
//     'after instantiated': {
//         topic: TOPICS.prepare_json_store(),
//         'there is a file indexes.json': function(e, store){
//             var folder = path.resolve('.test/database-folder');
//             assert.ok(path.existsSync(folder), ['the folder "', folder, '" should exist'].join(''));
//             assert.ok(path.existsSync(path.join(folder, 'indexes.json')), ['the file "indexes.json" should exist'].join(' '));
//         },
//         'can be used to persist instances of models': {
//             topic: TOPICS.prepare_json_store(function(e, store, folder){
//                 rm_rf(path.join(folder, 'User'));
//                 return [new User({
//                     name: 'Zach Smith',
//                     email: 'zach@yipit.com',
//                     password: 'cheezNwine'
//                 }, User)];
//             }),
//             'by calling *store.persist(instance, callback)*': {
//                 topic: function(store, folder, zachs){
//                     var topic = this,
//                     zach = zachs[0];

//                     store.persist(zach, function(e, final_path){
//                         var index = JSON.parse(fs.readFileSync(path.resolve('.test/database-folder/User/indexes.json')));
//                         topic.callback(e, final_path, index);
//                     });
//                 },
//                 'it is persisted in the right place': function(e, final_path){
//                     var instance = path.resolve('.test/database-folder/User/instance.1.json');
//                     assert.equal(instance, final_path);
//                     assert.ok(path.existsSync(final_path));
//                     assert.ok(path.existsSync(instance));
//                 },
//                 'it is indexed': function(e, final_path, index){
//                     assert.isObject(index);
//                     assert.include(index, 'indexes');

//                     assert.isObject(index.indexes);
//                     assert.include(index.indexes, 'email');

//                     assert.isObject(index.indexes.email);
//                     assert.include(index.indexes.email, 'zach@yipit.com');

//                     assert.isArray(index.indexes.email['zach@yipit.com']);
//                     assert.include(index.indexes.email['zach@yipit.com'], final_path);
//                 }
//             },
//             'it persists an array of instances': {
//                 topic: function(store, folder, zachs){
//                     var topic = this;

//                     store.persist(zachs, function(e, final_path){
//                         var index = JSON.parse(fs.readFileSync(path.resolve('.test/database-folder/User/indexes.json')));
//                         topic.callback(e, final_path, index);
//                     });
//                 },
//                 'it is persisted in the right place': function(e, final_path){
//                     var instance = path.resolve('.test/database-folder/User/instance.1.json');
//                     assert.equal(instance, final_path);
//                     assert.ok(path.existsSync(final_path));
//                     assert.ok(path.existsSync(instance));
//                 },
//                 'it is indexed': function(e, final_path, index){
//                     assert.isObject(index);
//                     assert.include(index, 'indexes');

//                     assert.isObject(index.indexes);
//                     assert.include(index.indexes, 'email');

//                     assert.isObject(index.indexes.email);
//                     assert.include(index.indexes.email, 'zach@yipit.com');

//                     assert.isArray(index.indexes.email['zach@yipit.com']);
//                     assert.include(index.indexes.email['zach@yipit.com'], final_path);
//                 }
//             }
//         },
//         'persisting an existent instance will update it': {
//             topic: TOPICS.prepare_json_store(function(e, store, folder){
//                 rm_rf(path.join(folder, 'User'));
//                 var modelFolder = path.join(folder, 'User');
//                 mkdirp.mkdirp(modelFolder, 0755, function(error){

//                     fs.writeFileSync(
//                         path.join(modelFolder, 'instance.222.json'),
//                         JSON.stringify({
//                             '__id__': 222,
//                             'name': 'Gabriel Falcão',
//                             'email': 'gabriel@nacaolivre.org',
//                             'password': '22c3b440eba1b34e5f8737f22f635d29af368e9f'
//                         })
//                     );
//                 });
//                 return new User({
//                     '__id__': 222,
//                     'email': 'gabriel@yipit.com'
//                 }, User);
//             }),
//             'by calling *store.persist(instance, callback)*': {
//                 topic: function(store, folder, gabriel){
//                     var topic = this;

//                     store.persist(gabriel, function(e, final_path){
//                         topic.callback(e, final_path);
//                     });
//                 },
//                 'it is persisted in the right place': function(e, final_path){
//                     var instance = path.resolve('.test/database-folder/User/instance.222.json');
//                     assert.equal(instance, final_path);

//                     assert.deepEqual(
//                         JSON.parse(fs.readFileSync(final_path)),
//                         {
//                             '__id__': 222,
//                             'name': 'Gabriel Falcão',
//                             'email': 'gabriel@yipit.com',
//                             'password': '22c3b440eba1b34e5f8737f22f635d29af368e9f'
//                         }
//                     )
//                 }
//             }
//         }
//     },
//     'can find files': {
//         topic: TOPICS.prepare_json_store(function(e, store, folder){
//             var modelFolder = path.join(folder, 'BuildInstruction');
//             mkdirp.mkdirp(modelFolder, 0755, function(error){

//                 fs.writeFileSync(
//                     path.join(modelFolder, 'instance.1.json'),
//                     JSON.stringify({'name': 'Lettuce', '__id__': 1})
//                 );
//             });
//         }),
//         'by id': {
//             topic: function(store, folder){
//                 var topic = this;
//                 store.find_by_id(BuildInstruction, 1, function(err, instance){

//                     topic.callback(err, instance, store, folder);
//                 });
//             },
//             'instance.__id__ is in place': function(e, instance, store, folder){
//                 assert.equal(instance.__id__, 1);
//             },

//             'instance.__model__ is in place': function(e, instance, store, folder){
//                 assert.deepEqual(instance.__data__, {'name': 'Lettuce'});
//             },
//             'instance.__data__ is also in place': function(e, instance, store, folder){
//                 assert.deepEqual(instance.__data__, {'name': 'Lettuce'});
//             },
//             'the data is also working through the getter': function(e, instance, store, folder){
//                 assert.equal(instance.name, 'Lettuce')
//             }
//         }
//     },
//     'fails if': {
//         topic: function(){
//             var topic = this;
//             var folder = path.resolve('.test/database-folder/');
//             var modelFolder = path.join(folder, 'BuildInstruction');

//             models.stores.JSON.setup(folder, function(e, store){
//                 mkdirp.mkdirp(modelFolder, 0755, function(error){

//                     fs.writeFileSync(
//                         path.join(modelFolder, 'instance.2.json'),
//                         JSON.stringify({'name': 'Lettuce', '__id__': 5436})
//                     );

//                     store.find_by_id(BuildInstruction, 2, function(err, instance){
//                         topic.callback(null, err, instance, store, folder);
//                     });
//                 });
//             });
//         },
//         'filename id does not match the object redundant id stored in his json': function(e){
//             assert.ok(!_.isNull(e), 'it should have failed')
//             assert.equal(e.message, 'when finding "BuildInstruction" by id, the internal id does not match the filename');
//         },
//         'fails if there is no such id': {
//             topic: function(err, instance, store, folder){
//                 var topic = this;
//                 store.find_by_id(BuildInstruction, 999, function(e, store){
//                     topic.callback(null, e, store);
//                 });
//             },
//             'the exception matches': function(e){
//                 assert.ok(!_.isNull(e), 'it should have failed')
//                 assert.equal(e.message, 'could not find the "BuildInstruction" with id "999"');
//             }
//         }
//     },
//     'find files indexed in indexes.json': {
//         topic: TOPICS.prepare_json_store(function(e, store, folder){
//             var modelFolder = path.join(folder, 'BuildInstruction');
//             var path_to_instance3 = path.join(modelFolder, 'instance.3.json');

//             mkdirp.mkdirp(modelFolder, 0755, function(error){
//                 fs.writeFileSync(
//                     path_to_instance3,
//                     JSON.stringify({'name': 'Cooool', '__id__': 3, 'repository_address': 'foobar3'})
//                 );
//                 fs.writeFileSync(
//                     path.join(modelFolder, 'indexes.json'),
//                     JSON.stringify({
//                         'indexes': {
//                             'name': {'Cooool': [path_to_instance3]},
//                             'repository_address': {'foobar3': [path_to_instance3]}
//                         }
//                     })
//                 );
//             });
//         }),
//         'by indexed field': {
//             topic: function(store, folder){
//                 var promise = new events.EventEmitter();
//                 store.find(BuildInstruction).matching_name(/Co*l/, function(e, results){
//                     promise.emit('success', results);
//                 });
//                 return promise;
//             },
//             'the result should be an array': function(results) {
//                 assert.isArray(results);
//             },
//             'and have one item': function(results) {
//                 assert.length(results, 1);
//             },
//             'and the information should match': function(results) {
//                 assert.equal(results[0].name, 'Cooool');
//                 assert.equal(results[0].repository_address, 'foobar3');
//             }
//         }
//     },
//     'find non-indexed items': {
//         topic: TOPICS.prepare_json_store(function(e, store, folder){
//             return [
//                 new User({
//                     name: 'Zach Smith',
//                     email: 'zach@yipit.com',
//                     password: 'cheezNwine'
//                 }, User),
//                 new User({
//                     name: 'Gabriel Falcão',
//                     email: 'gabriel@yipit.com',
//                     password: '123'
//                 }, User),
//             ]
//         }),
//         'by non-indexed field': {
//             topic: function(store, folder, instances){
//                 var promise = new events.EventEmitter();

//                 store.persist(instances, function(e){
//                     if (e) {
//                         return promise.emit('error', e);
//                     }

//                     store.find(BuildInstruction).matching_name(/gab/i, function(e, results){
//                         promise.emit('success', results);
//                     });
//                 });
//                 return promise;
//             },
//             'the result should be an array': function(results) {
//                 assert.isArray(results);
//             },
//             'and have one item': function(results) {
//                 assert.length(results, 1);
//             },
//             'and the information should match': function(results) {
//                 assert.equal(results[0].name, 'Gabriel Falcão');
//                 assert.equal(results[0].email, 'gabriel@yipit.com');
//             }
//         }
//     }

// }).export(module);

