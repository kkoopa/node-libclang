var lib = require('./dynamic_clang');
var ref = require('ref');
var ArrayType = require('ref-array');

var Location = require('./location');
var TokenList = require('./tokenlist');

var TokenArray = ArrayType(lib.CXToken);

var Range = function (instance) {
  'use strict';

  if (!(this instanceof Range))
    return new Range(instance);

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

  this.tokenize = function (tu) {
    var tokens = ref.alloc(ref.refType(lib.CXToken)),
        count = ref.alloc(ref.types.uint32);
    lib.libclang.clang_tokenize(tu._instance, this._instance, tokens, count);
    console.log(tokens);
    console.log(tokens.deref());
    return new TokenList(tu, new TokenArray(ref.reinterpret(tokens.deref(), count.deref() * lib.CXToken.size, 0)));
  };
};

module.exports = Range;
