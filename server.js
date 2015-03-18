
var multer = require('multer');
var express = require('express');
var app = express();
app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);
server.listen(app.get('port'));
console.log('Listening on '+app.get('port'));

// CONFIG MONGO
var MongoClient = require('mongodb').MongoClient
var assert = require('assert');
var reports, people;

MongoClient.connect(process.env.MONGOLAB_URI, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to mongodb");
  reports = db.collection("reports");
  people = db.collection("people");
});

// CONFIG MULTER
var uploaded = false;
app.use(multer({ dest: './uploads/',
  rename: function (fieldname, filename) {
    return filename;
  },
  onFileUploadStart: function (file) {
    console.log(file.originalname + ' is starting ...')
  },
  onFileUploadComplete: function (file) {
    console.log(file.fieldname + ' uploaded to  ' + file.path);
  }
}));


app.get('/add_report', function (req, res) {
  console.log(req.query);

  get_person(req.query.name, req.query.number, function(id) {   

    var r = {
      person: id,
      emotion: req.query.emotion,
      value: parseFloat(req.query.value),
      timestamp: new Date().getTime()
    }

    reports.insert(r, function(err, result) {
      assert.equal(err, null);
      console.log('inserted report');
      //callback(result);
    });
   
  });
  res.send('thanks');
})

app.post('/add_person',function(req,res){
  console.log(req.body.name);
  var p = {
    name: req.body.name,
    number: req.body.number,
    photo: req.body.filename
  }

  people.insert(p, function(err, result) {
    assert.equal(err, null);
    console.log('inserted person');
    //callback(result);
  });
  res.send('thanks');
});

app.get('/get_emotion', function (req, res) {
  var e = req.query.emotion;
  res.send({name: n, pic: p}); 
});

function get_person(name, num, cb) {
  // find person or kill
  var id = 0; // pend
  cb(id);
}

function eval_people() {
  // for each emotion find maxs, store somehow
}

