s![logo](http://dl.dropbox.com/u/10561986/clay-logo.png)

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
    it.has.one("author", User, "builds");
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

```

# anatomy

Clay provides syntactic sugar function calls that will help you
declare models in a very classy, fashion and expressive way.

It is possible through the callback passed to the `models.declare`
call, and it has the arguments `it` and `kind`. These two will help
you out to declare your model.

## field types

Clay's field kinds are no more than just functions responsible to
transform and validate data.

You can implement your own field kind, or use the builtin kinds. They come with valitation out of the box:

### alphanumeric

shorthand for the regexp `/^[a-zA-z-0-9]+$/`

`USAGE:`


```javascript
var Foo = models.declare('Foo', function(it, kind){
    it.has.field('example', kind.alphanumeric);
});
```

### numeric

shorthand for the regexp `/^[0-9]+$/`
also returns an integer through `parseInt`

`USAGE:`


```javascript
var Foo = models.declare('Foo', function(it, kind){
    it.has.field('example', kind.numeric);
});
```

### email

shorthand for the regexp `/^\w+[@]\w+[.]\w{2,}$/`

`USAGE:`


```javascript
var Foo = models.declare('Foo', function(it, kind){
    it.has.field('example', kind.email);
});
```

### string

any string of any size, although it's trimmed

`USAGE:`


```javascript
var Foo = models.declare('Foo', function(it, kind){
    it.has.field('example', kind.string);
});
```

### slug

any string of any size, will me returned as a slug,
for example the input `Hello World` turns into `hello-world`

`USAGE:`

```javascript
var Foo = models.declare('Foo', function(it, kind){
    it.has.field('example', kind.slug);
});
```

### hashOf

Now this is cool :)

Let's say you want to have a password kind of field.

One of the ways to implement such thing is by concatenating with other
field value(s) and then hashed with md5 or sha1, right?

That is what the field kind `hashOf` does for you. Just declare on it
which fields must be ued in the concatenation, that will be done
automatically for you.

You can take a look
[on its unit tests](https://github.com/Yipit/clay.js/blob/master/test/unit/fields.js#L127)
to see how it works precisely, but here is an example:

```javascript
var u1 = new User({
    name: "John Doe",
    email: "example@email.com",
    password: '123'
});

assert.equal(u1.password, "f8543ecd4084527d7bc443f272a38c6390bbb7d6")
```

the password was already converted from `123` to
`f8543ecd4084527d7bc443f272a38c6390bbb7d6`, which is the `sha1` sum of
the string:

`John Doe|sha1-emerald|example@email.com|sha1-emerald|123`

## saving instances

```javascript
var assert = require('assert');

var lettuce_instructions = new BuildInstruction({
    name: 'Lettuce Unit Tests',
    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
    build_command: 'make unit'
});

lettuce_instructions.save(function(err, pk, model_instance, storage, redis_connection){
    assert.equal(pk, 'clay:BuildInstruction:id:1');
});
```
## relationships

Clay ["kind of support"](http://en.wikipedia.org/wiki/NoSQL) supports
one-to-many and many-to-one "relationships", in order to declare them
you can just use either: `it.has.one()` or `it.has.many()`
declaration.

Nevertheless there are two important things you must know about how
Clay leverages the relationship feature:

### 1. Relationships go through both lanes

In my opinion, a snippet is worth than words:

Supposing you have this declaration

```javascript
var Person = models.declare("Person", function(it, kind){
    it.has.field("name", kind.string);
});

var Belonging = models.declare("Belonging", function(it, kind){
    it.has.field("description", kind.string);
    it.has.one("owner", Person, "belongings");
});
```

This is telling Clay that *a Belonging has an owner*, as well as that *a Person has many belongings*

Technically speaking, it means that internally Clay will make the declaration above idempodent to the example below:


```javascript
var Belonging = models.declare("Belonging", function(it, kind){
    it.has.field("description", kind.string);
});
var Person = models.declare("Person", function(it, kind){
    it.has.field("name", kind.string);
    it.has.many("belonging", Person, "owner");
});
```

Now, ain't that so cool?

Now whenever you persist your data, as long as the dynamically
assigned objects were already persisted, their references will be kept
tracked by its related objects.

## behavior: methods and properties

Clay provides an object-oriented-friendly object declaration.

So as expected, you can define class-level methods, instance-level
methods, getters and setters.

Once again, using code to show the magic:

### class methods:

```javascript
var Animal = models.declare("Animal", function(it, kind){
    it.has.field("name", kind.string);
    it.has.field("sex", kind.string);
    it.has.class_method("create_male", function(name){
        return new this({sex: "male", name: name});
    });
});

// now you can do:

var leo = Animal.create_male("Lion");
assert.equal(leo.name, "Lion");
assert.equal(leo.sex, "male");

```


### instance methods:

```javascript
var Person = models.declare("Person", function(it, kind){
    it.has.field("name", kind.string);
    it.has.method("say_hello", function(){
        // yes, "this" is bound to the actual instance
        console.log("Hello, I am " + this.name);
    });
});

var john = new Person({name: "John Doe"});
john.say_hello();
```

would produce the output

```bash
Hello, I am John Doe
```

### getters:

```javascript
var BankAccount = models.declare("BankAccount", function(it, kind){
    it.has.field("balance", kind.numeric);
    it.has.getter("is_positive", function(){
        return this.balance > 0;
    });
    it.has.getter("is_negative", function(){
        return this.balance < 0;
    });
});

var red = new BankAccount({balance: -5000});
red.is_negative() // true

var green = new BankAccount({balance: 99});
green.is_positive() // true
```

would produce the output

```bash
Hello, I am John Doe
```

### setters:

```javascript
var Person = models.declare("Person", function(it, kind){
    it.has.field("first_name", kind.string);
    it.has.field("last_name", kind.string);
    it.has.setter("name", function(name){
        var parts = name.trim().split(/\s+/);
        if (parts.length == 2) {
            this.first_name = parts[0];
            this.last_name = parts[1];
        } else {
            this.first_name = name;
            this.last_name = "";
        }
    });
    it.has.getter("name", function(){
        return [this.first_name, this.last_name].join(' ');
    });

});

var john = new Person();
john.name = "John Doe";
assert.equal(john.first_name, "John");
assert.equal(john.last_name, "John");

## saving instances and its relationships

```javascript
var assert = require('assert');

var gabrielfalcao = new Build({
    name: 'Gabriel Falcão',
    email: 'gabriel@yipit.com',
    password: '123'
});
var b1 = new Build({
    status: 0,
    error: '',
    output: 'Worked!',
    author: gabrielfalcao
});
var b2 = new Build({
    status: 32,
    error: 'Failed!',
    output: 'OOps',
    author: gabrielfalcao
});

var lettuce_unit = new BuildInstruction({
    name: "Lettuce Unit Tests",
    repository_address: 'git://github.com/gabrielfalcao/lettuce.git',
    build_command: 'make unit',
    owner: gabrielfalcao,
    builds: [b1, b2]
});

gabrielfalcao.save(function(e, gabrielfalcao_pk){
    b1.save(function(e, b1_pk){
        b2.save(function(e, b2_pk){
            lettuce_unit.save(function(e4, lettuce_unit_pk){
                // from now on, whenever you fetch the
                // BuildInstruction 'Lettuce Unit Tests', the related objects
                // will be automatically fetched from the database
            });
        });
    });
});
```

## finding by id

```javascript
BuildInstruction.find_by_id(1, function(e, found){
    assert.equal(found.name, 'Lettuce Unit Tests');
    assert.equal(found.repository_address, 'git://github.com/gabrielfalcao/lettuce.git');

    assert.equal(
       "Will now build: {name}".render(found),
       "Will now build: Lettuce Unit Tests"
    );
});
```

## finding by any field

Clay attempts to be really simple to use, and for the sake of this
fact there is a lot of *magic* here.

When you declare any model with Clay, you have special class-methods
available right away.

In order to search by any declared field, all you need to do is call
`YourModel.find_by_fieldname`, where `YourModel` is the return of
`models.declare()` and `fieldname` is the name of any fields you have
declared. All of them will be available.

It takes just 2 parameters: the `RegExp` that will be used to match
against values and a callback.

The callback, takes 2 parameters: an error and an array with instances
of models.

## example

```javascript

var adam = new User({
    name: "Adam Nelson",
    email: "adam@yipit.com",
    password: '123'
});
adam.save(function(e, pk, instance){
    User.find_by_email(/yipit.com$/, function(e, found){
        assert.equal(found.length, 1);

        assert.equal(found.first.name, 'Adam Nelson');
        assert.equal(found.first.email, 'adam@yipit.com');
    });

```
# Hacking / Contributing


## 1. fork and clone the project
## 2. install [npm](http://npmjs.org)
## 3. install the dependencies with npm:

```bash
cd clay.js
npm install
```
## 4. install [Jake](https://github.com/mde/jake):

```bash
npm install -g jake
```

## 5. run the tests

```bash
jake unit
jake functional
```

**PS.:** *you need to have redis running in order to make the functional tests running*

## 6. send the pull request

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
