var sys = require("sys");
var colors = require("colors");
var child_process = require("child_process");

var testKinds = ['unit', 'functional'];

var run_tests = function(kind){
    var failed = false,
    command = './node_modules/vows/bin/vows --spec test/' + kind + '/*';

    process.env['NODE_PATH'] = process.env['NODE_PATH'] + ':' + __dirname + '/../';
    var test = child_process.exec(command, {env: process.env}, function(error, stdout, stderr){
        console.log(stderr.toString());
        console.log(stdout.toString());
    });
    test.on('exit', function(code, signal){
        process.on('exit', function () {
            process.reallyExit(code);
        });
    });
}

var runTest = function(kind) {

}

desc('run all tests');
task('default', [], function () {
    run_tests('{unit,functional}')
});

testKinds.forEach(function (val, index, array){
    desc('run only ' + val + ' tests');
    task(val, [], function () { run_tests(val)});
});