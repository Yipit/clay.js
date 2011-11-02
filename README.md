# clay.js
> version 1.0.0

# What

Clay is a lightweight active record for Node.js applications.  It
leverages the effort of declaring models and its relationships, and
store them in any backend.

Clay comes with builtin support for [Redis](http://redis.io) but has a
very simple interface with storage mechanisms, so that you can write
your own backend.

# Hands On !

## installation

```bash
npm install clay
```

## declaration

the example below was extracted from
[emerald](http://github.com/Yipit/emerald)'s codebase

```javascript
var redis = require('redis').createConnection();
var models = require('clay');

var User = models.declare("User", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("email", kind.email);
    it.has.field("password", kind.hashOf(["name", "email"]));
    it.has.method('greet', function() {
        return [
            "Hello, my name is ", this.name, ", it's nice to meet you"
        ].join('');
    });
});

var Build = models.declare("Build", function(it, kind){
    it.has.field("status", kind.numeric);
    it.has.field("error", kind.string);
    it.has.field("output", kind.string);
});
var BuildInstruction = models.declare("BuildInstruction", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("repository_address", kind.string);
    it.has.field("build_command", kind.string);
    it.validates.uniquenessOf("name");
    it.has.index("repository_address");
    it.has.many("builds", Build, "instruction");
    it.has.one("owner", User, "created_instructions");
});

var lettuce_instructions = new BuildInstruction({
    name: 'Lettuce Unit Tests',
    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
    build_command: 'make unit'
});

lettuce_instructions.save(function(err, pk, model_instance, storage, redis_connection){
    assert.equal(pk, 'clay:BuildInstruction:id:1')
});
```

# License

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
    OTHER DEALINGS IN THE SOFTWARE.
