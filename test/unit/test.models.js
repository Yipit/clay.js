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

var should = require('should')
, crypto = require('crypto')
, _ = require('underscore')._;

var models = require('../../lib/clay');
var mock = new models.storage.Mechanism();

models.set_primary_storage(mock);

describe('by declaring new a model', function(){
    var Person = models.declare("Person", function(it, kind){
        it.has.field("username", kind.alphanumeric);
        it.has.field("email_address", kind.email);
        it.has.field("birthdate", kind.datetime);
        it.has.field("created_at", kind.auto);
        it.has.field("zipcode", kind.numeric);
        it.has.field("password", kind.string);

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
    });

    it('the indexes are place', function() {
        should.deepEqual(
            Person._meta.indexes,
            ['username', 'email_address']
        );
    });
    it('can be created from', function() {
        should.deepEqual(
            Person._meta.indexes,
            ['username', 'email_address']
        );
    });
    it('the declared field names are available', function() {
        should.deepEqual(
            Person._meta.field.names,
            ['username', 'email_address', 'birthdate', 'created_at', 'zipcode', 'password']
        );
    });
    it('obligatory fields are stored', function() {
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
    });
    it('unique fields are stored', function() {
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
    });
    it('the declared field specs are available too', function() {
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
    });
    it('can be created from a JSON string', function() {
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
        should.equal(p.password, '123');
    });
    it('can be created from a JSON buffer', function() {
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
        should.equal(p.password, '123');
    });
    it('can be created from a JSON buffer/string seamlessly', function() {
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
        should.equal(p1.password, '123');

        should.equal(p2.username, 'gabrielfalcao');
        should.equal(p2.email_address, 'gabriel@lettuce.it');
        should.equal(p2.zipcode, '10019');
        should.equal(p2.password, '123');
    });
    describe('after creating an instance of it', function() {
        var now = new Date()
        var gabrielfalcao = new Person({
            username: 'gabrielfalcao',
            email_address: 'gabriel@lettuce.it',
            zipcode: 10019,
            password: '123',
            birthdate: "1988-02-25"
        });

        it('the model is available through instance.__model__', function(){
            should.deepEqual(gabrielfalcao.__model__, Person);
        });

        it('resetting the password also works', function(){
            gabrielfalcao.password = '123';
            should.equal(gabrielfalcao.password, '123');
        });
        it('the getter works', function() {
            should.equal(gabrielfalcao.email, 'gabriel@lettuce.it');
        });
        it('the setter also works', function() {
            should.equal(gabrielfalcao.username, 'gabrielfalcao');

            gabrielfalcao.email = 'gabriel@lettuce.it';

            should.equal(gabrielfalcao.username, 'gabriel');
            should.equal(gabrielfalcao.email_address, 'gabriel@lettuce.it');
        });
        it('instance methods', function() {
            gabrielfalcao.username = 'ohhyeah'

            should.equal(
                gabrielfalcao.tweet('that is cool, bro'),
                '@ohhyeah that is cool, bro'
            );
        });
        it('class methods', function() {
            should.equal(
                Person.foo(),
                'fooooooooooooooooooooo'
            );
        });
        it('the date was parsed properly', function() {
            gabrielfalcao.birthdate.should.be.an.instanceof(Date)
            gabrielfalcao.birthdate.toFormat("DD/MM/YYYY").should.equal('25/02/1988')
        });
        it('the auto field worked', function() {
            gabrielfalcao.created_at.should.be.an.instanceof(Date)
            gabrielfalcao.created_at.toFormat("DD/MM/YYYY").should.equal(now.toFormat('DD/MM/YYYY'))
        });
        it("fails when creating an instance with invalid field values", function(done) {
            Person.create({
                email_address: 'gabriel@lettuce.it',
                zipcode: 10019,
                password: '123'
            }, function(err) {
                err.should.have.property('message','the "username" field is required');
                done();
            });
        });
    });
});
