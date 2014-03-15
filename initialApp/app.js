var connect = require('connect');

var s = connect.createServer();

s.use('/', function (req, res, next) {
      res.end("Hello world.");
});

s.listen(process.env.PORT || 3000);
