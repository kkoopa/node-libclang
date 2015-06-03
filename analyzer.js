var EventEmitter = require('events').EventEmitter,
    emitter = new EventEmitter(),
    fs = require('fs'),
    jsdiff = require('diff'),
    libclang = require('./'),
    lib = require('./lib/dynamic_clang').libclang,
    Index = libclang.Index,
    Cursor = libclang.Cursor,
    CXToken = libclang.CXToken,
    Range = libclang.Range,
    TranslationUnit = libclang.TranslationUnit,
    Type = libclang.Type,
    Location = libclang.Location,
    index = new Index(true, true),
    filename = 'binding.cc',
    //nodedir = '/usr/local/include/node/',
    node_gyp_header_dir = '/home/kkoopa/.node-gyp/0.12.2/'
    cpp11 = false,
    //args = [['-I', nodedir].join(''), '-Inode_modules/nan/'],
    args = [
      ['-I', node_gyp_header_dir, 'src/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/v8/include/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/uv/include/'].join(''),
      '-Inode_modules/nan/'],
    pending_patches = 0,
    patches = [],
    visited = [];

    if (cpp11) {
      args.push('-std=c++11');
    }

    var tu = TranslationUnit.fromSource(index, filename, args);

function readAt(filename, offset, length, cb) {
  var buffer;

  if (cb) {
    fs.open(filename, 'r', function (err, fd) {
      if (err) {
        if (cb) {
          cb(err);
        } else {
          throw err;
        }
      }
      buffer = new Buffer(length);
      fs.read(fd, buffer, 0, length, offset, function (err, bytesRead, buffer) {
        if (err) {
          if (cb) {
            cb(err);
          } else {
            throw err;
          }
        }
        cb(err, buffer.toString());
      });
    });
  } else {
    buffer = new Buffer(length);
    fs.readSync(fs.openSync(filename, 'r'), buffer, 0, length, offset);
    return buffer.toString();
  }
}

function replacer(pattern, replacement, offset, length, matchgroup, cb) {
/*  if (visited[offset]) {
    if (cb) cb(false);
    return;
  }
  visited[offset] = true;*/
  pending_patches++;
  //console.log('increasing pending patches to: ', pending_patches);
  //console.log('because of offset: ', offset);
  readAt(filename, offset, length, function (err, s) {
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw err;
      }
    }
    var re = new RegExp(pattern);
    var org = re.exec(s);
    if (org) {
      console.log('***',s);
      var temp = org[matchgroup ? matchgroup : 0].replace(pattern, replacement);
      patches.push({
        offset: offset + s.indexOf(org[matchgroup ? matchgroup : 0]),
        delta: temp.length - org[matchgroup ? matchgroup : 0].length,
        original: org[matchgroup ? matchgroup : 0],
        replacement: temp
      });
    }
    //console.log('pending patches: ', pending_patches - 1);
    if (--pending_patches === 0) {
      emitter.emit('done');
    }
    //console.log([offset, temp.length - s.length, s, temp].join('\n'));
    if (cb) cb();
  });
}


function replaceTo(name, to, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$', 'g'), 'NanTo<' + to + '>($1).FromJust()', offset, length, cb);
}

function replaceToLocal(name, to, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$', 'g'), 'NanTo<' + to + '>($1).ToLocalChecked()', offset, length, cb);
}

function replaceMaybeZero(name, offset, length, cb) {
  replacer(new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(\\s*\\)$', 'g'), 'Nan' + name + '($1)', offset, length, cb);
}

function replaceMaybeSome(name, offset, length, cb) {
  /*if (visited[offset]) {
    if (cb) cb(false);
    return;
  }
  visited[offset] = true;*/
  pending_patches++;
  //console.log('increasing pending patches to: ', pending_patches);
  //console.log('because of offset: ', offset);
  readAt(filename, offset, length, function (err, s) {
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw err;
      }
    }

    var re = new RegExp('(.*)\\s*->\\s*' + name + '\\s*\\(', 'g'),
        res = re.exec(s);

    if (res) {
      var temp = ['Nan', name, '(', res[1], ', ', s.slice(re.lastIndex)].join('');
      patches.push({
        offset: offset,
        delta: temp.length - s.length,
        original: s,
        replacement: temp
      });
      //console.log('pending patches: ', pending_patches - 1);
      if (--pending_patches === 0) {
        emitter.emit('done');
      }
      //console.log([offset, temp.length - s.length, s, temp].join('\n'));
    } else {
      console.log('weird');
      console.log(s);
      pending_patches--;
    }

    if (cb) cb(false);
  });
}

function replaceArgs(offset, length, cb) {
  replacer('args', 'info', offset, length, cb);
}

function replaceEquals(offset, length, cb) {
  /*if (visited[offset]) {
    if (cb) cb(false);
    return;
  }
  visited[offset] = true;*/
  pending_patches++;
  //console.log('increasing pending patches to: ', pending_patches);
  //console.log('because of offset: ', offset);
  readAt(filename, offset, length, function (err, s) {
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw(err);
      }
    }

    var re = new RegExp('(.*)\\s*->\\s*Equals\\s*\\(', 'g'),
        res = re.exec(s);


    if (res) {
      var temp = ['NanEquals(', res[1], ', ', s.slice(re.lastIndex)].join('');
      patches.push({
        offset: offset,
        delta: temp.length - s.length,
        original: s,
        replacement: temp
      });
      //console.log('pending patches: ', pending_patches - 1);
      if (--pending_patches === 0) {
        emitter.emit('done');
      }
      //console.log([offset, temp.length - s.length, s, temp].join('\n'));
    } else {
      console.log('weird');
      console.log(s);
      pending_patches--;
    }

    if (cb) cb(false);
  });
}

function replaceNanNew(offset, length, cb) {
  replacer(/(?:.|[\r\n\s])*/g, '$&.ToLocalChecked()', offset, length, cb);
}

function replaceNanNewEmptyString(offset, length, cb) {
  replacer(/(?:.|[\r\n\s])*/g, 'NanEmptyString', offset, length, cb);
}

/*function motherfucker(name, replacement, offset, length, cb) {
  readAt(filename, offset, length, function (err, s) {
  });
}*/

function replaceNanPrefix(name, offset, length, cb) {
   //TODO: Work on this
  //replacer(name, replacement, offset, length, cb);
  replacer(new RegExp('((?:v8::)?' + name + ')', 'g'), 'Nan$1', offset, length, 1, cb);
}

function visitor(parent) {
  var self = this,
      startloc,
      endloc,
      offset,
      length,
      name,
      rd;

  if (this.location.presumedLocation.filename === filename /*&& !visited[this.location.fileLocation.offset]*/) {
    startloc = this.extent.start.fileLocation;
    endloc = this.extent.end.fileLocation;
    offset = startloc.offset;
    length = endloc.offset - startloc.offset;

    switch (this.kind) {
      case Cursor.TypeRef:
        switch (this.type.declaration.spelling) {
          case 'ObjectWrap':
            replaceNanPrefix('ObjectWrap', offset, length);
        }
        break;
      case Cursor.VarDecl:
        switch (this.type.declaration.spelling) {
          case 'Persistent':
            replaceNanPrefix('Persistent', offset, length);
            break;
          case 'TryCatch':
            console.log('*******************');
            console.log('TryCatch found');
            console.log(this.type.declaration.canonical.spelling);
            console.log('offset', offset);
            console.log(this.location.presumedLocation);
            console.log(endloc);
            var range = this.spellingNameRange;
            console.log(range.start.presumedLocation);
            console.log(range.end.presumedLocation);
            var tokenlist = this.extent.tokenize(tu);
            console.log('Tokens:');
            for (var i = 0; i < tokenlist.length; i++) {
              console.log(tokenlist.get(i).spelling);
            }
            tokenlist.dispose();
            replaceNanPrefix('TryCatch', offset, length);
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
            console.log('*******************');
            console.log('NanNew found');
            console.log(this.type.declaration.canonical.spelling);
            console.log('offset', offset);
            console.log(this.location.presumedLocation);
            console.log(endloc);
            var range = this.spellingNameRange;
            console.log(range.start.presumedLocation);
            console.log(range.end.presumedLocation);
            var s = readAt(filename, offset, length);
            var arg0type = this.definition.type.getArg(0);
            if (this.definition.numArguments === 0
             && this.definition.getTemplateArgumentType(0).declaration.spelling === 'String') {
              replaceNanNewEmptyString(offset, length);
            } else if (this.definition.numArguments > 0
             && arg0type.kind === Type.Pointer
             && (arg0type.pointee.kind === Type.Char_S || arg0type.pointee.kind === Type.Char16)) {
              replaceNanNew(offset, length);
            } else {
              switch (this.definition.getTemplateArgumentType(0).declaration.spelling) {
                case 'Date':
                case 'RegExp':
                case 'String':
                  replaceNanNew(offset, length);
                  break;
              }
            }
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
            /*console.log('ToSomething called');
            console.log(offset);
            console.log(readAt(filename, offset, length));*/
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
          case 'NanAssignPersistent':
          case 'NanDisposePersistent':
          case 'NanMakeWeakPersistent':
          case 'NanObjectWrapHandle':
            console.log(this.spelling);
            break;
        }
    }
    return Cursor.Recurse;
  }
  return Cursor.Continue;
}

tu.cursor.visitChildren(visitor);

index.dispose();

emitter.on('done', function () {
  var total = 0,
      length,
      i;

  patches.sort(function (a, b) {
    return a.offset - b.offset;
  }).filter(function (patch, pos, arr) {
    return !pos || patch.offset !== arr[pos - 1].offset;
  });

  for (i = 0, length = patches.length; i < length; i++) {
    patches[i].newoffset = patches[i].offset + total;
    total += patches[i].delta;
    //console.log(patches[i]);
  }

  fs.readFile(filename, {encoding: 'utf8'}, function (err, data) {
    var parts = [];

    patches.forEach(function (patch, pos, arr) {
      //console.log(patch.original);
      //console.log(patch.replacement);
      if (pos > 0) {
        parts.push(data.substring(arr[pos - 1].offset + arr[pos -1].original.length, patch.offset));
      } else {
        parts.push(data.substring(0, patch.offset));
      }
      parts.push(patch.replacement);
    });

    parts.push(data.substring(patches[patches.length -1].offset + patches[patches.length - 1].original.length, data.length));

    fs.writeFile(filename + '.new', parts.join(''), function (err) {
      if (err) throw err;
    });
  });
});
