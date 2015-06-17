var DeltaTree = require('./deltatree'),
    Rope = require('./rope');

Array.prototype.bisect_left = function (val, comparator) {
	'use strict';

	var lo = 0, mid, hi = this.length, cmp = comparator ? comparator : function (a, b) { return a - b; };

	while (lo < hi) {
		mid = (lo + hi) >>> 1;

		if (comparator(this[mid], val) < 0) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}

	return lo;
};

var Rewriter = function (source) {
	'use strict';

	if (!(this instanceof Rewriter)) {
		return new Rewriter(source);
	}

	this.offsets = new DeltaTree();
	this.operations = [];
	this.source = new Rope(source);

	this.getDelta = function (offset) {
		'use strict';
		return this.offsets.getDeltaAt(offset);
	};

	this.setDelta = function (offset, delta) {
		'use strict';
		this.offsets.addDelta(offset, delta);
	};

	this.getMappedOffset = function (offset, after_inserts) {
		'use strict';
		return offset + this.getDelta(offset + (after_inserts ? 1 : 0));
	};

	this.makeDelete = function (offset, length, after_inserts) {
		'use strict';

		var self = this;

		this.operations.push({op: function () {
			var adjusted_offset = self.getMappedOffset(offset, after_inserts);
			self.setDelta(offset, -length);
			self.source.remove(adjusted_offset, adjusted_offset + length);
		}, offset: offset});
	};

	this.makeInsert = function (offset, string, after_inserts) {
		'use strict';
		var self = this,
		    data = new Buffer(string);

		this.operations.push({op: function () {
			var adjusted_offset = self.getMappedOffset(offset, after_inserts);
			self.setDelta(offset, data.length);
			self.source.insert(adjusted_offset, data);
		}, offset: offset});
	};

	this.makeReplace = function (offset, length, string, after_inserts) {
		'use strict';

		this.makeDelete(offset, length, after_inserts);
		this.makeInsert(offset, string, after_inserts);
	};

	this.execute = function () {
		/*this.operations.forEach(function (val) {
			val.op();
		});*/
		var i = 0, length = 5;
		for (; i < length; i++) {
			this.operations[i].op();
		}
	};
};

Rewriter.prototype.write = function (writeStream) {
	this.source.write(writeStream);
};

Rewriter.prototype.writeFile = function (filename) {
        this.source.writeFile(filename);
};


module.exports = Rewriter;

/*
var rewriter = new Rewriter(new Buffer('NanAssignPersistent(persistent, args[0]);'));
rewriter.makeDelete(0, 'NanAssignPersistent('.length);
rewriter.makeReplace('NanAssignPersistent(persistent'.length, ', '.length, '.Reset(');
rewriter.makeReplace('NanAssignPersistent(persistent, '.length, 'args'.length, 'info');
rewriter.execute();
console.log(rewriter.source.toString());
*/
