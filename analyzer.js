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
    Rewriter = require('./rewriter'),
    rewriter = new Rewriter(fs.readFileSync(filename)),
    nodedir = '/usr/local/include/node/',
    node_gyp_header_dir = '/home/kkoopa/.node-gyp/0.12.2/'
    cpp11 = false,
    //args = [['-I', nodedir].join(''), '-Inode_modules/nan/'];
    args = [
      ['-I', node_gyp_header_dir, 'src/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/v8/include/'].join(''),
      ['-I', node_gyp_header_dir, 'deps/uv/include/'].join(''),
      '-Inode_modules/nan/'];

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

function replacer(replacement, offset, length, after_inserts, cb) {
  if (length === 0) {
    if (replacement.length > 0) {
      rewriter.makeInsert(offset, replacement, after_inserts);
    }

   if (cb) cb();
  } else if (replacement.length === 0) {
    if (length > 0) {
      rewriter.makeDelete(offset, length, after_inserts);
    }

   if (cb) cb();
  } else {
    rewriter.makeReplace(offset, length, replacement, after_inserts);

    if (cb) cb();
  }
}

function inserter(string, offset, after_inserts, cb) {
  replacer(string, offset, 0, after_inserts, cb);
}

function deleter(offset, length, after_inserts, cb) {
  replacer('', offset, length, after_inserts, cb);
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
      operator_offset,
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
          operator_offset = operator_token.location.fileLocation.offset;
          inserter(['NanTo<', type, '>('].join(''), start_offset, false, cb);
          deleter(operator_offset, paren_offset + 1 - operator_offset, false, cb);
          inserter('.FromJust()', end_offset, false, cb);
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
      operator_offset,
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
          operator_offset = operator_token.location.fileLocation.offset;
          inserter(['NanTo<v8::', name, '>('].join(''), start_offset, false, cb);
          deleter(operator_offset, paren_offset + 1 - operator_offset, false, cb);
          replacer(').ToLocalChecked()', operator_offset, 1, false, cb);
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
      operator_offset,
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
          operator_offset = operator_token.location.fileLocation.offset;
          inserter(['Nan', name, '('].join(''), start_offset, false, cb);
          deleter(operator_offset, paren_offset + 1 - operator_offset, false, cb);
          if (hasargs) {
            inserter(', ', operator_offset, false, cb);
          }
          inserter('.ToLocalChecked()', end_offset, false, cb);
          break;
        }
      }
    }
  }
  tokens.dispose();
}

function replaceArgs(replacement, offset, length, cb) {
//  inserter('info', offset, true, cb);
//  deleter(offset, length, true, cb);
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
      operator_offset,
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
          operator_offset = operator_token.location.fileLocation.offset;
          inserter('NanEquals(', start_offset, false, cb);
          replacer(', ', operator_offset, paren_offset + 1 - operator_offset, false, cb);
          inserter('.FromJust()', end_offset, false, cb);
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
  inserter('Nan' + name, offset, false, cb);
  deleter(offset, length, true, cb);
}

function replaceObjectWrapHandle(name, extent, cb) {
  var tokenlist = extent.tokenize(tu),
      token = tokenlist.get(2),
      offset = extent.start.fileLocation.offset,
      tokenOffset = token.location.fileLocation.offset;

  deleter(offset, tokenOffset - offset, true);
  inserter('->handle(', tokenOffset + token.spelling.length, true, cb);
  tokenlist.dispose();
}

function replaceMakeWeak(arg0, arg1, extent, cb) {
  var offset = extent.start.fileLocation.offset,
      arg0start = arg0.extent.start.fileLocation.offset;
      arg0end = arg0.extent.end.fileLocation.offset;
      arg1start = arg1.extent.start.fileLocation.offset;

  deleter(offset, arg0start - offset, false, cb);
  inserter('NanPersistent<v8::Value>(', offset, false, cb);
  deleter(arg0end, arg1start - arg0end, false, cb);
  inserter(').SetWeak(', arg0end, false, cb);
}

function replaceAssignPersistent(arg0, arg1, extent, cb) {
  var offset = extent.start.fileLocation.offset,
      arg0start = arg0.extent.start.fileLocation.offset,
      arg0end = arg0.extent.end.fileLocation.offset,
      arg1start = arg1.extent.start.fileLocation.offset;

  inserter('.Reset(', arg0end, false, cb);
  deleter(offset, arg0start - offset, true, cb);
  deleter(arg0end, arg1start - arg0end, true, cb);
}

function replaceDisposePersistent(arg0, extent, cb) {
  var offset = extent.start.fileLocation.offset,
      arg0start = arg0.extent.start.fileLocation.offset,
      arg0end = arg0.extent.end.fileLocation.offset;

  inserter('.Reset(', arg0end, false, cb);
  deleter(offset, arg0start - offset, true, cb);
}

function replaceScope(type, extent, remove, cb) {
  var start = extent.start.fileLocation.offset,
      end = extent.end.fileLocation.offset;

  if (!remove) {
    //inserter(['Nan', type, ' scope'].join(''), start, false, cb);
  }

  //deleter(start, end + 1 - start, false, cb);
}

function replaceEscapeScope(extent, cb) {
  var tokens = extent.tokenize(tu),
      startoffset = extent.start.fileLocation.offset,
      parenoffset = tokens.get(1).location.fileLocation.offset;

  inserter('scope.Escape', startoffset, false, cb);
  deleter(startoffset, parenoffset - startoffset, true, cb);
  tokens.dispose();
}

function replaceReturnValue(extent, cb) {
  var tokens = extent.tokenize(tu),
      startoffset = extent.start.fileLocation.offset,
      parenoffset = tokens.get(1).location.fileLocation.offset;

  inserter('info.getReturnValue.Set', startoffset, false, cb);
  deleter(startoffset, parenoffset - startoffset, true, cb);
  tokens.dispose();
}

function replaceReturnMacro(type, extent, cb) {
  var tokens = extent.tokenize(tu),
      startoffset = extent.start.fileLocation.offset,
      endoffset = extent.end.fileLocation.offset;

  console.log('replaceReturnMacro');
  console.log('offset', startoffset);
  console.log('length', endoffset - startoffset);

  if (type === 'This' || type === 'Holder') {
    inserter(['info.getReturnValue.Set(info.', type, '())'].join(''), startoffset, false, cb);
  } else if (type === 'Undefined') {
    inserter('return', startoffset, false, cb);
  } else {
    inserter(['info.getReturnValue.Set', type, '()'].join(''), startoffset, false, cb);
  }

  deleter(startoffset, endoffset - startoffset, true, cb);

  tokens.dispose();
}


function replaceWeakCallback(extent, cb) {
  var tokens = extent.tokenize(tu),
      nametoken = tokens.get(2),
      startoffset = extent.start.fileLocation.offset,
      nameoffset = nametoken.location.fileLocation.offset,
      namelength = nametoken.spelling.length;

  inserter('template <typename P> void ', startoffset, false, cb);
  inserter('(const NanWeakCallbackInfo<P> &data', nameoffset + namelength, false, cb);
  deleter(startoffset, nameoffset - startoffset, true, cb);

  tokens.dispose();
}

function insertRemovalWarning(offset, extent, cb) {
 var s = readAt(filename, offset, extent.end.fileLocation.offset),
     c,
     i,
     length;

 for (i = 0, length = s.length; i < length; i++) {
     c = s.charAt(i);
   if (c !== ' ' && c !== '\t') {
     break;
   }
 }
 replacer([s.substring(0, i), '/* ERROR: Rewrite using Buffer */\n'].join(''), offset, 0, cb);
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

    if (tu.getCursor(this.location).kind === Cursor.MacroExpansion) {
      switch (this.spelling) {
        case 'NanScope':
          var cir = tu.getCursor(tu.getLocationForOffset(tu.getFile(filename), offset - 1));
          var n_args = cir.semanticParent.numArguments;
          if (n_args > 0) {
            var s = cir.semanticParent.getArgument(n_args - 1).type.pointee.declaration.spelling;
            if (s === 'PropertyCallbackInfo' || s === 'FunctionCallbackInfo') {
              replaceScope('Scope', this.extent, true);
            }
          }
          replaceScope('Scope', this.extent, false); 
          break;
        case 'NanEscapableScope':
          replaceScope('EscapableScope', this.extent); 
          break;
        case 'NanEscapeScope':
          replaceEscapeScope(this.extent);
          break;
        case 'NanReturnValue':
          replaceReturnValue(this.extent);
          break;
        case 'NanReturnUndefined':
          replaceReturnMacro('Undefined', this.extent);
          break;
        case 'NanReturnNull':
          replaceReturnMacro('Null', this.extent);
          break;
        case 'NanReturnEmptyString':
          replaceReturnMacro('EmptyString', this.extent);
          break;
        case 'NanReturnThis':
          replaceReturnMacro('This', this.extent);
          break;
        case 'NanReturnHolder':
          replaceReturnMacro('Holder', this.extent);
          break;
        case 'NAN_WEAK_CALLBACK':
          replaceWeakCallback(this.extent);
      }
      return Cursor.Continue;
    }

    switch (this.kind) {
      case Cursor.TypeRef:
        switch (spelling) {
          case 'ObjectWrap':
            /*switch (parent.kind) {
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
            }*/
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
              break;
            case 'default':
              console.log('weird args', offset);
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
            var loc = this.location.fileLocation;
            insertRemovalWarning(loc.offset - loc.column + 1, this.extent);
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
            replaceAssignPersistent(this.getArgument(0), this.getArgument(1), this.extent);
            break;
          case 'NanDisposePersistent':
            replaceDisposePersistent(this.getArgument(0), this.extent);
            break;
          case 'NanMakeWeakPersistent':
            replaceMakeWeak(this.getArgument(0), this.getArgument(1), this.extent);
            break;
          case 'NanObjectWrapHandle':
            replaceObjectWrapHandle(spelling, this.extent);
            break;
        }
    }
    return Cursor.Recurse;
  }
  return Cursor.Continue;
}

tu.cursor.visitChildren(visitor);

index.dispose();

rewriter.execute();

fs.writeFile(filename + '.new', rewriter.source, function (err) {
  if (err) throw err;
});
