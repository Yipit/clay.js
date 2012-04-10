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

var util = require('util'),
    _ = require('underscore')._,
    crypto = require('crypto');

var models = require('../../lib/clay');

describe('Storage mechanisms', function(){
    it('supports specifying a storage mechanism when you declaring a model', function(){
        function FakeMechanism() { models.storage.Mechanism.call(this); }
        util.inherits(FakeMechanism, models.storage.Mechanism);

        var fake_mechanism = new FakeMechanism();

        var User = models.declare('User', function (it, kind){
            it.has.field("name", kind.string);
            it.is_stored_with(fake_mechanism);
        });

        User._meta.storage.should.equal(fake_mechanism);
    });
    it('is possible to set the default/global storage mechanism', function(){
        function FakeMechanismTwo(){ models.storage.Mechanism.call(this); }
        util.inherits(FakeMechanismTwo, models.storage.Mechanism);

        var fake2 = new FakeMechanismTwo();

        models.set_primary_storage(fake2);

        var Build = models.declare('Build', function (it, kind){
            it.has.field("name", kind.string);
        });
        Build._meta.storage.should.equal(fake2, Build._meta.storage);
    });
    it('defaults to the redis storage mechanism', function(){
        models.storage.default.should.be.an.instanceof(models.storage.RedisMechanism);
    });
});
