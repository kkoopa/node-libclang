var lib = require('./dynamic_clang');
var ArrayType = require('ref-array');

var Cursor = require('./cursor');
var Token = require('./token');

var TokenArray = ArrayType(lib.CXToken);
var CursorArray = ArrayType(lib.CXCursor);

var TokenList = function (tu, tokens, count) {
  'use strict';

  if (!(this instanceof TokenList))
    return new TokenList(tu, tokens, count);

  this._tu = tu;
  this._tokens = tokens;
  //this._tokenlist = new TokenArray(tokens);
  this._count = count;

  Object.defineProperty(this, 'length', {
    get: function () {
      return this._count;
    }
  });

  this.dispose = function () {
    lib.libclang.clang_disposeTokens(this._tu._instance, this._tokens, this._count);
    delete this._tokens;
  };

  this.annotate = function () {
    var cursors = new CursorArray(cursors, this._count);
    lib.libclang.clang_annotateTokens(this._tu, this._tokens, this._count, cursors);
    var result = [];
    for (var i = 0, length = this._count; i < length; i++)
      result.push(new Cursor(cursors[i]));
    return result;
  };

  this.get = function (idx) {
    console.log(this._tokens);
    console.log((new TokenArray(this._tokens)).buffer);
    return new Token(this._tu, (new TokenArray(this._tokens))[0]);
  };
};

module.exports = TokenList;
