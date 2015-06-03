var lib = require('./dynamic_clang');
var ArrayType = require('ref-array');

var Cursor = require('./cursor');
var Token = require('./token');

/*var TokenArray = ArrayType(lib.CXToken);*/
var CursorArray = ArrayType(lib.CXCursor);

var TokenList = function (tu, tokenarray) {
  'use strict';

  if (!(this instanceof TokenList))
    return new TokenList(tu, tokens);

  this._tu = tu;
  this._tokens = tokenarray;
  //this._tokenlist = new TokenArray(tokens);
  //this._count = count;

  Object.defineProperty(this, 'length', {
    get: function () {
      return this._tokens.length;
    }
  });

  Object.defineProperty(this, 'annotate', {
    get: function () {
      var cursors = new Buffer(this.length * lib.CXToken.size);
      lib.libclang.clang_annotateTokens(this._tu._instance, this._tokens.buffer, this.length, cursors);
      cursors = new CursorArray(cursors);
      var result = [];
      result._buffer = cursors.ref();
      for (var i = 0, length = this.length; i < length; i++)
        result.push(new Cursor(cursors[i]));
      return result;
    }
  });

  this.dispose = function () {
    lib.libclang.clang_disposeTokens(this._tu._instance, this._tokens.buffer, this.length);
    delete this._tokens;
  };

/*  this.annotate = function () {
    var cursors = new CursorArray(cursors, this.length);
    lib.libclang.clang_annotateTokens(this._tu, this._tokens, this.length, cursors);
    var result = [];
    for (var i = 0, length = this._count; i < length; i++)
      result.push(new Cursor(cursors[i]));
    return result;
  };*/

  this.get = function (idx) {
    return new Token(this._tu, this._tokens[idx]);
  };
};

module.exports = TokenList;
