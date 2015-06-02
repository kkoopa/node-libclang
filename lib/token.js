var lib = require('./dynamic_clang');
var util = require('./util');
var ref = require('ref');

var Location = require('./location')
var Range = require('./range')

var Token = function (instance, tu) {
  if (!(this instanceof Token))
    return new Token(instance, tu)

  this._instance = instance;
  this._tu = tu;

  Object.defineProperty(this, 'kind', {
    get: function () {
      return lib.libclang.clang_getTokenKind(this._instance);
    }
  });

  Object.defineProperty(this, 'spelling', {
    get: function () {
      return lib.libclang.clang_getTokenSpelling(this._tu, this._instance);
    }
  });

  Object.defineProperty(this, 'location', {
    get: function () {
      return new Location(lib.libclang.clang_getTokenLocation(this._tu, this._instance));
    }
  });

  Object.defineProperty(this, 'extent', {
    get: function () {
      return new Range(lib.libclang.clang_getTokenExtent(this._tu, this._instance));
    }
  });
};

module.exports = Token;
