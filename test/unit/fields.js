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
, crypto = require('crypto');

var models = require('../../lib/clay');


vows.describe('Model fields').addBatch({
    'have builtin kinds': {
        topic: function () {
            return models.FieldKinds;
        },
        'string accepts anything': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.string(null, null, 1234567),
                    "1234567"
                );
            }, models.FieldValidationError);
        },
        '*"auto"* assigns the current *date/time*': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.auto(null, null, null),
                    (new Date()).toString()
                );
            }, models.FieldValidationError);
        },
        '*"auto"* should ignore a valid date string': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.auto(null, null, "Tue, 22 Nov 2011 06:32:43 GMT").toUTCString(),
                    (new Date()).toUTCString()
                );
            }, models.FieldValidationError);
        },
        'date takes a string and returns a date object': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.datetime(null, null, "Tue, 22 Nov 2011 06:32:43 GMT").toUTCString(),
                    "Tue, 22 Nov 2011 06:32:43 GMT"
                );
            }, models.FieldValidationError);
        },
        'slug accepts string': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.slug(null, null, "Gabriel Falcão"),
                    "gabriel-falcao"
                );
            }, models.FieldValidationError);
        },
        'alphanumeric accepts numbers': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.alphanumeric(null, null, "1234567"),
                    "1234567"
                );
            }, models.FieldValidationError);
        },
        'alphanumeric accepts letters': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.alphanumeric(null, null, "abcDEF"),
                    "abcDEF"
                );
            }, models.FieldValidationError);
        },
        'alphanumeric accepts letters and numbers': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.alphanumeric(null, null, "123abcDEF"),
                    "123abcDEF"
                );
            }, models.FieldValidationError);
        },
        'alphanumeric does not accept symbols': function(kinds) {
            assert.throws(function(){
                kinds.alphanumeric(null, null, "@%^&*asda213"),
                null
            }, models.FieldValidationError);

            assert.throws(function(){
                kinds.alphanumeric(null, null, "@%ˆ&*asda213"),
                null
            }, /"[@][%][^][&][*][a][s][d][a][2][1][3]" is not a valid alphanumeric/);
        },
        'email accepts a valid email': function(kinds) {
            assert.doesNotThrow(function(){
                var processedEmail = kinds.email(null, null, "gabriel@lettuce.it");
                assert.equal(
                    processedEmail,
                    "gabriel@lettuce.it"
                );
            }, models.FieldValidationError);
        },
        'email complains on invalid email without "@"': function(kinds) {
            assert.throws(function(){
                var processedEmail = kinds.email(null, null, "gabriellettuce.it");
            }, models.FieldValidationError);
        },
        'email complains on invalid email without extension': function(kinds) {
            assert.throws(function(){
                var processedEmail = kinds.email(null, null, "gabriel@lettuce");
            }, models.FieldValidationError);
        },
        'numeric accepts numbers': function(kinds) {
            assert.doesNotThrow(function(){
                assert.equal(
                    kinds.numeric(null, null, "1234567"),
                    "1234567"
                );
            }, models.FieldValidationError);
        },
        'numeric accepts *ONLY* numbers': function(kinds) {
            assert.throws(function(){
                kinds.numeric(null, null, "asda213"),
                null
            }, models.FieldValidationError);

            assert.throws(function(){
                kinds.numeric(null, null, "asda213"),
                null
            }, /"[a][s][d][a][2][1][3]" is not a valid number/);
        },
        'hashOf': {
            topic: function(){
                this.callback(null, models.FieldKinds.hashOf(["name", "id"]));
            },
            'get the values from a given object for the given keys': function(hasher) {
                var Stub = models.declare("Stub", function(it, kind){
                    it.has.field("name", kind.alphanumeric);
                    it.has.field("id", kind.numeric);
                });

                var stub = new Stub({name: "gabriel", id: 42}, Stub);

                assert.equal(
                    stub._meta.get_key(['name', 'id'], 'some-other-value'),
                    'gabriel|sha1-clay|42|sha1-clay|some-other-value'
                )
            }
        }
    }
}).export(module);
