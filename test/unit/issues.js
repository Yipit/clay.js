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
, crypto = require('crypto')
, _ = require('underscore')._;

var models = require('clay');
var mock = new models.storage.Mechanism();

models.set_primary_storage(mock);

var Foo = models.declare("Foo", function(it, kind){
    it.has.method('work', function(msg){
        return "foooooooooooooooooo"
    });
});

var Bar = models.declare("Bar", function(it, kind){
    it.has.method('work', function(msg){
        return "baaaaarrrrrrrrrrrrr"
    });
});

vows.describe('Models').addBatch({
    'can be declared sequentially': {
        topic: {
            'Foo': Foo,
            'Bar': Bar,
        },
        'and keep their spec sandboxed': function(MODELS){
            assert.deepEqual(MODELS.Foo._meta.name, 'Foo');
            assert.deepEqual(MODELS.Bar._meta.name, 'Bar');
        }
    }
}).export(module);
