var connect = require('connect');

var s = connect.createServer();

s.use('/', function (req, res, next) {
      res.end("I'm out of coffee")
});

s.listen(40000);
