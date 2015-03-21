
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

  eval_people();
  setInterval(eval_people, 3000);
});

// CONFIG MULTER
var uploaded = false;
app.use(multer({ dest: './public/uploads/',
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


var emotions = ['Angry', 'Calm', 'Bored', 'Excited', 'Aroused', 'Anxious', 'Scared'];
var leaders = {};

app.get('/add_report', function (req, res) {
  console.log(req.query);

  get_person(req.query.name, req.query.number, function(id) {   

    if (id) {
      var r = {
        person: id,
        name: req.query.name,
        number: req.query.number,
        emotion: req.query.emotion,
        value: parseFloat(req.query.value),
        timestamp: new Date().getTime()
      };

      reports.insert(r, function(err, result) {
        assert.equal(err, null);
        console.log('inserted report');
      });
      res.send('successful');
    } else {
      res.send('person not found');
    }
   
  });
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

app.get('/get_leader', function (req, res) {
  var e = req.query.emotion;
  if (leaders[e]) {
    people.findOne({_id: leaders[e]}, function(err, doc) {
      if (doc) res.send(doc);
      else res.send({});
    });
  }
});


app.get('/get_leaders', function (req, res) {
  res.send(leaders);
});

app.get('/normalize', function (req, res) {
  people.find().each(function(err, item) {
    if(item) {
      item.normalized_name = normalize_name(item.name);
      item.normalized_number = normalize_number(item.number);
      people.save(item, function() {});
    }
  });
  reports.find().each(function(err, item) {
    if(item) {
      item.normalized_name = normalize_name(item.name);
      item.normalized_number = normalize_number(item.number);
      reports.save(item, function() {});
    }
  });
  res.send('done');
});

function normalize_name(name) {
  // remove diacritics
  // convert to lowercase
  // remove spaces
  // remove vowels (?)
  return name;
}

function normalize_number(number) {
  // remove non-numbers except + and space
  // remove international call prefix (+, 00, 011, 010, 0011) followed by country code
  // remove all remaining non-numbers
  return number;
}

function get_person(name, num, cb) {
  // first match by number
  // if no results, match by name
  // if no results, return cb()
  people.findOne({name: name}, function(err, doc) {
    if (doc) cb(doc._id);
    else cb();
  });
}

function eval_people() {
  // for each emotion find maxs, store somehow
  emotions.forEach(function(e, ind) {
    var scores = {};
    var people = [];

    reports.find({emotion: e}).toArray(function(err, docs) {
      // first add up all vals and track unique people
      for (var j=0; j<docs.length; j++) {
        var p = docs[j].person;
        if (!scores[p]) {
          scores[p] = docs[j].value;
          people.push(p);
        } else {
          scores[p] += docs[j].value;
        }
      }
      // sort people list
      people.sort(function(a, b) { return scores[b] > scores[a] ? 1 : -1; });

      // set leader
      leaders[e] = people.length > 0 ? people[0] : null;
    });   
  });
}
