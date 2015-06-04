var EventEmitter = require('events').EventEmitter,
    emitter = new EventEmitter(),
    fs = require('fs'),
    jsdiff = require('diff'),
    libclang = require('./'),
    superlib = require('./lib/dynamic_clang'),
    Index = libclang.Index,
    Cursor = libclang.Cursor,
    Token = libclang.Token,
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

function replacer2(replacement, offset, length, cb) {
  pending_patches++;
  readAt(filename, offset, length, function (err, s) {
    if (err) {
      if (cb) {
        cb(err);
      } else {
        throw err;
      }
    }
    patches.push({
      offset: offset,
      delta: replacement.length - length,
      original: s,
      replacement: replacement
    });

    if (--pending_patches === 0) {
      emitter.emit('done');
    }

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

function replaceMaybeSome(name, extent, hasargs, cb) {
  var tokens = extent.tokenize(tu),
      length = tokens.length,
      cb_ = cb ? cb : hasargs instanceof Function ? hasargs : undefined,
      i = length,
      name_token,
      paren_token,
      operator_token,
      name_offset,
      paren_offset,
      start_offset = extent.start.fileLocation.offset,
      replacement;
  console.log('****************************');
  console.log('start_offset', start_offset);

  for(; i >= 2; i--) {
    paren_token = tokens.get(i);
    if (!paren_token) {
      continue;
    }
    if (paren_token.spelling === '(') {
      name_token = tokens.get(i - 1);
      if (name_token.spelling === name) {
        operator_token = tokens.get(i - 2);
        if (operator_token.kind === Token.Punctuation) {
          replacement = ['Nan', name, '(', readAt(filename, start_offset, operator_token.location.fileLocation.offset - start_offset), hasargs ? ', ' : ''].join('');
          replacer2(replacement, start_offset, paren_token.location.fileLocation.offset + 1 - start_offset, cb_);
          break;
        }
      }
    }
  }

  tokens.dispose();
}

function replaceArgs(replacement, offset, length, cb) {
  replacer2('info', offset, length, cb);
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

function replaceNanPrefix(name, offset, length, cb) {
  replacer2('Nan' + name, offset, length, cb);
  //replacer(new RegExp('((?:v8::)?' + name + ')', 'g'), 'Nan$1', offset, length, 1, cb);
}

function getReplacementRange(match, extent) {
  var tokenlist = extent.tokenize(tu),
      i,
      length,
      token,
      spelling,
      returnvalue = [],
      resetToLast = false;

  for(i = 0, length = tokenlist.length; i < length; i++) {
    token = tokenlist.get(i);
    if (i === 0) {
      returnvalue[0] = token.location.fileLocation.offset;
    }

    if (token.kind === Token.Keyword) {
      resetToLast = true;
      continue;
    }

    if (resetToLast) {
      returnvalue[0] = token.location.fileLocation.offset;
      resetToLast = false;
    }

    spelling = token.spelling;
    console.log('token', spelling);
    if (spelling === match) {
      returnvalue[1] = token.location.fileLocation.offset + spelling.length;
      break;
    }
  }

  tokenlist.dispose();
  return returnvalue;
}

function getOtherReplacementRange(match, extent) {
  var tokenlist = extent.tokenize(tu),
      i,
      length,
      token,
      token2,
      lastIdx,
      spelling,
      returnvalue = [];

  for(i = 0, length = tokenlist.length; i < length; i++) {
    token = tokenlist.get(i);
    spelling = token.spelling;

    if (spelling === 'node') {
      token2 = tokenlist.get(i + 2);
      if (tokenlist.get(i + 1).spelling === '::' && token2.spelling === match) {
        returnvalue[0] = token.location.fileLocation.offset;
        returnvalue[1] = token2.location.fileLocation.offset + token2.spelling.length;
        break;
      }
    } else if (spelling === match) {
      lastIdx = i;
    }
  }

  if (i === length) {
    token = tokenlist.get(lastIdx);
    returnvalue[0] = token.location.fileLocation.offset;
    returnvalue[1] = returnvalue[0] + token.spelling.length;
  }

  tokenlist.dispose();
  return returnvalue;
}


function findback(s) {
  for (var i = s.length - 1; i >= 0; i--) {
    for (var j = i; j < s.length; j++) {
      if (s.substring(j, j + 4) === 'node') {
        for (var k = j + 5; k < s.length; k++) {
          switch (s.charAt(k)) {
            case ' ':
            case '\t':
            case '\n':
            case '\r':
              continue;
          }
          if (s.substring(k, k + 2) === '::') {
             return i;
          }
        }
      }
    }
  }
  return -1;
}

function visitor(parent) {
  var self = this,
      extent,
      startloc,
      endloc,
      offset,
      length,
      spelling,
      name,
      tok,
      rd,
      idx;

  if (this.location.isFromMainFile) {
    extent = this.extent;
    startloc = extent.start.fileLocation;
    endloc = extent.end.fileLocation;
    offset = startloc.offset;
    length = endloc.offset - offset;
    spelling = this.type.declaration.spelling;

    // handle these separately as they mess everything up
    if (tu.getCursor(this.location).kind === Cursor.MacroExpansion) {
      return Cursor.Continue;
    }

    switch (this.kind) {
      case Cursor.TypeRef:
        switch (spelling) {
          case 'ObjectWrap':
            switch (parent.kind) {
              case Cursor.Constructor:
                if (parent.kind === Cursor.Constructor) {
                  var pair = getOtherReplacementRange(spelling, parent.extent);
                  replaceNanPrefix(spelling, pair[0], pair[1] - pair[0]);
                }
                break;
              case Cursor.CXXVaseSpecifier:
              case Cursor.DeclRefExpr:
                var somecursor = tu.getCursor(tu.getLocationForOffset(tu.getFile(filename), offset - 1));
                offset = somecursor.extent.start.fileLocation.offset;
                var pair = getReplacementRange(spelling, somecursor.extent);
                replaceNanPrefix(spelling, pair[0], pair[1] - pair[0]);
                break;
              default:
                var pair = getReplacementRange(spelling, extent);
                replaceNanPrefix(spelling, pair[0], pair[1] - pair[0]);
            }
        }
        break;
      case Cursor.VarDecl:
        switch (spelling) {
          case 'Persistent':
          case 'TryCatch':
            var pair = getReplacementRange(spelling, extent);
            replaceNanPrefix(spelling, pair[0], pair[1] - pair[0]);
        }
        break;
      case Cursor.DeclRefExpr:
        if (this.displayname === 'args') {
          switch (this.type.declaration.spelling) {
            case 'AccessorInfo':
            case 'Arguments':
            case 'FunctionCallbackInfo':
            case 'PropertyCallbackInfo':
              replaceArgs('info', offset, length);
          }
        }
        break;
      case Cursor.CallExpr:
        spelling = this.spelling;
        switch (spelling) {
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
            /*console.log('*******************');
            console.log('NanNew found');
            console.log(this.type.declaration.canonical.spelling);
            console.log('offset', offset);
            console.log(this.location.presumedLocation);
            console.log(endloc);
            var range = this.spellingNameRange;
            //console.log(range.start.presumedLocation);
            //console.log(range.end.presumedLocation);
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
            }*/
            break;
          case 'Equals':
            /*if (this.referenced.semanticParent.spelling === 'Value') {
              replaceEquals(offset, length);
            }*/
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
            console.log(readAt(filename, offset, length));
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceToLocal(this.displayname, 'v8::' + /To(\w+)$/.exec(this.displayname)[1], offset, length);
            }*/
            break;
          /*case 'BooleanValue':
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
            break;*/
          case 'ToArrayIndex':
          case 'ToDetailString':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceMaybeSome(spelling, this.extent);
            }
            break;
          case 'GetFunction':
            if (this.referenced.semanticParent.spelling === 'FunctionTemplate') {
              replaceMaybeSome(spelling, this.extent);
            }
            break;
          case 'GetEndColumn':
          case 'GetLineNumber':
          case 'GetSourceLine':
          case 'GetStartColumn':
            if (this.referenced.semanticParent.spelling === 'Message') {
              replaceMaybeSome(spelling, this.extent);
            }
            break;
          case 'NewInstance':
            if (this.referenced.semanticParent.spelling === 'Function' ||
                this.referenced.semanticParent.spelling === 'ObjectTemplate') {
              replaceMaybeSome(spelling, this.extent);
            }
            break;
          case 'GetOwnPropertyNames':
          case 'GetPropertyNames':
          case 'ObjectProtoToString':
            if (this.referenced.semanticParent.spelling === 'Object') {
              replaceMaybeSome(spelling, this.extent);
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
            console.log('original_offset', offset);
            if (this.referenced.semanticParent.spelling === 'Object') {
              replaceMaybeSome(spelling, this.extent, true);
            }
            break;
          case 'CloneElementAt':
            if (this.referenced.semanticParent.spelling === 'Array') {
              replaceMaybeSome(spelling, this.extent, true);
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

  fs.readFile(filename, function (err, data) {
    var parts = [];

    patches.forEach(function (patch, pos, arr) {
      //console.log(patch.original);
      //console.log(patch.replacement);
      if (pos > 0) {
        parts.push(data.slice(arr[pos - 1].offset + arr[pos -1].original.length, patch.offset));
      } else {
        parts.push(data.slice(0, patch.offset));
      }
      parts.push(new Buffer(patch.replacement));
    });

    parts.push(data.slice(patches[patches.length -1].offset + patches[patches.length - 1].original.length, data.length));

    fs.writeFile(filename + '.new', Buffer.concat(parts), function (err) {
      if (err) throw err;
    });
  });
});
