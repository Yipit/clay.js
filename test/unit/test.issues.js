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

describe('Models', function(){
    describe('can be declared sequentially', function(){
        it('and keep their spec sandboxed', function(){
            Foo._meta.name.should.equal('Foo');
            Bar._meta.name.should.equal('Bar');
        });
    });
    it('complains when declared fields have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.field('some field', kind.string);
            });
        }
        should.throws(our_hope_away, models.FieldValidationError);
        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a field with a bad name: "some field". In those cases use just numbers, letters and underscore');
        }
    });
    it('complains when declared indexes have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.index('some field', kind.string);
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies an index with a bad name: "some field". In those cases use just numbers, letters and underscore');
        }
    });
    it('complains when declared methods have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.method('some method', function(){});
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a method with a bad name: "some method". In those cases use just numbers, letters and underscore');
        }
    });
    it('complains when declared class methods have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.class_method('some class method', function(){});
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a class method with a bad name: "some class method". In those cases use just numbers, letters and underscore');
        }
    });
    it('complains when declared class methods have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.class_method('some class method', function(){});
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a class method with a bad name: "some class method". In those cases use just numbers, letters and underscore');
        }
    });
    it('complains when declared one to many relationships have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.one('some rel', function(){});
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a relationship with a bad name: "some rel". In those cases use just numbers, letters and underscore');
        }
    })
    it('complains when declared many to one relationships have bad names', function(){
        var our_hope_away = function(){
            var Wicked = models.declare("Wicked", function(it, kind){
                it.has.many('some rel', function(){});
            });
        }

        should.throws(our_hope_away, models.FieldValidationError);

        try {
            our_hope_away();
        } catch (e) {
            e.message.should.equal('The declaration of the model "Wicked" specifies a relationship with a bad name: "some rel". In those cases use just numbers, letters and underscore');
        }
    });
});
