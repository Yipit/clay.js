var _ = require('underscore')._;

var redis_storage = require('./storage/redis');

module.exports = _.extend(
    module.exports,
    require('./storage/mechanism'),
    redis_storage,
    {
        primary: redis_storage.RedisMechanism,
        default: new redis_storage.RedisMechanism()
    }
);
