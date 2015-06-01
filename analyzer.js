var fs = require('fs'),
    jsdiff = require('diff'),
    libclang = require('./'),
    lib = require('./lib/dynamic_clang').libclang,
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
    args = [['-I', nodedir].join(''), '-Inode_modules/nan/'],
    patches = [];

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
      patches.push(jsdiff.createPatch(filename, s + '\n', s.replace(pattern, replacement) + '\n'));
      console.log(patches[patches.length -1]);
      if (cb) cb();
    });
  });
}


function replaceTo(name, to, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$'), 'NanTo<' + to + '>($1).FromJust()', offset, length, cb);
}

function replaceToLocal(name, to, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$'), 'NanTo<' + to + '>($1).ToLocalChecked()', offset, length, cb);
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
      var re = new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(', 'g');
      var res = re.exec(s);

      if (res) {
        patches.push(jsdiff.createPatch(filename, s + '\n', ['Nan', name, '(', res[1], ', ', s.slice(re.lastIndex), '\n'].join('')));
        console.log(patches[patches.length - 1]);
      }

      if (cb) cb(false);
    });
  });
}

function replaceArgs(offset, length, cb) {
  replacer('args', 'info', offset, length, cb);
}

function replaceEquals(offset, length, cb) {
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
      var re = new RegExp('(.*)\\s*->\\s*Equals\\s*\\(', 'g');
      var res = re.exec(s);

      if (res) {
        patches.push(jsdiff.createPatch(filename, s + '\n', ['NanEquals(', res[1], ', ', s.slice(re.lastIndex), '\n'].join('')));
        console.log(patches[patches.length - 1]);
      }

      if (cb) cb(false);
    });
  });
}

function visitor (parent) {
  var self = this,
      startloc,
      endloc,
      offset,
      length,
      name,
      rd;

  if (this.location.presumedLocation.filename === filename) {
    startloc = this.extent.start.fileLocation(lib.clang_getFile(tu._instance, filename));
    endloc = this.extent.end.fileLocation(lib.clang_getFile(tu._instance, filename));
    offset = startloc.offset;
    length = endloc.offset - startloc.offset;

    switch (this.kind) {
      case Cursor.TypeRef:
        switch (this.type.declaration.spelling) {
          case 'ObjectWrap':
            console.log(this.type.declaration.spelling);
        }
        break;
      case Cursor.VarDecl:
        switch (this.type.declaration.spelling) {
          case 'Persistent':
            console.log(this.type.declaration.spelling);
            break;
          case 'TryCatch':
            console.log(this.type.declaration.spelling);
        }
        break;
      case Cursor.DeclRefExpr:
        if (this.displayname === 'args') {
          switch (this.type.declaration.spelling) {
            case 'AccessorInfo':
            case 'Arguments':
            case 'FunctionCallbackInfo':
            case 'PropertyCallbackInfo':
              replaceArgs(offset, length);
          }
        }
        break;
      case Cursor.CallExpr:
        switch (this.displayname) {
          case 'GetIndexedPropertiesExternalArrayData':
          case 'GetIndexedPropertiesExternalArrayDataLength':
          case 'GetIndexedPropertiesExternalArrayDataType':
          case 'GetIndexedPropertiesPixelData':
          case 'GetIndexedPropertiesPixelDataLength':
          case 'HasIndexedPropertiesInExternalArrayData':
          case 'HasIndexedPropertiesInPixelData':
          case 'SetIndexedPropertiesToExternalArrayData':
          case 'SetIndexedPropertiesToPixelData':
            //insert warning on new line above (unleass already done so)
            break;
          case 'NanNew':
            console.log(this.displayname);
            console.log(this.type.declaration.spelling);
            console.log(this.definition.getArgument(0).type.spelling);
            break;
          case 'Equals':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceEquals(offset, length);
            }
            break;
          case 'ToBoolean':
          case 'ToInt32':
          case 'ToInteger':
          case 'ToNumber':
          case 'ToObject':
          case 'ToString':
          case 'ToUint32':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceToLocal(this.displayname, 'v8::' + /To(\w+)$/.exec(this.displayname)[1], offset, length);
            }
            break;
          case 'BooleanValue':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(this.displayname, 'bool', offset, length);
            }
            break;
          case 'Int32Value':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(this.displayname, 'int32_t', offset, length);
            }
            break;
          case 'IntegerValue':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(this.displayname, 'int64_t', offset, length);
            }
            break;
          case 'Uint32Value':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(this.displayname, 'uint32_t', offset, length);
            }
            break;
          case 'ToArrayIndex':
          case 'ToDetailString':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'GetFunction':
            if (this.referenced.semanticParent.spelling === 'FunctionTemplate') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'GetEndColumn':
          case 'GetLineNumber':
          case 'GetSourceLine':
          case 'GetStartColumn':
            if (this.referenced.semanticParent.spelling === 'Message') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'NewInstance':
            if (this.referenced.semanticParent.spelling === 'Function' ||
                this.referenced.semanticParent.spelling === 'ObjectTemplate') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'GetOwnPropertyNames':
          case 'GetPropertyNames':
          case 'ObjectProtoToString':
            if (this.referenced.semanticParent.spelling === 'Object') {
              replaceMaybeZero(this.displayname, offset, length);
            }
            break;
          case 'CallAsConstructor':
          case 'CallAsFunction':
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
            if (this.referenced.semanticParent.spelling === 'Object') {
              replaceMaybeSome(this.displayname, offset, length);
            }
            break;
          case 'CloneElementAt':
            if (this.referenced.semanticParent.spelling === 'Array') {
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
