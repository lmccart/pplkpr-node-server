var express = require('express');
var app = express();

var hr = 0;

app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.get('/update_hr', function (req, res) {
  hr = parseFloat(req.query.hr);
  console.log(hr);
})


app.use(express.static(__dirname + '/public'));


var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

})