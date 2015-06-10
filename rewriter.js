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

function getDelta(offset) {
	var length = offsets.length, idx;

	if (length === 0) {
		return 0;
	}
	idx = offsets.bisect_left(offset, function (a, b) { return a[0] - b; }) - 1;
	return offsets[idx][1];
}

function setDelta(offset, delta) {
	var length = offsets.length, idx;

	console.log('setting delta for', offset);

	if (length === 0) {
		offsets.push([offset, delta]);
		console.log('to', delta);
	} else {
		idx = offsets.bisect_left(offset, function (a, b) { return a[0] - b; });
		if (idx < length && offsets[idx][0] === offset) {
			console.log('was', offsets[idx][1]);
			console.log('delta is', delta);
			offsets[idx][1] = delta;
			console.log('to', offsets[idx][1]);
		} else {
			offsets.push([offset, delta]);
			console.log('to', delta);
		}
	}

	console.log(offsets);
}

/*console.log(getDelta(5));
console.log(getDelta(6));
console.log(getDelta(2));
console.log(getDelta(10));
console.log(getDelta(15));*/

var source = 'NanAssignPersistent(persistent, args[0]);'

function makeDelete(offset, length) {
  'use strict';

  return function (source) {
    var result, delta = getDelta(offset);
    console.log('delta', delta);
    setDelta(offset, delta - length);
    console.log('Delete');
    result = source.substring(0, offset + delta) + source.substring(offset + delta + length);
    return result;
  };
}

function makeInsert(offset, string) {
  'use strict';

  return function (source) {
    var result, delta = getDelta(offset);
    console.log('delta', delta);
    console.log('stringlength', string.length);
    setDelta(offset, delta + string.length);
    console.log('Insert');
    result = source.substring(0, offset + delta) + string + source.substring(offset + delta);
    return result;
  };
}

function makeReplace(offset, length, string) {
  'use strict';

  return function (source) {
    console.log('Replace');
    return makeInsert(offset, string)(makeDelete(offset, length)(source));
  };
}

source = makeDelete(0, 'NanAssignPersistent('.length)(source);
source = makeReplace('NanAssignPersistent(persistent'.length, ', '.length, '.Reset(')(source);
source = makeDelete('NanAssignPersistent(persistent, '.length, 'args'.length)(source);
console.log(source);
source = makeInsert('NanAssignPersistent(persistent, '.length, 'info')(source);
//source = makeReplace('NanAssignPersistent(persistent, '.length, 'args'.length, 'info')(source);
console.log(source);
