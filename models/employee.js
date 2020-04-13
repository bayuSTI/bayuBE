var mongoose = require('mongoose');
const emp = mongoose.model('employee', {
    name: String,
    gender: String,
    address: String,
    division: String,
    position: String
  });
  module.exports = emp;