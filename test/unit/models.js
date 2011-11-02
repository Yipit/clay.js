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

var vows = require('vows')
, should = require('should')
, crypto = require('crypto')
, _ = require('underscore')._;

var models = require('clay');
var mock = new models.storage.Mechanism();

models.set_primary_storage(mock);

vows.describe('A Model').addBatch({
    'after declared': {
        topic: function () {
            return models.declare("Person", function(it, kind){
                it.has.field("username", kind.alphanumeric);
                it.has.field("email_address", kind.email);
                it.has.field("zipcode", kind.numeric);
                it.has.field("password", kind.hashOf(["username", "email_address"]));

                it.validates.uniquenessOf("username");

                it.validates.presenceOf("username");
                it.validates.presenceOf("email_address");

                it.has.index("username");
                it.has.index("email_address");

                it.has.setter('email', function(address){
                    this.username = /^[^@]+/.exec(address)[0];
                    this.email_address = address;
                });

                it.has.getter('email', function(){
                    return this.email_address;
                });

                it.has.method('tweet', function(msg){
                    return '@' + this.username + ' ' + msg;
                });

                it.has.class_method('foo', function(){
                    return 'fooooooooooooooooooooo';
                });
            })
        },
        'the indexes are place': function(Person) {
            should.deepEqual(
                Person._meta.indexes,
                ['username', 'email_address']
            );
        },
        'can be created from': function(Person) {
            should.deepEqual(
                Person._meta.indexes,
                ['username', 'email_address']
            );
        },
        'the declared field names are available': function(Person) {
            should.deepEqual(
                Person._meta.field.names,
                ['username', 'email_address', 'zipcode', 'password']
            );
        },
        'obligatory fields are stored': function(Person) {
            should.ok(_.contains(
                Person._meta.required_fields,
                'username',
                'the "username" field should be considered obligatory'
            ));
            should.ok(_.contains(
                Person._meta.required_fields,
                'email_address',
                'the "email_address" field should be considered obligatory'
            ));
        },
        'unique fields are stored': function(Person) {
            should.ok(_.contains(
                Person._meta.unique_fields,
                'username',
                'the "username" field should be considered unique'
            ));
            should.ok(_.contains(
                Person._meta.required_fields,
                'email_address',
                'the "email_address" field should be considered obligatory'
            ));
        },
        'the declared field specs are available too': function(Person) {
            should.equal(
                Person._meta.field.definitions.username,
                models.FieldKinds.alphanumeric
            );
            should.equal(
                Person._meta.field.definitions.email_address,
                models.FieldKinds.email
            );
            should.equal(
                Person._meta.field.definitions.zipcode,
                models.FieldKinds.numeric
            );
        },
        'can be created from a JSON string': function(Person) {
            var raw = JSON.stringify({
                username: 'gabrielfalcao',
                email_address: 'gabriel@lettuce.it',
                zipcode: 10019,
                password: '123'
            })

            var p = Person.from_json_string(raw);
            should.equal(p.username, 'gabrielfalcao');
            should.equal(p.email_address, 'gabriel@lettuce.it');
            should.equal(p.zipcode, '10019');
            should.equal(p.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');
        },
        'can be created from a JSON buffer': function(Person) {
            var buf = new Buffer(JSON.stringify({
                username: 'gabrielfalcao',
                email_address: 'gabriel@lettuce.it',
                zipcode: 10019,
                password: '123'
            }))

            var p = Person.from_json_buffer(buf);
            should.equal(p.username, 'gabrielfalcao');
            should.equal(p.email_address, 'gabriel@lettuce.it');
            should.equal(p.zipcode, '10019');
            should.equal(p.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');
        },
        'can be created from a JSON buffer/string seamlessly': function(Person) {
            var raw = JSON.stringify({
                username: 'gabrielfalcao',
                email_address: 'gabriel@lettuce.it',
                zipcode: 10019,
                password: '123'
            });
            var buf = new Buffer(raw);

            var p1 = Person.from_json(buf);
            var p2 = Person.from_json(raw);

            should.equal(p1.username, 'gabrielfalcao');
            should.equal(p1.email_address, 'gabriel@lettuce.it');
            should.equal(p1.zipcode, '10019');
            should.equal(p1.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');

            should.equal(p2.username, 'gabrielfalcao');
            should.equal(p2.email_address, 'gabriel@lettuce.it');
            should.equal(p2.zipcode, '10019');
            should.equal(p2.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');
        },

        'after creating a functional instance of it': {
            topic: function(Person) {
                var topic = this;
                Person.create({
                    username: 'gabrielfalcao',
                    email_address: 'gabriel@lettuce.it',
                    zipcode: 10019,
                    password: '123'
                }, function(e, gabrielfalcao){
                    topic.callback(e, gabrielfalcao, Person);
                });
            },
            'the model is available through instance.__model__': function (e, gabrielfalcao, Person){
                should.deepEqual(gabrielfalcao.__model__, Person);
            },

            'the password is hashed': function (e, gabrielfalcao, Person){
                var sha1 = crypto.createHash('sha1');
                sha1.update('gabrielfalcao|sha1-emerald|gabriel@lettuce.it|sha1-emerald|123')

                var expected_hash = sha1.digest('hex');
                should.equal(expected_hash, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');
                should.equal(gabrielfalcao.password, expected_hash);
            },
            'the frickin hash really works, this tests set it to something else and works': function (e, gabrielfalcao){
                var sha1 = crypto.createHash('sha1');
                sha1.update('gabrielfalcao|sha1-emerald|gabriel@lettuce.it|sha1-emerald|somethingelse')

                var expected_hash = sha1.digest('hex');

                should.equal(expected_hash, 'f7d713c86afc8e76abf003416a83947070ae41eb');
                should.equal(gabrielfalcao.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');

                gabrielfalcao.password = 'somethingelse';
                should.equal(gabrielfalcao.password, expected_hash);
            },
            'resetting the password also works': function (e, gabrielfalcao){
                gabrielfalcao.password = '123';
                should.equal(gabrielfalcao.password, '2f142e6c536282a7e72a1016b998bde6ec2d8c90');
            },
            'the getter works': function(e, gabrielfalcao) {
                should.equal(gabrielfalcao.email, 'gabriel@lettuce.it');
            },
            'the setter also works': function(e, gabrielfalcao) {
                should.equal(gabrielfalcao.username, 'gabrielfalcao');

                gabrielfalcao.email = 'gabriel@lettuce.it';

                should.equal(gabrielfalcao.username, 'gabriel');
                should.equal(gabrielfalcao.email_address, 'gabriel@lettuce.it');
            },
            'instance methods': function(e, gabrielfalcao) {
                gabrielfalcao.username = 'ohhyeah'

                should.equal(
                    gabrielfalcao.tweet('that is cool, bro'),
                    '@ohhyeah that is cool, bro'
                );
            },
            'class methods': function(e, gabrielfalcao, Person) {
                should.equal(
                    Person.foo(),
                    'fooooooooooooooooooooo'
                );
            }
        },
        "by creating an instance that doesn't fulfill a required field": {
            topic: function(Person) {
                var topic = this;
                Person.create({
                    email_address: 'gabriel@lettuce.it',
                    zipcode: 10019,
                    password: '123'
                }, function(e, gabrielfalcao){
                    topic.callback(e, gabrielfalcao, Person);
                });
            },
            'it should fail': function (e, gabrielfalcao, Person){
                should.ok(e !== null, 'but did not!!!!!')
                should.equal(e.message, 'the "username" field is required');
            }
        }
    }
}).export(module);