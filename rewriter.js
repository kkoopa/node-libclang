var DeltaTree = require('./deltatree');

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
	console.log(JSON.stringify('created DeltaTree', this.offsets));
	this.operations = [];
	this.source = source;

	this.getDelta = function (offset) {
		'use strict';

		console.log('offsets', this.offsets);
		return this.offsets.getDeltaAt(offset);
	};

	this.setDelta = function (offset, delta) {
		'use strict';
		this.offsets.addDelta(offset, delta);
	};

	this.makeDelete = function (offset, length) {
		'use strict';

		var self = this;

		this.operations.push({op: function () {
			var delta = self.getDelta(offset);
			self.setDelta(offset, -length);
			self.source = Buffer.concat([self.source.slice(0, offset + delta), self.source.slice(offset + delta + length)]);
		}, offset: offset});
	};

	this.makeInsert = function (offset, string) {
		'use strict';
		var self = this;

		this.operations.push({op: function () {
			//console.log('insert');
			var delta = self.getDelta(offset);
			self.setDelta(offset, string.length);
			self.source = Buffer.concat([self.source.slice(0, offset + delta), new Buffer(string), self.source.slice(offset + delta)]);
		}, offset: offset});
	};

	this.makeReplace = function (offset, length, string) {
		'use strict';

		this.makeDelete(offset, length);
		this.makeInsert(offset, string);
	};

	this.execute = function () {
		this.operations/*.sort(function (a, b) { return a.offset - b.offset})*/.forEach(function (val) {
			val.op();
		});
	};
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
