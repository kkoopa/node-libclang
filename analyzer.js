var fs = require('fs'),
    libclang = require('./'),
    lib = require('./lib/dynamic_clang').libclang;
    Index = libclang.Index,
    Cursor = libclang.Cursor,
    CXToken = libclang.CXToken,
    Range = libclang.Range,
    TranslationUnit = libclang.TranslationUnit,
    Location = libclang.Location,
    index = new Index(true, true),
    filename = 'binding.cc',
    nodedir = '/usr/local/include/node/',
    cpp11 = true,
    args = [['-I', nodedir].join(''), '-Inode_modules/nan/'];

    if (cpp11) {
      args.push('-std=c++11');
    }

    var tu = TranslationUnit.fromSource(index, filename, args);

function replacer(pattern, replacement, offset, length, cb) {
  fs.open(filename, 'r+', function (err, fd) {
    var buffer;
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw err;
      }
    }
    var buffer = new Buffer(length);
    fs.read(fd, buffer, 0, length, offset, function (err, bytesRead, buffer) {
      var  s;
      if (err) {
        if (cb) {
          cb(err);
        } else {
          throw err;
        }
      }
      s = buffer.toString();
      console.log(s);
      console.log(s.replace(pattern, replacement));
      console.log('-----------------------------------------------------------------------------------------------');
      if (cb) cb();
    });
  });
}

function replaceTo(name, to, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$'), 'NanTo<' + to + '>($1)', offset, length, cb);
}

function replaceMaybeZero(name, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$'), 'Nan' + name + '($1)', offset, length, cb);
}

function replaceMaybeSome(name, offset, length, cb) {
  fs.open(filename, 'r+', function (err, fd) {
    var buffer;
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw err;
      }
    }
    buffer = new Buffer(length);
    fs.read(fd, buffer, 0, length, offset, function (err, bytesRead, buffer) {
      var  s;
      if (err) {
        if (cb) {
          cb(err);
        } else {
          throw err;
        }
      }
      s = buffer.toString();
      console.log(s);
      var re = new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(', 'g');
      var res = re.exec(s);

      if (res) {
        console.log(['Nan', name, '(', res[1], ', ', s.slice(re.lastIndex)].join(''));
        console.log('-----------------------------------------------------------------------------------------------');
      }

      if (cb) cb(false);
    });
  });
}

function visitor (parent) {
  var self = this,
      offset,
      length,
      name;

  if (this.location.presumedLocation.filename === filename) {
    switch (this.kind) {
      case Cursor.CallExpr:
        offset = this.extent.start.fileLocation(lib.clang_getFile(tu._instance, filename)).offset;
        length = this.extent.end.fileLocation(lib.clang_getFile(tu._instance, filename)).offset - offset;
        name = this.displayname;

        switch (name) {
          case 'ToBoolean':
          case 'ToInt32':
          case 'ToInteger':
          case 'ToNumber':
          case 'ToObject':
          case 'ToString':
          case 'ToUint32':
            replaceTo(this.displayname, 'v8::' + /To(\w+)$/.exec(name)[1], offset, length);
            break;
          case 'BooleanValue':
            replaceTo(this.displayname, 'bool', offset, length);
            break;
          case 'Int32Value':
            replaceTo(this.displayname, 'int32_t', offset, length);
            break;
          case 'IntegerValue':
            replaceTo(this.displayname, 'int64_t', offset, length);
            break;
          case 'Uint32Value':
            replaceTo(this.displayname, 'uint32_t', offset, length);
          case 'GetEndColumn':
          case 'GetFunction':
          case 'GetLineNumber':
          case 'GetOwnPropertyNames':
          case 'GetPropertyNames':
          case 'GetSourceLine':
          case 'GetStartColumn':
          case 'NewInstance':
          case 'ObjectProtoToString':
          case 'ToArrayIndex':
          case 'ToDetailString':
            if (this.referenced.semanticParent.spelling == 'Object') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'CallAsConstructor':
          case 'CallAsFunction':
          case 'CloneElementAt':
          case 'Delete':
          case 'ForceSet':
          case 'Get':
          case 'GetPropertyAttributes':
          case 'GetRealNamedProperty':
          case 'GetRealNamedPropertyInPrototypeChain':
          case 'Has':
          case 'HasOwnProperty':
          case 'HasRealIndexedProperty':
          case 'HasRealNamedCallbackProperty':
          case 'HasRealNamedProperty':
          case 'Set':
          case 'SetAccessor':
          case 'SetIndexedPropertyHandler':
          case 'SetNamedPropertyHandler':
          case 'SetPrototype':
            if (this.referenced.semanticParent.spelling == 'Object') {
              replaceMaybeSome(this.displayname, offset, length);
            }
        }
    }
    return Cursor.Recurse;
  }
  return Cursor.Continue;
}

tu.cursor.visitChildren(visitor);

index.dispose();
