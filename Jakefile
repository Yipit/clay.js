var colors = require("colors");
var child_process = require("child_process");

process.env['NODE_PATH'] = process.env['NODE_PATH'] + ':' + __dirname + '/../';

var run_tests = function(kind, pattern) {
    command = './node_modules/vows/bin/vows --spec test/' + kind + '/' + (pattern || '') + '*';

    var test = child_process.exec(command, {env: process.env}, function(error, stdout, stderr){
        console.log(stdout.toString());
        console.log(stderr.toString());
    });
    test.on('exit', function(code, signal){
        process.on('exit', function () {
            process.reallyExit(code);
        });
    });
}

desc('run all tests');
task('default', [], function (pattern) {
    run_tests('{unit,functional}', pattern)
});

['unit', 'functional'].forEach(function (val, index, array){
    desc('run only ' + val + ' tests');
    task(val, [], function (pattern) { run_tests(val, pattern)});
});
