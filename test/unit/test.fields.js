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

var assert = require('assert'),
    crypto = require('crypto');

var models = require('../../lib/clay');


describe('Model field kinds', function(){
    describe('strings', function(){
        it('accepts anything', function(){
            assert.equal(
                models.FieldKinds.string(null, null, 1234567),
                "1234567"
            );
        });
    });
    describe('"auto" fields', function() {
        it('self-assigns the current unit timestamp', function(){
            assert.equal(
                models.FieldKinds.auto(null, null, null),
                (new Date()).getTime()
            );
        });
        it('ignores when a parameter is passed', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.auto(null, null, "Tue, 22 Nov 2011 06:32:43 GMT"),
                    (new Date()).getTime()
                );
            }, models.FieldValidationError);
        });
    });

    describe('datetime', function() {
        it('self-assigns the current unit timestamp', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.datetime(null, null, "Tue, 22 Nov 2011 06:32:43 GMT").toUTCString(),
                    "Tue, 22 Nov 2011 06:32:43 GMT"
                );
            }, models.FieldValidationError);
        });
    });

    describe('slug', function() {
        it('accepts string', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.slug(null, null, "Gabriel Falcão"),
                    "gabriel-falcao"
                );
            }, models.FieldValidationError);
        });
    });

    describe('alphanumeric', function() {
        it('accepts numbers', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.alphanumeric(null, null, "1234567"),
                    "1234567"
                );
            }, models.FieldValidationError);
        });
        it('accepts letters', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.alphanumeric(null, null, "abcDEF"),
                    "abcDEF"
                );
            }, models.FieldValidationError);
        });
        it('accepts letters and numbers', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.alphanumeric(null, null, "123abcDEF"),
                    "123abcDEF"
                );
            }, models.FieldValidationError);
        });
        it('does not accept symbols', function(){
            assert.throws(function() {
                models.FieldKinds.alphanumeric(null, null, "@%^&*asda213");
            }, models.FieldValidationError);

            assert.throws(function(){
                models.FieldKinds.alphanumeric(null, null, "@%ˆ&*asda213");
            }, /"[@][%][^][&][*][a][s][d][a][2][1][3]" is not a valid alphanumeric/);
        });
    });

    describe('email', function() {
        it('accepts a valid email address', function(){
            assert.doesNotThrow(function(){
                var processedEmail = models.FieldKinds.email(null, null, "gabriel@lettuce.it");
                assert.equal(
                    processedEmail,
                    "gabriel@lettuce.it"
                );
            }, models.FieldValidationError);

        });
        it('complains on an address without "@"', function(){
            assert.throws(function(){
                var processedEmail = models.FieldKinds.email(null, null, "gabriellettuce.it");
            }, models.FieldValidationError);
        });
        it('complains on an address without "extension"', function(){
            assert.throws(function(){
                var processedEmail = models.FieldKinds.email(null, null, "gabriel@lettuce");
            }, models.FieldValidationError);
        });
    });

    describe('numeric', function() {
        it('accepts numbers', function(){
            assert.doesNotThrow(function(){
                assert.equal(
                    models.FieldKinds.numeric(null, null, "1234567"),
                    "1234567"
                );
            }, models.FieldValidationError);
        });
        it('accepts ONLY numbers', function(){
            assert.throws(function(){
                models.FieldKinds.numeric(null, null, "asda213");
            }, models.FieldValidationError);

            assert.throws(function(){
                models.FieldKinds.numeric(null, null, "asda213");
            }, /"[a][s][d][a][2][1][3]" is not a valid number/);
        });
    });
});
