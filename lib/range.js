var lib = require('./dynamic_clang');
var util = require('./util');
var ref = require('ref');
var ArrayType = require('ref-array');

var Location = require('./location')
var TokenList = require('./tokenlist');

var TokenArray = ArrayType(lib.CXToken);

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

  this.tokenize = function (tu) {
    var tokens = new TokenArray(),
        count = ref.types.uint32;
    lib.libclang.clang_tokenize(tu._instance, this._instance, tokens.ref(), count);
    return new TokenList(tokens, count.deref());
  };
};

module.exports = Range;
