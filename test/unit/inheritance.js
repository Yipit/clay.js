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

var models = require('clay');
var mock = new models.storage.Mechanism();

models.set_primary_storage(mock);

vows.describe('Model Inheritance').addBatch({
    'Given a model is declared': {
        topic: function () {
            return models.declare("Shape", function(it, kind){
                it.has.field("name", kind.alphanumeric);

                it.has.index("name");

                it.has.method('joinWithDash', function(what){
                    return [this.name, what].join('-')
                });

                it.has.class_method('dash', function(){
                    return '----dash----';
                });

            })
        },
        'and subclassed adding a new field': {
            topic: function(Shape) {
                return Shape.subclass("Circle", function(it, kind){
                    it.has.field("diameter", kind.numeric);
                    it.has.index("diameter");
                })
            },
            'the indexes are place': function(Circle) {
                assert.deepEqual(
                    Circle._meta.indexes,
                    ['name', 'diameter']
                );
            },
            'the declared field names are available': function(Circle) {
                assert.deepEqual(
                    Circle._meta.field.names,
                    ['name', 'diameter']
                );
            },
            'the declared field specs are available too': function(Circle) {
                assert.equal(
                    Circle._meta.field.definitions.name,
                    models.FieldKinds.alphanumeric
                );
                assert.equal(
                    Circle._meta.field.definitions.diameter,
                    models.FieldKinds.numeric
                );
            },
            'class methods': function(Circle) {
                assert.equal(
                    Circle.dash(),
                    '----dash----'
                );
            },
            'we can create instances that inherits from the parent class': {
                topic: function(Circle) {
                    var topic = this;
                    Circle.create({
                        name: 'circle',
                        diameter: 20
                    }, function(e, instance){
                        topic.callback(e, instance, Circle);
                    });
                },
                'so that it inherits the base fields': function(e, circle){
                    assert.equal(circle.name, 'circle');
                    assert.equal(circle.diameter, 20);
                },
                'instance methods': function(e, instance, Circle) {
                    assert.equal(
                        instance.joinWithDash("twenty"),
                        'circle-twenty'
                    );
                }
            }
        }
    }
}).export(module);