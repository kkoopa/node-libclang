var lib = require('./dynamic_clang');

var Location = require('./location');
var Range = require('./range');

var util = require('./util');

var Token = function (tu, instance) {
  'use strict';

  if (!(this instanceof Token))
    return new Token(tu, instance);

  this._instance = instance;
  this._tu = tu;

  Object.defineProperty(this, 'kind', {
    get: function () {
      return lib.libclang.clang_getTokenKind(this._instance);
    }
  });

  Object.defineProperty(this, 'spelling', {
    get: function () {
      return util.toString(lib.libclang.clang_getTokenSpelling(this._tu._instance, this._instance));
    }
  });

  Object.defineProperty(this, 'location', {
    get: function () {
      return new Location(lib.libclang.clang_getTokenLocation(this._tu._instance, this._instance));
    }
  });

  Object.defineProperty(this, 'extent', {
    get: function () {
      return new Range(lib.libclang.clang_getTokenExtent(this._tu._instance, this._instance));
    }
  });
};

Object.keys(lib.CONSTANTS.CXTokenKind).forEach(function (key) {
  'use strict';
  var arr = key.split('_');
  if (arr.length === 2)
    Token[arr[1]] = lib.CONSTANTS.CXTokenKind[key];
});

module.exports = Token;
