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
, util = require('util')
, _ = require('underscore')._
, crypto = require('crypto');

var models = require('clay');

vows.describe('Models *"talking"* to a store').addBatch({
    'when you declare a model, it is possible to specify its store': function(){
        function FakeMechanism (){models.storage.Mechanism.call(this)};
        util.inherits(FakeMechanism, models.storage.Mechanism);

        var fake_mechanism = new FakeMechanism();

        var User = models.declare('User', function (it, kind){
            it.has.field("name", kind.string);
            it.is_stored_with(fake_mechanism)
        });

        assert.deepEqual(fake_mechanism, User._meta.storage);
    },
    'it is possible to set the default storage mechanism': function(){
        function FakeMechanismTwo (){models.storage.Mechanism.call(this)};
        util.inherits(FakeMechanismTwo, models.storage.Mechanism);

        var fake2 = new FakeMechanismTwo();

        models.set_primary_storage(fake2)

        var Build = models.declare('Build', function (it, kind){
            it.has.field("name", kind.string);
        });

        assert.deepEqual(fake2, Build._meta.storage);
    },
    'it defaults to the redis storage mechanism': function(){
        assert.instanceOf(models.storage.default,
                          models.storage.RedisMechanism);
    }
}).export(module);