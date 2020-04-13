var redis = require('redis');
var mongoose = require('mongoose');


var controller = function(){};

mongoose.connect('mongodb+srv://root:root@cluster0-9h65s.gcp.mongodb.net/bayu?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.on('connected', () => {
  console.log('mongoose is connected');
});

const emp = require('../models/employee');

const client = redis.createClient(process.env.REDIS_URL);

client.on('error', (err) => {
  console.log("Error " + err);
});

controller.find = function (req, res, next) {
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
  };
  
  controller.add = function (req, res, next) {
    emp.create(req.body).then(function (employee) {
      res.send({
        message: "Employee data saved",
        data:employee
      });
      client.del('user:employee');
    }).catch(next);
  };
  
  controller.edit = function (req, res, next) {
    emp.findOneAndUpdate({ _id: req.params.id }, req.body).then(function () {
      emp.findOne({ _id: req.params.id }).then(function (employee) {
        res.send({
          message: "Employee data updated",
          data:employee
        });
        client.del('user:employee');
      })
    })
  };
  
  controller.delete = function (req, res, next) {
    emp.findByIdAndRemove({ _id: req.params.id }, req.body).then(function () {
      res.send({message:'Delete success'});
      client.del('user:employee');
    })
  };

  module.exports = controller;