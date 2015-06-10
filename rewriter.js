Array.prototype.bisect_left = function (val, comparator) {
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

var offsets = [];

/* TODO: this is too messy and unnecessarily complicated */
function getDelta(offset) {
	var length = offsets.length, idx;

	if (length === 0) {
		return 0;
	}
	idx = offsets.bisect_left(offset, function (a, b) { return a[0] - b; }) - 1;
	idx = idx === -1 ? 0 : idx;
	return offsets[idx][1];
}

/* TODO: this is too messy and unnecessarily complicated */
function setDelta(offset, delta) {
	var length = offsets.length, idx;

	if (length === 0) {
		offsets.push([offset, delta]);
	} else {
		idx = offsets.bisect_left(offset, function (a, b) { return a[0] - b; });
		if (idx < length && offsets[idx][0] === offset) {
			if (idx > 0) {
				offsets[idx][1] = delta + offsets[idx][1] - offsets[idx - 1][1];
			} else {
				offsets[idx][1] = delta + offsets[idx][1];
			}
		} else {
			offsets.push([offset, delta]);
		}
	}
}

var source = 'NanAssignPersistent(persistent, args[0]);'

function makeDelete(offset, length) {
  'use strict';

  return function (source) {
    var result, delta = getDelta(offset);
    setDelta(offset, delta - length);
    result = source.substring(0, offset + delta) + source.substring(offset + delta + length);
    return result;
  };
}

function makeInsert(offset, string) {
  'use strict';

  return function (source) {
    var result, delta = getDelta(offset);
    setDelta(offset, delta + string.length);
    result = source.substring(0, offset + delta) + string + source.substring(offset + delta);
    return result;
  };
}

function makeReplace(offset, length, string) {
  'use strict';

  return function (source) {
    return makeInsert(offset, string)(makeDelete(offset, length)(source));
  };
}

source = makeDelete(0, 'NanAssignPersistent('.length)(source);
source = makeReplace('NanAssignPersistent(persistent'.length, ', '.length, '.Reset(')(source);
source = makeReplace('NanAssignPersistent(persistent, '.length, 'args'.length, 'info')(source);
console.log(source);
