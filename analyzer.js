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
    tu = TranslationUnit.fromSource(index, filename, ['-I/home/kkoopa/.node-gyp/0.12.2/deps/v8/include/', '-I/home/kkoopa/.node-gyp/0.12.2/deps/uv/include/', '-I/home/kkoopa/.node-gyp/0.12.2/src/', '-Inode_modules/nan/']);


function otherVisitor (parent) {
  console.log(this.displayname);
}

function visitor (parent) {
  var self = this;

  if (this.location.presumedLocation.filename === filename) {
    switch (this.kind) {
      case Cursor.CallExpr:
        if (this.displayname === 'Int32Value') {
          console.log('Use of \'' + this.displayname + '\' found at:');
          console.log('begin', this.extent.start.presumedLocation);
          console.log('end', this.extent.end.presumedLocation);
          var offset = this.extent._instance.begin_int_data - 2;
          var length = this.extent._instance.end_int_data - offset - 2;
          fs.open(filename, 'r+', function (err, fd) {
            if (err) throw err;
            var buffer = new Buffer(length);
            fs.read(fd, buffer, 0, length, offset, function (err, bytesRead, buffer) {
              var  s;
              if (err) throw err;
              s = buffer.toString();
              console.log(s);
              console.log(s.replace(/(.*)\s*->\s*Int32Value\s*\(\s*\)/, 'NanTo<v8::Int32>($1)'));
            });
          });
        }
      default:
    }
    this.visitChildren(visitor);
  }
  return Cursor.Continue;
}

tu.cursor.visitChildren(visitor);

index.dispose();
