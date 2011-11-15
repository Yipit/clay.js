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
, should = require('should');

var models = require('clay');

vows.describe('Monkey-patches/Additions to the native prototypes').addBatch({
    'String.slugify': function() {
        should.equal("gabriel-falcao".slugify(), "gabriel-falcao");
    },
    'String.methodify': function() {
        should.equal("Call Gabriel Falcão".methodify(), "call_gabriel_falcao");
    },
    'String.render': function() {
        should.equal("Gabriel {surname}".render({surname: 'Falcão'}), "Gabriel Falcão");
    },
    'Array.prototype.first always return the first element': function() {
        should.equal(["aaa", "b"].first, "aaa");
    },
    'Array.prototype.last always return the last element': function() {
        should.equal(["aaa", "b"].last, "b");
    },
    'Array.prototype.models return unique models': function() {
        var Person = models.declare('Person');
        var p1 = new Person();p1.__id__ = 1;
        var p2 = new Person();p2.__id__ = 2;
        var p3 = new Person();p3.__id__ = 3;

        var p4 = new Person();p4.__data__.__id__ = 1;
        var p5 = new Person();p5.__data__.__id__ = 2;
        var p6 = new Person();p6.__data__.__id__ = 3;

        var People = [];
        People.push(p1);
        People.push(p2);
        People.push(p3);
        People.push(p4);
        People.push(p5);
        People.push(p6);

        People.models.should.eql([p1, p2, p3]);
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

            should.equal(x, 2);
            should.equal(errors.length, 1);
            should.equal(errors[0].message, "It has failed");
        },
        'the second argument is the index': function(){
            var expected_indexes = [0, 1, 2, 3];

            should.deepEqual((4).times(function(e, index){
                should.equal(e, null);
                should.include(expected_indexes, index);
                should.equal(index, expected_indexes[index]);
                return index;
            }), expected_indexes);
        },
        'the third argument is the number of remaining executions': function(){
            var expected_remaining = [3, 2, 1, 0];

            should.deepEqual((4).times(function(e, index, remaining){
                should.ifError(e);
                should.equal(remaining, expected_remaining[index]);
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
                should.deepEqual((3).times(function(e, index, remaining, this_time) {
                    should.deepEqual(expected[index], this_time);
                    return this_time;
                }), expected);
            }
        }
    }
}).export(module);
