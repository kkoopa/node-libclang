var lib = require('./dynamic_clang');
var ref = require('ref');

var util = require('./util');

var File = function (instance) {
  'use strict';

  if (!(this instanceof File))
    return new File(instance);

  this._instance = instance;

  Object.defineProperty(this, 'name', {
    get: function () {
      return util.toString(lib.libclang.clang_getFileName(this._instance));
    }
  });

  Object.defineProperty(this, 'time', {
    get: function () {
      return new Date(lib.libclang.clang_getFileTime(this._instance));
    }
  });

  Object.defineProperty(this, 'id', {
    get: function () {
      var id = ref.allocate(lib.CXFileUniqueId);
      if (lib.libclang.clang_getFileUinqueId(this._instance)) {
        throw 'error';
      }
      return id.unref();
    }
  });

  this.isEqual = function (file) {
    return lib.libclang.clang_File_isEqual(this._instance, file._instance);
  };
};

module.exports = File;
