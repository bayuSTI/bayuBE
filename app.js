var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var redis = require('redis');
var jwt = require('jsonwebtoken');
var fs = require('fs');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const client = redis.createClient(process.env.REDIS_URL);

client.on('error', (err) => {
  console.log("Error " + err);
});

mongoose.connect('mongodb+srv://root:root@cluster0-9h65s.gcp.mongodb.net/bayu?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('mongoose is connected');
});

const emp = mongoose.model('employee', {
  name: String,
  gender: String,
  address: String
});

app.get('/employee', isAuthorized, function (req, res, next) {
  //res.send('respond with a resource');
  const employeeKey = 'user:employee';
  //client.del(employeeKey);
  return client.get(employeeKey, (err, employee) => {
    if (employee) {
      return res.json({ source: 'cache', message: "Get Employee", data: JSON.parse(employee) })
    } else {
      emp.find(function (err, employee) {
        client.setex(employeeKey, 3600, JSON.stringify(employee))
        res.send({
          source: "db",
          message: "Get Employee",
          data:employee
        });
      }).catch(error => {
        console.log(error)
        return res.json(error.toString())
      });
    }
  });
});

app.post('/employee', isAuthorized, function (req, res, next) {
  emp.create(req.body).then(function (employee) {
    res.send({
      message: "Employee data saved",
      data:employee
    });
    client.del('user:employee');
  }).catch(next);
});

app.put('/employee/:id', isAuthorized, function (req, res, next) {
  emp.findOneAndUpdate({ _id: req.params.id }, req.body).then(function () {
    emp.findOne({ _id: req.params.id }).then(function (employee) {
      res.send({
        message: "Employee data updated",
        data:employee
      });
      client.del('user:employee');
    })
  })
});

app.delete('/employee/:id', isAuthorized, function (req, res, next) {
  emp.findByIdAndRemove({ _id: req.params.id }, req.body).then(function () {
    res.send({message:'Delete success'});
    client.del('user:employee');
  })
});

app.get('/jwt', (req, res) => {
  let privateKey = fs.readFileSync('./private.pem', 'utf8');
  let token = jwt.sign({ "body": "stuff" }, privateKey, { algorithm: 'HS256' });
  res.send(token);
})

function isAuthorized(req, res, next) {
  if (typeof req.headers.authorization !== "undefined") {
    // retrieve the authorization header and parse out the
    // JWT using the split function
    let token = req.headers.authorization.split(" ")[1];
    let privateKey = fs.readFileSync('./private.pem', 'utf8');
    // Here we validate that the JSON Web Token is valid and has been 
    // created using the same private pass phrase
    jwt.verify(token, privateKey, { algorithm: "HS256" }, (err, user) => {

      // if there has been an error...
      if (err) {
        // shut them out!
        res.status(500).json({ error: "Not Authorized" });
        throw new Error("Not Authorized");
      }
      // if the JWT is valid, allow them to hit
      // the intended endpoint
      return next();
    });
  } else {
    // No authorization header exists on the incoming
    // request, return not authorized and throw a new error 
    res.status(500).json({ error: "Not Authorized" });
    throw new Error("Not Authorized");
  }
}

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
