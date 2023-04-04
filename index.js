const express = require('express')
const cors = require('cors')
require('dotenv').config()
const mongo = require('mongodb');
const mongoose = require('mongoose')
const moment = require('moment');
const mongoUrl = process.env['MONGO_URL']
const app = express()
app.use(cors())

mongoose.connect( mongoUrl, {dbName: 'exercise_tracker'} )
  .catch(err => console.log("err conecting", err));

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// --- Schemas ---
const exerciseSchema = new mongoose.Schema({
  username: {
      type: String,
      required: true
  },
  description: {
      type: String,
      required: true
  },
  duration: {
      type: Number,
      required: true
  },
  date: {
      type: String,
      //default: Date.now()
  }
}, {collection: 'Exercises'});

const userSchema = new mongoose.Schema({
  username: {
      type: String,
      required: true
  }
}, { collection: 'Users' });

const logSchema = new mongoose.Schema({
  userId: {
    type: String
  },
  totalCount: {
    type: Number
  },
  logs: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Exercise'
  }
}, {collection: 'Logs'})

// --- End Schemas ---

// --- Models ---
const Exercise = mongoose.model('Exercise', exerciseSchema);
const User = mongoose.model('User', userSchema);
const Log = mongoose.model('Log', logSchema);
// --- End Models ---



app.post('/api/users', (req, res) => {
  let { username } = req.body
  User.findOne({ username }).then(userName => {
    if (userName) throw new Error('username already taken');  
    let user = new User( req.body )
    user.save((err, data) => {
      res.json(data)
    })  
  })
})

app.get('/api/users', (req, res) => {
  User.find((err, data) => {
    //console.log("flag")
    res.json(data)
  })
})

app.post('/api/users/:_id/exercises', function(req, resPost) {
  let userId = req.params._id
  let { description, duration, date } = req.body;
  date = date || Date.now()
  date = moment(date).format('ddd MMM DD YYYY')
  User.findById(req.params._id, (req, res) => {
    let user = res.username
    let args = {
      username: user, description: description,
      duration: duration, date: date
    }    
    exercise = new Exercise(args)
    exercise.save((err, data) => {
      const exerciseObject = {
        "_id": userId,
        "username": data.username,
        "date": data.date,
        "duration": data.duration,
        "description": data.description
      };
      saveLog(userId, data._id);
      resPost.json(exerciseObject);
    })    
  })
})

function saveLog(userId, exerciseId) {
  Log.count({userId: userId}, (req,res) => {
    if (res == 0) {
      let dataToSave = {userId: userId, totalCount: 1, logs: [exerciseId]}
      let log = new Log(dataToSave)
      log.save((err, data) => {})
    } else {
      Log.findOne({userId: userId}, (err, data) => {
        if (err) throw new exception("Error")
        let logs = data.logs
        let count = ++data.totalCount
        logs.push(exerciseId)
        Log.updateOne({userId: userId}, {totalCount: count, logs: logs}, (err, dataUpdated) => {});
      })
    }
  })
}

app.get('/api/users/:_id/logs', async function (reqGet, resGet) {
  let userId = reqGet.params._id;
  var fromDate = reqGet.query.from;
  var toDate = reqGet.query.to;
  var limit = reqGet.query.limit;
  
  let log = await Log.findOne({userId: userId})
  let logs = []
  log.logs.forEach(l => logs.push(l.toString()))  
  
  let user = await User.findById(userId)

  var findFilter = {};
  var dateFilter = {};
  if (fromDate) {
    dateFilter["$gte"] = fromDate;
    if (toDate) {
      dateFilter["$lt"] = toDate;
    } else {
      dateFilter["$lt"] = Date.now();
    }
  }
  if (toDate) {
    dateFilter["$lt"] = toDate;
    dateFilter["$gte"] = new Date("1960-01-01");
  }
  if (toDate || fromDate) {
    findFilter.date = dateFilter;
  }

  let count = await Exercise.count(findFilter)
  console.log("Count", count)
  let exercise = await Exercise.find({'_id' : logs}).limit(limit).exec();
  console.log("Exercise", exercise)

  const logToReturn = {
    username: user.username,
    count: log.totalCount,
    _id: userId,
    log: exercise
  }
  resGet.json(logToReturn)

})
  

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
