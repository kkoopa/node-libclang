// Copyright 2013 Timothy J Fontaine <tjfontaine@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE

var ref = require('ref');

var lib = require('./dynamic_clang').libclang;

var Cursor = require('./cursor');
var File = require('./file');
var Location = require('./location');

var TranslationUnit = function (instance) {
  'use strict';

  if (!(this instanceof TranslationUnit))
    return new TranslationUnit(instance);

  var self = this;

  if (instance instanceof Buffer)
    this._instance = instance;

  Object.defineProperty(this, 'cursor', {
    get: function () {
      return new Cursor(lib.clang_getTranslationUnitCursor(self._instance));
    }
  });

  this.getFile = function (name) {
    return new File(lib.clang_getFile(self._instance, name));
  };

  this.isFileMultipleIncludeGuarded = function (file) {
    return lib.clang_isFileMultipleIncludeGuarded(this._instance, file._instance);
  };

  this.getLocationForOffset = function (file, offset) {
    return new Location(lib.clang_getLocationForOffset(this._instance, file._instance, offset));
  };

  this.getCursor = function (location) {
    return new Cursor(lib.clang_getCursor(this._instance, location._instance));
  };
};

TranslationUnit.fromSource = function (index, filename, args) {
  'use strict';

  var cargs, i, inst;

  cargs = new Buffer(ref.sizeof.pointer * args.length);

  for (i = 0; i < args.length; i++)
    cargs.writePointer(ref.allocCString(args[i]),
      i * ref.sizeof.pointer);

  inst = lib.clang_createTranslationUnitFromSourceFile(
    index._instance, filename, args.length, cargs, 0, null);

  return new TranslationUnit(inst);
};

module.exports = TranslationUnit;
