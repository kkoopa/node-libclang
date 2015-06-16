function assert(statement, message) {
	if (!statement) {
		throw message;
	}
}

var DeltaTree = function () {
	'use strict';

	if (!(this instanceof DeltaTree)) {
		return new DeltraTree();
	}

	var DeltaTreeNode = function (isLeaf) {
		var order = 8;

		Object.defineProperty(this, 'isLeaf', {
			get: function () {
				return typeof isLeaf !== 'undefined' ? isLeaf : true;;
			}
		});

		Object.defineProperty(this, 'isFull', {
			get: function () {
				return this.numValuesUsed === 2 * order - 1;
			}
		});
		
		Object.defineProperty(this, 'order', {
			get: function () {
				return order;
			}
		});

		this.fullDelta = 0;
		this.values = new Array(2 * order - 1);
		this.numValuesUsed = 0;
	};

	DeltaTreeNode.prototype.doInsertion = function (offset, delta) {
		'use strict';

		var i = 0, j, n = this.numValuesUsed, result, newresult, insertside;

		this.fullDelta += delta;

		while (i < n && offset > this.values[i].offset) {
			i++;
		}

		if (i !== n && this.values[i].offset === offset) {
			this.values[i].delta += delta;
			return false;
		}

		if (this.isLeaf) {
			console.log('insert into leaf');
			if (!this.isFull) {
				console.log('leaf was not full');
				if (i !== n) {
					for (j = n; j > i; j--) {
						this.values[j] = this.values[j - 1];
					}
				}

				this.values[i] = {offset: offset, delta: delta};
				this.numValuesUsed++;

				return false;
			}

			console.log('leaf was full, splitting');

			result = this.doSplit();

			if (result.split.offset > offset) {
				result.lhs.doInsertion(offset, delta);
			} else {
				result.rhs.doInsertion(offset, delta);
			}

			return result;
		}

		console.log('insert into interior node');

		console.log('-------------------------------------------');

		result = this.children[i].doInsertion(offset, delta);

		console.log('-------------------------------------------');

		if (!result) {
			console.log('inserted cleanly into child');
			return false;
		}

		console.log('**************************************************');
		console.log('child had to split, this gets tricky');
		console.log('**************************************************');

		if (!this.isFull) {
			console.log('node was not full');
			console.log('i', i);
			console.log('n', n);
			console.log('children before', this.children);
			if (i !== n) {
				for (j = n + 1; j > i + 1; j--) {
					this.children[j] = this.children[j - 1];
				}
			}

			this.children[i] = result.lhs;
			this.children[i + 1] = result.rhs;

			console.log('children after', this.children);

			if (i !== n) {
				for (j = n; j > i; j--) {
					this.values[j] = this.values[j - 1];
				}
			}

			this.values[i] = result.split;
			this.numValuesUsed++;

			return false;
		}

		console.log('node was full');

		this.children[i] = result.lhs;

		newresult = this.doSplit();

		if (result.split.offset < newresult.split.offset) {
			insertside = newresult.lhs;
		} else {
			insertside = newresult.rhs;
		}

		i = 0, n = insertside.numValuesUsed;

		while (i < n && result.split.offset > insertside.values[i].offset) {
			i++;

			if (i !== n) {
				for (j = n + 1; j > i + 1; j--) {
					insertside.children[j] = insertside.children[j - 1];
				}
			}

			insertside.children[i + 1] = result.rhs;

			if (i !== n) {
				for (j = n; j > i; j--) {
					insertside.values[j] = insertside.values[j - 1];
				}
			}

			insertside.values[i] = result.split;
			insertside.numValuesUsed++;
			insertside.fullDelta += result.split.delta + result.rhs.fullDelta;
		}
	};

	var DeltaTreeInteriorNode = function (ir) {
		'use strict';

		DeltaTreeInteriorNode.prototype.constructor = DeltaTreeInteriorNode;
		this.children = new Array(2 * this.order);

		if (ir) {
			this.children[0] = ir.lhs;
			this.children[1] = ir.rhs;
			this.values[0] = ir.split;
			this.fullDelta = ir.lhs.fullDelta + ir.rhs.fullDelta + ir.split.delta;
			this.numValuesUsed = 1;
		}
	};

	DeltaTreeInteriorNode.prototype = new DeltaTreeNode(false);

	DeltaTreeNode.prototype.doSplit = function () {
		'use strict';
		var newNode;

		if (!this.isFull) {
			throw 'why split a non-full node?';
		}

		if (this instanceof DeltaTreeInteriorNode) {
			newNode = new DeltaTreeInteriorNode();
			newNode.children = this.children.slice(0, this.order);
		} else {
			newNode = new DeltaTreeNode();
		}

		newNode.values = this.values.slice(this.order);

		newNode.numValuesUsed = this.numValuesUsed = this.order - 1;

		newNode.recomputeFullDeltaLocally();
		this.recomputeFullDeltaLocally();

		return {lhs: this, rhs: newNode, split: this.values[this.order - 1]};
	};

	DeltaTreeNode.prototype.recomputeFullDeltaLocally = function () {
		'use strict';

		var newFullDelta = 0, i = 0, n = this.numValuesUsed;

		for (; i < n; i++) {
			newFullDelta += this.values[i].delta;
		}

		if (!this.isLeaf) {
			for (i = 0, n++; i < n; i++) {
				newFullDelta += this.children[i].fullDelta;
			}
		}

		this.fullDelta = newFullDelta;
	};

	this.root = new DeltaTreeNode();

	this.verifyTree = function () {
		function verifier(node) {
			var fullDelta = 0, i, n = node.numValuesUsed;
			if (!(node instanceof DeltaTreeInteriorNode)) {
				for (i = 0; i < n; i++) {
					if (i) {
						assert(node.values[i - 1].offset < node.values[i].offset, 'Ensure that the elements are in proper order');
					}
					fullDelta += node.values[i].delta;
				}

				assert(fullDelta === node.fullDelta, 'Ensure that FullDelta matches up');
				return;
			}

			for (i = 0; i < n; i++) {
				if (i) {
					assert(node.values[i - 1].offset < node.values[i].offset, 'Ensure that the elements are in proper order');
				}
				fullDelta += node.values[i].delta;
				fullDelta += node.children[i].fullDelta;

				assert(node.children[i].values[node.children[i].numValuesUsed - 1].offset < node.values[i].offset, 'The largest value in child ' + i + ' should be smaller than offset');
				assert(node.children[i + 1].values[0].offset > node.values[i].offset, 'The smallest value in child' + (i + 1) + ' should be larger than offset');
				verifier(node.children[i]);
			}

			fullDelta += node.children[node.numValuesUsed].fullDelta;
			assert(fullDelta === node.fullDelta, 'Ensure that FullDelta matches up');
		}

		verifier(this.root);
	};

	this.getDeltaAt = function (offset) {
		'use strict';

		var node = this.root, result = 0, numValsGreater, n, val, i;

		while (true) {
			n = node.numValuesUsed;
			for (numValsGreater = 0; numValsGreater < n; numValsGreater++) {
				val = node.values[numValsGreater];
				if (val.offset >= offset) {
					break;
				}
				result += val.delta;
			}

			if (!(node instanceof DeltaTreeInteriorNode)) {
				return result;
			}

			for (i = 0; i < numValsGreater; i++) {
				result += node.children[i].fullDelta;
			}

			if (numValsGreater !== n && node.values[numValsGreater].offset === offset) {
				return result + node.children[numValsGreater].fullDelta;
			}

			node = node.children[numValsGreater];
		}
	};

	this.addDelta = function (offset, delta) {
		'use strict';
		var result;

		if (!delta) { throw 'noop'; }

		console.log('addDelta', offset, delta);

		result = this.root.doInsertion(offset, delta);
		if (result) {
			console.log('insertion was hard');
			this.root = new DeltaTreeInteriorNode(result);
		}

		this.verifyTree();
	};

};

module.exports = DeltaTree;
