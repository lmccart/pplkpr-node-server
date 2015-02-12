var express = require('express');
var app = express();

var hr = 0;

app.get('/', function (req, res) {
  res.send('Hello World!')
})


app.get('/update_hr', function (req, res) {
  console.log(req.query);
  hr = parseInt(req.query.hr, 10);
  console.log(hr);
  res.send('thanks');
})


app.use(express.static(__dirname + '/public'));


app.set('port', process.env.PORT || 3000);

var server = app.listen(app.get('port'), function () {
  console.log('Example app listening at http://%s:%s', server.address().address, server.address().port);
});