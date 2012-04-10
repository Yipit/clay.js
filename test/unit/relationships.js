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
, _ = require('underscore')._
, crypto = require('crypto');
_old_include = should.include;

var models = require('../../clay');

should.include = function (where, what, msg){
    var found = false;
    var errors = [];

    if (_.isObject(what)) {
        _.each(where, function(v, k){
            try {
                should.deepEqual(what, v);
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
    it.has.field("password", kind.string);

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
        should.include(BuildInstruction._meta, 'relationships');
    },
    'metadata.relationships is an object': function(){
        should.isObject(BuildInstruction._meta.relationships);
    },
    '_meta.relationships has *one to many* thru attribute *"has_many"*': function(){
        should.include(BuildInstruction._meta.relationships, 'has_many');
        should.isArray(BuildInstruction._meta.relationships.has_many);
    },
    '_meta.relationships has *many to one* thru attribute *"has_one"*': function(){
        should.include(BuildInstruction._meta.relationships, 'has_one');
        should.isArray(BuildInstruction._meta.relationships.has_one);
    },
    '*one to many* is defined in the declared model': function(){
        should.include(
            BuildInstruction._meta.relationships.has_one,
            {
                property: 'owner',
                model: User,
                reverse_name: 'created_instructions'
            }
        )
    },
    '*one to many* is defined in the referred *(side efffected)*model': function(){
        should.include(
            User._meta.relationships.has_many,
            {
                property: 'created_instructions',
                model: BuildInstruction,
                reverse_name: 'owner'
            }
        )
    },
    '*many to one* is defined in the declared model': function(){
        should.include(
            BuildInstruction._meta.relationships.has_one,
            {
                property: 'owner',
                model: User,
                reverse_name: 'created_instructions'
            }
        )
    },
    '*many to one* is defined in the referred *(side efffected)*model': function(){
        should.include(
            User._meta.relationships.has_many,
            {
                property: 'created_instructions',
                model: BuildInstruction,
                reverse_name: 'owner'
            }
        )
    },
    '*many to one* is defined in the referred *(side efffected)*model': function(){
        should.include(
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
            });
        },
        'the immediate relationship is converted to a model instance': function(b){
            should.isObject(b.owner._meta);
            should.equal(b.owner.name, 'Adam Nelson');
            should.equal(b.owner.greet(), "Hello, my name is Adam Nelson, it's nice to meet you");
        }
    },
    '*has many* creates a clever property that sets from an array of objects': function() {
        var b = new BuildInstruction({
            name: "Yipit Data",
            repository_address: 'git@github.com:Yipit/data.git',
            __id__: 1,
            builds: [
                {
                    __id__: 1,
                    __data__: {
                        __id__: 1,
                        status: 0,
                        error: '',
                        output: 'cool'
                    }
                },
                {
                    __id__: 2,
                    status: 14,
                    error: 'OOps, it has failed',
                    output: 'try again later'
                }
            ]
        });

        b.should.have.property('builds').with.lengthOf(2)

        should.exist(b.builds[0]);
        should.exist(b.builds[1]);

        should.isObject(b.builds[1]._meta);

        should.equal(b.builds[1].status, 14);
        should.equal(b.builds[1].error, 'OOps, it has failed');
        should.equal(b.builds[1].output, 'try again later');

        should.exist(b.builds[0]._meta);
        should.equal(b.builds[0].status, 0);
        should.equal(b.builds[0].error, '');
        should.equal(b.builds[0].output, 'cool');
    },
    '*one-to-many* self-assignment to the affected instance': function(){
        var Owner = models.declare('Owner', function(it, kind){
            it.has.field('name', kind.string);
        });

        var Item = models.declare('Item', function(it, kind){
            it.has.field('description', kind.string);
            it.has.one('owner', Owner, 'items');
        });

        var o1 = new Owner({name: 'John Doe'});

        var i1 = new Item({owner: o1, description: 'Bar'});
        var i2 = new Item({owner: o1, description: 'Foo'});

        should.exist(o1.items);
        o1.should.have.property('items').with.lengthOf(2);

        o1.items[0].should.eql(i1);
        o1.items[1].should.eql(i2);

        o1.items[0].owner.name.should.equal('John Doe');
        o1.items[1].owner.name.should.equal('John Doe');
    },
    '*one-to-many* fething by reverse name': function(){
        var Owner = models.declare('Owner', function(it, kind){
            it.has.field('name', kind.string);
        });

        var Item = models.declare('Item', function(it, kind){
            it.has.field('description', kind.string);
            it.has.one('owner', Owner, 'items');
        });

        var i1 = new Item({description: 'Bar', __id__: 1});
        var i2 = new Item({description: 'Foo', __id__: 2});

        var o1 = new Owner({name: 'John Doe', items: [i1, i2], __id__:1});

        should.exist(i1.owner);
        should.exist(i2.owner);


        i1.owner.should.have.property('__id__').equal(o1.__id__);
        i2.owner.should.have.property('__id__').equal(o1.__id__);


        i1.owner.name.should.equal('John Doe');
        i2.owner.name.should.equal('John Doe');

        _.map(i1.owner.items, function(i){return i.__data__.__id__}).should.include(i2.__id__);
        _.map(i1.owner.items, function(i){return i.__data__.__id__}).should.include(i1.__id__);
    },
    '*many-to-one* self-assignment to the affected instance': function(){
        var Item = models.declare('Item', function(it, kind){
            it.has.field('description', kind.string);
        });

        var Owner = models.declare('Owner', function(it, kind){
            it.has.field('name', kind.string);
            it.has.many('items', Item, 'owner');
        });

        var o1 = new Owner({name: 'John Doe'});

        var i1 = new Item({owner: o1, description: 'Bar'});
        var i2 = new Item({owner: o1, description: 'Foo'});

        should.exist(o1.items);
        o1.should.have.property('items').with.lengthOf(2);

        o1.items[0].should.eql(i1);
        o1.items[1].should.eql(i2);

        o1.items[0].owner.name.should.equal('John Doe');
        o1.items[1].owner.name.should.equal('John Doe');
    },
    '*many-to-one* fething by reverse name': function(){
        var Item = models.declare('Item', function(it, kind){
            it.has.field('description', kind.string);
        });
        var Owner = models.declare('Owner', function(it, kind){
            it.has.field('name', kind.string);
            it.has.many('items', Item, 'owner');
        });

        var i1 = new Item({description: 'Bar', __id__: 1});
        var i2 = new Item({description: 'Foo', __id__: 2});

        var o1 = new Owner({name: 'John Doe', items: [i1, i2], __id__:1});

        should.exist(i1.owner);
        should.exist(i2.owner);


        i1.owner.should.have.property('__id__').equal(o1.__id__);
        i2.owner.should.have.property('__id__').equal(o1.__id__);


        i1.owner.name.should.equal('John Doe');
        i2.owner.name.should.equal('John Doe');

        _.map(i1.owner.items, function(i){return i.__data__.__id__}).should.include(i2.__id__);
        _.map(i1.owner.items, function(i){return i.__data__.__id__}).should.include(i1.__id__);
    }
}).export(module);
