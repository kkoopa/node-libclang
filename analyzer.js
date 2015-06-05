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
    nodedir = '/usr/local/include/node/',
    node_gyp_header_dir = '/home/kkoopa/.node-gyp/0.12.2/'
    cpp11 = true,
    args = [['-I', nodedir].join(''), '-Inode_modules/nan/'],
    /*args = [
      ['-I', node_gyp_header_dir, 'src/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/v8/include/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/uv/include/'].join(''),
      '-Inode_modules/nan/'],*/
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

function replacer(replacement, offset, length, cb) {
  pending_patches++;
  if (length === 0) {
    patches.push({
      offset: offset,
      delta: replacement.length - length,
      original: '',
      replacement: replacement
    });

    if (--pending_patches === 0) {
      emitter.emit('done');
    }
   if (cb) cb();
  } else {
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
}

function replaceTo(name, type, extent, cb) {
  var tokens = extent.tokenize(tu),
      length = tokens.length,
      i = length,
      name_token,
      paren_token,
      operator_token,
      name_offset,
      paren_offset,
      start_offset = extent.start.fileLocation.offset,
      end_offset = extent.end.fileLocation.offset,
      replacement;

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
          paren_offset = paren_token.location.fileLocation.offset;
          replacement = ['NanTo<', type, '>(', readAt(filename, start_offset, operator_token.location.fileLocation.offset - start_offset)].join('');
          replacer(replacement, start_offset, paren_offset + 1 - start_offset, function (err) {
            if (err) {
              if (cb) {
                cb(err);
              } else {
                throw err;
              }
            }
            replacer('.FromJust()', end_offset, 0, cb);
          });
          break;
        }
      }
    }
  }
  tokens.dispose();
}

function replaceToLocal(name, extent, cb) {
  var tokens = extent.tokenize(tu),
      length = tokens.length,
      i = length,
      name_token,
      paren_token,
      operator_token,
      name_offset,
      paren_offset,
      start_offset = extent.start.fileLocation.offset,
      end_offset = extent.end.fileLocation.offset,
      replacement;

  for(; i >= 2; i--) {
    paren_token = tokens.get(i);

    if (!paren_token) {
      continue;
    }

    if (paren_token.spelling === '(') {
      name_token = tokens.get(i - 1);
      if (name_token.spelling === 'To' + name) {
        operator_token = tokens.get(i - 2);
        if (operator_token.kind === Token.Punctuation) {
          paren_offset = paren_token.location.fileLocation.offset;
          replacement = ['NanTo<v8::', name, '>(', readAt(filename, start_offset, operator_token.location.fileLocation.offset - start_offset)].join('');
          replacer(replacement, start_offset, paren_offset + 1 - start_offset, function (err) {
            if (err) {
              if (cb) {
                cb(err);
              } else {
                throw err;
              }
            }
            replacer('.ToLocalChecked()', end_offset, 0, cb);
          });
          break;
        }
      }
    }
  }
  tokens.dispose();
}

function replaceMaybe(name, extent, hasargs, cb) {
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
      end_offset = extent.end.fileLocation.offset,
      replacement;

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
          paren_offset = paren_token.location.fileLocation.offset;
          replacement = ['Nan', name, '(', readAt(filename, start_offset, operator_token.location.fileLocation.offset - start_offset), hasargs ? ', ' : ''].join('');
          replacer(replacement, start_offset, paren_offset + 1 - start_offset, function (err) {
            if (err) {
              if (cb_) {
                cb_(err);
              } else {
                throw err;
              }
            }
            //replacer('.ToLocalChecked()', end_offset, 0, cb_);
          });
          break;
        }
      }
    }
  }
  tokens.dispose();
}

function replaceArgs(replacement, offset, length, cb) {
  replacer('info', offset, length, cb);
}

function replaceEquals(offset, extent, cb) {
  var tokens = extent.tokenize(tu),
      length = tokens.length,
      i = length,
      name_token,
      paren_token,
      operator_token,
      name_offset,
      paren_offset,
      start_offset = extent.start.fileLocation.offset,
      end_offset = extent.end.fileLocation.offset,
      replacement;

  for(; i >= 2; i--) {
    paren_token = tokens.get(i);

    if (!paren_token) {
      continue;
    }

    if (paren_token.spelling === '(') {
      name_token = tokens.get(i - 1);
      if (name_token.spelling === 'Equals') {
        operator_token = tokens.get(i - 2);
        if (operator_token.kind === Token.Punctuation) {
          paren_offset = paren_token.location.fileLocation.offset;
          replacement = ['NanEquals(', readAt(filename, start_offset, operator_token.location.fileLocation.offset - start_offset), ', '].join('');
          replacer(replacement, start_offset, paren_offset + 1 - start_offset, function (err) {
            if (err) {
              if (cb) {
                cb(err);
              } else {
                throw err;
              }
            }
            replacer('.FromJust()', end_offset, 0, cb);
          });
          break;
        }
      }
    }
  }
  tokens.dispose();
}

function replaceNanNew(offset, extent, cb) {
  replacer('.ToLocalChecked()', extent.end.fileLocation.offset, 0, cb);
}

function replaceNanNewEmptyStringTemplate(extent, cb) {
  var start = extent.start.fileLocation.offset,
      end = extent.end.fileLocation.offset;

  replacer('NanEmptyString()', start, end - start, cb);
}

function replaceNanNewEmptyString(argoffset, extent, cb) {
  var startoffset = extent.start.fileLocation.offset;
  replacer('NanEmptyString(', startoffset, argoffset + 2 - startoffset, cb);
}

function replaceNanPrefix(name, offset, length, cb) {
  replacer('Nan' + name, offset, length, cb);
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
      idx,
      arg0type;

  if (this.location.presumedLocation.filename === filename) {
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
              case Cursor.DeclRefExpr:
                var pair = getOtherReplacementRange(spelling, parent.extent);
                replaceNanPrefix(spelling, pair[0], pair[1] - pair[0]);
                break;
              case Cursor.CXXBaseSpecifier:
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
              //replaceArgs('info', offset, length);
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
            arg0type = this.definition.type.getArg(0);
            if (this.definition.numArguments === 0
             && this.definition.getTemplateArgumentType(0).declaration.spelling === 'String') {
              replaceNanNewEmptyStringTemplate(this.extent);
            } else if (this.definition.numArguments > 0
             && arg0type.kind === Type.Pointer
             && (arg0type.pointee.kind === Type.Char_S || arg0type.pointee.kind === Type.Char16)) {
              var toklist = this.getArgument(0).extent.tokenize(tu);
              var token = toklist.get(0);
              if (token.spelling === '""') {
                replaceNanNewEmptyString(token.location.fileLocation.offset, this.extent);
              } else {
                replaceNanNew(offset, this.extent);
              }
              toklist.dispose();
            } else {
              switch (this.definition.getTemplateArgumentType(0).declaration.spelling) {
                case 'Date':
                case 'RegExp':
                case 'String':
                  replaceNanNew(offset, this.extent);
                  break;
              }
            }
            break;
          case 'Equals':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceEquals(offset, extent);
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
              replaceToLocal(spelling.substring(2), this.extent);
            }
            break;
          case 'BooleanValue':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(spelling, 'bool', this.extent);
            }
            break;
          case 'Int32Value':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(spelling, 'int32_t', this.extent);
            }
            break;
          case 'IntegerValue':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(spelling, 'int64_t', this.extent);
            }
            break;
          case 'Uint32Value':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceTo(spelling, 'uint32_t', this.extent);
            }
            break;
          case 'ToArrayIndex':
          case 'ToDetailString':
            if (this.referenced.semanticParent.spelling === 'Value') {
              replaceMaybe(spelling, this.extent);
            }
            break;
          case 'GetFunction':
            if (this.referenced.semanticParent.spelling === 'FunctionTemplate') {
              replaceMaybe(spelling, this.extent);
            }
            break;
          case 'GetEndColumn':
          case 'GetLineNumber':
          case 'GetSourceLine':
          case 'GetStartColumn':
            if (this.referenced.semanticParent.spelling === 'Message') {
              replaceMaybe(spelling, this.extent);
            }
            break;
          case 'NewInstance':
            if (this.referenced.semanticParent.spelling === 'Function' ||
                this.referenced.semanticParent.spelling === 'ObjectTemplate') {
              replaceMaybe(spelling, this.extent);
            }
            break;
          case 'GetOwnPropertyNames':
          case 'GetPropertyNames':
          case 'ObjectProtoToString':
            if (this.referenced.semanticParent.spelling === 'Object') {
              replaceMaybe(spelling, this.extent);
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
              replaceMaybe(spelling, this.extent, true);
            }
            break;
          case 'CloneElementAt':
            if (this.referenced.semanticParent.spelling === 'Array') {
              replaceMaybe(spelling, this.extent, true);
            }
            break;
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
