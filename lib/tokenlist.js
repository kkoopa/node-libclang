var lib = require('./dynamic_clang');
var util = require('./util');
var ref = require('ref');
var ArrayType = require('ref-array');

var CursorArray = ArrayType(lib.CXCursor);

var TokenList = function (tu, tokens, count) {
  if (!(this instanceof TokenList))
    return new TokenList(tu, tokens, count)

  this._tu = tu;
  this._tokens = tokens;
  this._count = count;

  Object.defineProperty(this, 'length', {
    get: function () {
      return this._count;
    }
  });

  this.dispose = function () {
    lib.libclang.clang_disposeTokens(this._tu, this._tokens, this._count);
    delete this._tokens;
  };

  this.annotate = function () {
    var cursors = new CursorArray(incursors, this._count);
    lib.libclang.clang_annotateTokens(this._tu, this._tokens, this._count, cursors)
    var result = [];
    for (var i = 0, length = this._count; i < length; i++) {
      result.push(new Cursor(cursors[i]));
    }
    return result;
  };

  this.get = function (idx) {
    return this._tokens[idx];
  };
};

module.exports = TokenList;
