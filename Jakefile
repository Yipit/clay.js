var sys = require("sys");
var colors = require("colors");
var child_process = require("child_process");

var testKinds = ['unit', 'functional'];

var run_command = function(command){
    var failed = false;
    process.env['NODE_MODULES'] = process.env['NODE_MODULES'] + ':' + __dirname + '../';

    child_process.exec(command, {env: process.env}, function(error, stdout, stderr){
            console.log(stdout.toString());
            console.log(stderr.toString());
        if (error) {
            failed = true;
            console.log("process exited with status:".bold.red, (""+error.code).bold);
        } else {
            console.log("======================================================".bold.blue)
            console.log("It's all green duuuude! yay \o/\n\n".bold.green)
        }
    });
    return !failed;

}

var runTest = function(kind) {
    run_command('./node_modules/vows/bin/vows --spec test/' + kind + '/*');
}

desc('run all tests');
task('default', [], function () {
    run_command('./node_modules/vows/bin/vows --spec test/{unit,functional}/*');
});

testKinds.forEach(function (val, index, array){
    desc('run only ' + val + ' tests');
    task(val, [], function () { runTest(val)});
});

