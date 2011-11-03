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
, assert = require('assert');

require('clay');

vows.describe('Monkey-patches/Additions to the native prototypes').addBatch({
    'String.slugify': function() {
        assert.equal("gabriel-falcao".slugify(), "gabriel-falcao");
    },
    'String.methodify': function() {
        assert.equal("Call Gabriel Falcão".methodify(), "call_gabriel_falcao");
    },
    'String.render': function() {
        assert.equal("Gabriel {surname}".render({surname: 'Falcão'}), "Gabriel Falcão");
    },
    'Array.prototype.first always return the first element': function() {
        assert.equal(["aaa", "b"].first, "aaa");
    },
    'Array.prototype.last always return the last element': function() {
        assert.equal(["aaa", "b"].last, "b");
    },
    'Number.prototype.times takes a callback': {
        'the first argument is the last captured error': function(){
            var x = 0;
            var errors = [];
            (2).times(function(e){
                x++;
                if (!e) {
                    throw Error("It has failed");
                } else {
                    errors.push(e);
                }
            });

            assert.equal(x, 2);
            assert.equal(errors.length, 1);
            assert.equal(errors[0].message, "It has failed");
        },
        'the second argument is the index': function(){
            var expected_indexes = [0, 1, 2, 3];

            assert.deepEqual((4).times(function(e, index){
                assert.equal(e, null);
                assert.include(expected_indexes, index);
                assert.equal(index, expected_indexes[index]);
                return index;
            }), expected_indexes);
        },
        'the third argument is the number of remaining executions': function(){
            var expected_remaining = [3, 2, 1, 0];

            assert.deepEqual((4).times(function(e, index, remaining){
                assert.ifError(e);
                assert.equal(remaining, expected_remaining[index]);
                return remaining;
            }), expected_remaining);
        },
        'the fourth argument is an execution context': {
            topic: [
                {
                    is_the_first: true,
                    is_the_last: false
                }, {
                    is_the_first: false,
                    is_the_last: false
                }, {
                    is_the_first: false,
                    is_the_last: true
                }
            ],
            'and the first occurrence responds properly': function(expected){
                assert.deepEqual((3).times(function(e, index, remaining, this_time) {
                    assert.deepEqual(expected[index], this_time);
                    return this_time;
                }), expected);
            }
        }
    }
}).export(module);
