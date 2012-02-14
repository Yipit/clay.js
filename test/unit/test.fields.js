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
, crypto = require('crypto');

var models = require('clay');


describe('Model field kinds', function(){
    describe('strings', function(){
        it('should accept anything', function(){
            should.equal(
                models.FieldKinds.string(null, null, 1234567),
                "1234567"
            );
        });
    });
    describe('"auto" fields', function() {
        it('should self-assign the current unit timestamp', function(){
            should.equal(
                models.FieldKinds.auto(null, null, null),
                (new Date()).getTime()
            );
        });
        it('should ignore when a parameter is passed', function(){
            should.doesNotThrow(function(){
                should.equal(
                    models.FieldKinds.auto(null, null, "Tue, 22 Nov 2011 06:32:43 GMT"),
                    (new Date()).getTime()
                );
            }, models.FieldValidationError);
        });
    });

    // 'date takes a string and returns a date object': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.datetime(null, null, "Tue, 22 Nov 2011 06:32:43 GMT").toUTCString(),
    //             "Tue, 22 Nov 2011 06:32:43 GMT"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'slug accepts string': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.slug(null, null, "Gabriel Falcão"),
    //             "gabriel-falcao"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'alphanumeric accepts numbers': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.alphanumeric(null, null, "1234567"),
    //             "1234567"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'alphanumeric accepts letters': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.alphanumeric(null, null, "abcDEF"),
    //             "abcDEF"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'alphanumeric accepts letters and numbers': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.alphanumeric(null, null, "123abcDEF"),
    //             "123abcDEF"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'alphanumeric does not accept symbols': function(kinds) {
    //     should.throws(function(){
    //         models.FieldKinds.alphanumeric(null, null, "@%^&*asda213"),
    //         null
    //     }, models.FieldValidationError);

    //     should.throws(function(){
    //         models.FieldKinds.alphanumeric(null, null, "@%ˆ&*asda213"),
    //         null
    //     }, /"[@][%][^][&][*][a][s][d][a][2][1][3]" is not a valid alphanumeric/);
    // },
    // 'email accepts a valid email': function(kinds) {
    //     should.doesNotThrow(function(){
    //         var processedEmail = models.FieldKinds.email(null, null, "gabriel@lettuce.it");
    //         should.equal(
    //             processedEmail,
    //             "gabriel@lettuce.it"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'email complains on invalid email without "@"': function(kinds) {
    //     should.throws(function(){
    //         var processedEmail = models.FieldKinds.email(null, null, "gabriellettuce.it");
    //     }, models.FieldValidationError);
    // },
    // 'email complains on invalid email without extension': function(kinds) {
    //     should.throws(function(){
    //         var processedEmail = models.FieldKinds.email(null, null, "gabriel@lettuce");
    //     }, models.FieldValidationError);
    // },
    // 'numeric accepts numbers': function(kinds) {
    //     should.doesNotThrow(function(){
    //         should.equal(
    //             models.FieldKinds.numeric(null, null, "1234567"),
    //             "1234567"
    //         );
    //     }, models.FieldValidationError);
    // },
    // 'numeric accepts *ONLY* numbers': function(kinds) {
    //     should.throws(function(){
    //         models.FieldKinds.numeric(null, null, "asda213"),
    //         null
    //     }, models.FieldValidationError);

    //     should.throws(function(){
    //         models.FieldKinds.numeric(null, null, "asda213"),
    //         null
    //     }, /"[a][s][d][a][2][1][3]" is not a valid number/);
    // }
})