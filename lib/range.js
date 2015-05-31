var lib = require('./dynamic_clang');
var util = require('./util');
var ref = require('ref');

var Location = require('./location')

var Range = function (instance) {
  if (!(this instanceof Range))
    return new Range(instance)

  this._instance = instance;

  Object.defineProperty(this, 'start', {
    get: function () {
      return new Location(lib.libclang.clang_getRangeStart(this._instance));
    }
  });

  Object.defineProperty(this, 'end', {
    get: function () {
      return new Location(lib.libclang.clang_getRangeEnd(this._instance));
    }
  });
};

module.exports = Range;
