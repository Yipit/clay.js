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
, assert = require('assert')
, _ = require('underscore')._
, crypto = require('crypto');
_old_include = assert.include;

var models = require('clay');

assert.include = function (where, what, msg){
    var found = false;
    var errors = [];

    if (_.isObject(what)) {
        _.each(where, function(v, k){
            try {
                assert.deepEqual(what, v);
                found = true;
            } catch (e) {
                errors.push(e);
            }
        });
        if (!found) {
            throw errors.last;
        }
    } else {
        _old_include(where, what, msg);
    }
}

var mock = new models.storage.Mechanism();

models.set_primary_storage(mock);

var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("password", kind.hashOf(["name", "email"]));
    it.has.method('greet', function() {
        return [
            "Hello, my name is ", this.name, ", it's nice to meet you"
        ].join('');
    });
});

var Build = models.declare("Build", function(it, kind){
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
});
var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("repository_address", kind.string);
    it.validates.uniquenessOf("name");
    it.has.index("repository_address");
    it.has.many("builds", Build, "instruction");
    it.has.one("owner", User, "created_instructions");
});

vows.describe('Relationships').addBatch({
    'metadata has a *"relationships"* attribute': function(){
        assert.include(BuildInstruction._meta, 'relationships');
    },
    'metadata.relationships is an object': function(){
        assert.isObject(BuildInstruction._meta.relationships);
    },
    '_meta.relationships has *one to many* thru attribute *"has_many"*': function(){
        assert.include(BuildInstruction._meta.relationships, 'has_many');
        assert.isArray(BuildInstruction._meta.relationships.has_many);
    },
    '_meta.relationships has *many to one* thru attribute *"has_one"*': function(){
        assert.include(BuildInstruction._meta.relationships, 'has_one');
        assert.isArray(BuildInstruction._meta.relationships.has_one);
    },
    '*one to many* is defined in the declared model': function(){
        assert.include(
            BuildInstruction._meta.relationships.has_one,
            {
                property: 'owner',
                model: User,
                reverse_name: 'created_instructions'
            }
        )
    },
    '*one to many* is defined in the referred *(side efffected)*model': function(){
        assert.include(
            User._meta.relationships.has_many,
            {
                property: 'created_instructions',
                model: BuildInstruction,
                reverse_name: 'owner'
            }
        )
    },
    '*many to one* is defined in the declared model': function(){
        assert.include(
            BuildInstruction._meta.relationships.has_one,
            {
                property: 'owner',
                model: User,
                reverse_name: 'created_instructions'
            }
        )
    },
    '*many to one* is defined in the referred *(side efffected)*model': function(){
        assert.include(
            User._meta.relationships.has_many,
            {
                property: 'created_instructions',
                model: BuildInstruction,
                reverse_name: 'owner'
            }
        )
    },
    '*many to one* is defined in the referred *(side efffected)*model': function(){
        assert.include(
            User._meta.relationships.has_many,
            {
                property: 'created_instructions',
                model: BuildInstruction,
                reverse_name: 'owner'
            }
        )
    },
    '*has one* creates a clever property that sets from an object to a model': {
        topic: function(){
            return new BuildInstruction({
                name: "Yipit Data",
                repository_address: 'git@github.com:Yipit/data.git',
                owner: {
                    name: 'Adam Nelson',
                    email: 'adam@yipit.com',
                    password: 'got you a gift'
                }
            }, BuildInstruction);
        },
        'the immediate relationship is converted to a model instance': function(b){
            assert.isObject(b.owner._meta);
            assert.equal(b.owner.name, 'Adam Nelson');
            assert.equal(b.owner.greet(), "Hello, my name is Adam Nelson, it's nice to meet you");
        }
    },
    '*has one* creates a clever property that sets from a JSON string to a model': {
        topic: function(){
            return new BuildInstruction({
                name: "Yipit Data",
                repository_address: 'git@github.com:Yipit/data.git',
                owner: JSON.stringify({
                    name: 'Adam Nelson',
                    email: 'adam@yipit.com',
                    password: 'got you a gift'
                })
            }, BuildInstruction);
        },
        'the immediate relationship is converted to a model instance': function(b) {
            assert.isObject(b.owner._meta);
            assert.equal(b.owner.name, 'Adam Nelson');
            assert.equal(b.owner.greet(), "Hello, my name is Adam Nelson, it's nice to meet you");
        },
        'the instance adds itself to the array in the related model': function(b) {
            assert.isArray(b.owner.created_instructions);
            assert.includes(b.owner.created_instructions, b);
            assert.deepEqual(b.owner.created_instructions[0].__data__, b.__data__);
        }
    },
    '*has one* throws an exception in case the JSON is *corrupted*': function(){
        var createBI = function(){
            var fooooo = new BuildInstruction({
                name: "Yipit Data",
                repository_address: 'git@github.com:Yipit/data.git',
                owner: "@@@@@"
            }, BuildInstruction);
        }
        assert.throws(createBI);
        try {
            createBI();
        } catch (e) {
            assert.equal(
                e.message,
                '\'@@@@@\' is an invalid JSON, so that it can\'t be set in \'BuildInstruction.owner\' instead it should be an object respecting the definition of the \'User\' model'
            );
        }
    },
    '*has many* creates a clever property that sets from an array of objects': {
        topic: function(){
            return new BuildInstruction({
                name: "Yipit Data",
                repository_address: 'git@github.com:Yipit/data.git',
                builds: [
                    {
                        status: 0,
                        error: '',
                        output: 'cool'
                    },
                    {
                        status: 14,
                        error: 'OOps, it has failed',
                        output: 'try again later'
                    }
                ]
            }, BuildInstruction);
        },
        'the immediate relationship is converted to an array of models': function(b){
            assert.isArray(b.builds);
            assert.equal(b.builds.length, 2, 'there should be 2 builds');

            assert.isObject(b.builds[0]._meta);

            assert.equal(b.builds[0].status, 0, 'the build status should be zero');
            assert.equal(b.builds[0].error, '');
            assert.equal(b.builds[0].output, 'cool');

            assert.isObject(b.builds[1]._meta);
            assert.equal(b.builds[1].status, 14);
            assert.equal(b.builds[1].error, 'OOps, it has failed');
            assert.equal(b.builds[1].output, 'try again later');

        },
        'the instance assigns itself in the related model instance': function(b) {
            assert.equal(b, b.builds[0].instruction);
            assert.equal(b.__data__, b.builds[0].instruction.__data__);
        }

    }
}).export(module);