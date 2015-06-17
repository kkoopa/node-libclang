var fs = require('fs');

var Rope = function (data) {
	if (!(this instanceof Rope)) {
		return new Rope(data);
	}

	if (typeof data === 'string') {
		data = new Buffer(data);
	}

	this.value = data;
	this.length = data.length;
	adjust.call(this);
};

Rope.SPLIT_LENGTH = 4096 / 64;

Rope.JOIN_LENGTH = 2048 / 64;

Rope.REBALANCE_RATIO = 1.2;

function adjust() {
	var divide;

	if (typeof this.value !== 'undefined' && this.length > Rope.SPLIT_LENGTH) {
		divide = this.length / 2 | 0;
		this.left = new Rope(this.value.slice(0, divide));
		this.right = new Rope(this.value.slice(divide));
		delete this.value;
	} else if (this.length < Rope.JOIN_LENGTH) {
		this.value = Buffer.concat([this.left.collate(), this.right.collate()], this.left.length + this.right.length);
		delete this.left;
		delete this.right;
	}
}

Rope.prototype.collate = function () {
	if (typeof this.value !== 'undefined') {
		return this.value;
	} else {
		return Buffer.concat([this.left.collate(), this.right.collate()], this.left.length + this.right.length);
	}
};

Rope.prototype.toString = function () {
	return this.collate().toString();
};

Rope.prototype.write = function (fd, callback) {
	var self = this;

	console.log('write');
	console.log('type', typeof this.value);

	if (typeof this.value !== 'undefined') {
		console.log(this.value.toString());
		console.log(callback.toString());
		fs.write(fd, this.value, callback);
	} else {
		/*this.left.write(fd, function (err, written, buffer) {
			if (err) {
				if (callback) {
					callback(err);
				} else {
					throw new Error('Error writing to file.');
				}
			}else {
				self.right.write(fd, callback);
			}
		});*/
		this.left.write(fd, callback);
		this.right.write(fd, callback);
	}
};

Rope.prototype.writeFile = function (filename, callback) {
	var self = this;

	fs.open(filename, 'w', function (err, fd) {
		if (err) {
			if (callback) {
				callback(err);
			} else {
				throw new Error('Error opening file.');
			}
		} else {
			self.write(fd, callback);
		}
	});
};


Rope.prototype.remove = function (start, end) {
	var leftLength,
	    leftStart,
	    leftEnd,
	    rightLength,
	    rightStart,
	    rightEnd;

	if (start < 0 || start > this.length) {
		throw new RangeError('Start is not within rope bounds.');
	}

	if (end < 0 || end > this.length) {
		throw new RangeError('End is not within rope bounds.');
	}

	if (start > end) {
		throw new RangeError('Start is greater than end.');
	}

	if (typeof this.value !== 'undefined') {
		this.value = this.value.slice(0, start) + this.value.slice(end);
		this.length = this.value.length;
	} else {
		leftLength = this.left.length;
		leftStart = Math.min(start, leftLength);
		leftEnd = Math.min(end, leftLength);
		rightLength = this.right.length;
		rightStart = Math.max(0, Math.min(start - leftLength, rightLength));
		rightEnd = Math.max(0, Math.min(end - leftlength, rightlength));

		if (leftStart < leftLength) {
			this.left.remove(leftStart, leftEnd);
		}

		if (rightEnd > 0) {
			this.right.remove(rightStart, rightEnd);
		}

		this.length = this.left.length + this.right.length;
	}

	adjust.call(this);
};

Rope.prototype.insert = function (position, data) {
	var leftLength;

	if (!(data instanceof Buffer)) {
		data = new Buffer(data);
	}

	if (position < 0 || position > this.length) {
		throw new RangeError('Position is not within rope bounds.');
	}

	if (typeof this.value !== 'undefined') {
		this.value = Buffer.concat([this.value.slice(0, position), data, this.value.slice(position)], this.length + data.length);
		this.length = this.value.length;
	} else {
		leftLength = this.left.length;

		if (position < leftLength) {
			this.left.insert(position, value);
			this.length = this.left.length + this.right.length;
		} else {
			this.right.insert(position - leftLength, data);
		}
	}

	adjust.call(this);
};

Rope.prototype.rebuild = function () {
	if (typeof this.value === 'undefined') {
		this.value = Buffer.concat([this.left.collate, this.right.collate], this.length);
		delete this.left;
		delete this.right;
		adjust.call(this);
	}
};

Rope.prototype.rebalance = function () {
	if (typeof this.value === 'undefined') {
		if (this.left.length / this.right.length > Rope.REBALANCE_RATIO || this.right.length / this.left.length > Rope.REBALANCE_RATIO) {
			this.rebuild();
		} else {
			this.left.rebalance();
			this.right.rebalance();
		}
	}
};

Rope.prototype.slice = function (start, end) {
        var leftLength,
            leftStart,
            leftEnd,
            rightLength,
            rightStart,
            rightEnd;

	if (typeof end === 'undefined') {
		end = this.length;
	}

	if (start < 0 || isNan(start)) {
		start = 0;
	} else if (start > this.length) {
		start = this.length;
	}

	if (end < 0 || isNan(end)) {
		end = 0;
	} else if (end > this.length) {
		end = this.length;
	}

	if (typeof this.value !== 'undefined') {
		return this.value.slice(start, end);
	} else {
		leftLength = this.left.length;
                leftStart = Math.min(start, leftLength);
                leftEnd = Math.min(end, leftLength);
                rightLength = this.right.length;
                rightStart = Math.max(0, Math.min(start - leftLength, rightLength));
                rightEnd = Math.max(0, Math.min(end - leftlength, rightlength));

		if (leftStart !== leftEnd) {
			if (rightStart !== rightEnd) {
				return Buffer.concat([this.left.slice(leftStart, leftEnd), this.right.slice(rightStart, rightEnd)], leftLength + rightLength);
			} else {
				return this.left.slice(leftStart, leftEnd);
			}
		} else {
			if (rightStart !== rightEnd) {
				return this.right.slice(rightStart, rightEnd);
			} else {
				return new Buffer();
			}
		}
	}
};

Rope.prototype.substring = function (start, end) {
	return this.slice(start, end).toString();
}

Rope.prototype.substr = function (start, length) {
	var end;

	if (start < 0) {
		start = this.length + start;
		start = Math.max(0, start);
	}

	if (typeof length === 'undefined') {
		end = this.length;
	} else {
		length = Math.max(0, length);
		end = start + length;
	}

	return this.substring(start, end);
};

Rope.prototype.print_tree = function (level) {
	var i;

	for (i = 0; i < level; i++) {
		process.stdout.write('│   ');
	}

	if (this.left) {
		process.stdout.write(['├── ', typeof this.value === 'undefined' ? '<node>' : this.value.toString(), ' (', this.length, ')\n'].join(''));
	} else {
		process.stdout.write(['└── ', typeof this.value === 'undefined' ? '<node>' : this.value.toString(), ' (', this.length, ')\n'].join(''));
	}

	if (typeof this.right !== 'undefined') {
		Rope.prototype.print_tree.call(this.right, level + 1);
	}

	if (typeof this.left !== 'undefined') {
		Rope.prototype.print_tree.call(this.left, level);
	}
};

module.exports = Rope;

var source = "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair, we had everything before us, we had nothing before us, we were all going direct to Heaven, we were all going direct the other way--in short, the period was so far like the present period, that some of its noisiest authorities insisted on its being received, for good or for evil, in the superlative degree of comparison only.\n" +

"There were a king with a large jaw and a queen with a plain face, on the throne of England; there were a king with a large jaw and a queen with a fair face, on the throne of France. In both countries it was clearer than crystal to the lords of the State preserves of loaves and fishes, that things in general were settled for ever.\n" +

"It was the year of Our Lord one thousand seven hundred and seventy-five. Spiritual revelations were conceded to England at that favoured period, as at this. Mrs. Southcott had recently attained her five-and-twentieth blessed birthday, of whom a prophetic private in the Life Guards had heralded the sublime appearance by announcing that arrangements were made for the swallowing up of London and Westminster. Even the Cock-lane ghost had been laid only a round dozen of years, after rapping out its messages, as the spirits of this very year last past (supernaturally deficient in originality) rapped out theirs. Mere messages in the earthly order of events had lately come to the English Crown and People, from a congress of British subjects in America: which, strange to relate, have proved more important to the human race than any communications yet received through any of the chickens of the Cock-lane brood.\n" +

"France, less favoured on the whole as to matters spiritual than her sister of the shield and trident, rolled with exceeding smoothness down hill, making paper money and spending it. Under the guidance of her Christian pastors, she entertained herself, besides, with such humane achievements as sentencing a youth to have his hands cut off, his tongue torn out with pincers, and his body burned alive, because he had not kneeled down in the rain to do honour to a dirty procession of monks which passed within his view, at a distance of some fifty or sixty yards. It is likely enough that, rooted in the woods of France and Norway, there were growing trees, when that sufferer was put to death, already marked by the Woodman, Fate, to come down and be sawn into boards, to make a certain movable framework with a sack and a knife in it, terrible in history. It is likely enough that in the rough outhouses of some tillers of the heavy lands adjacent to Paris, there were sheltered from the weather that very day, rude carts, bespattered with rustic mire, snuffed about by pigs, and roosted in by poultry, which the Farmer, Death, had already set apart to be his tumbrils of the Revolution. But that Woodman and that Farmer, though they work unceasingly, work silently, and no one heard them as they went about with muffled tread: the rather, forasmuch as to entertain any suspicion that they were awake, was to be atheistical and traitorous.\n" +

"In England, there was scarcely an amount of order and protection to justify much national boasting. Daring burglaries by armed men, and highway robberies, took place in the capital itself every night; families were publicly cautioned not to go out of town without removing their furniture to upholsterers' warehouses for security; the highwayman in the dark was a City tradesman in the light, and, being recognised and challenged by his fellow- tradesman whom he stopped in his character of \"the Captain,\" gallantly shot him through the head and rode away; the mall was waylaid by seven robbers, and the guard shot three dead, and then got shot dead himself by the other four, \"in consequence of the failure of his ammunition:\" after which the mall was robbed in peace; that magnificent potentate, the Lord Mayor of London, was made to stand and deliver on Turnham Green, by one highwayman, who despoiled the illustrious creature in sight of all his retinue; prisoners in London gaols fought battles with their turnkeys, and the majesty of the law fired blunderbusses in among them, loaded with rounds of shot and ball; thieves snipped off diamond crosses from the necks of noble lords at Court drawing-rooms; musketeers went into St. Giles's, to search for contraband goods, and the mob fired on the musketeers, and the musketeers fired on the mob, and nobody thought any of these occurrences much out of the common way. In the midst of them, the hangman, ever busy and ever worse than useless, was in constant requisition; now, stringing up long rows of miscellaneous criminals; now, hanging a housebreaker on Saturday who had been taken on Tuesday; now, burning people in the hand at Newgate by the dozen, and now burning pamphlets at the door of Westminster Hall; to-day, taking the life of an atrocious murderer, and to-morrow of a wretched pilferer who had robbed a farmer's boy of sixpence.\n" +

"All these things, and a thousand like them, came to pass in and close upon the dear old year one thousand seven hundred and seventy-five. Environed by them, while the Woodman and the Farmer worked unheeded, those two of the large jaws, and those other two of the plain and the fair faces, trod with stir enough, and carried their divine rights with a high hand. Thus did the year one thousand seven hundred and seventy-five conduct their Greatnesses, and myriads of small creatures--the creatures of this chronicle among the rest--along the roads that lay before them.";

var rope = new Rope(source);
//rope.remove(2, 6);
//console.log(rope.toString());
//rope.print_tree(0);
rope.writeFile('output', function (err, written, buffer) {
	if (err) {
		throw err;
	}

	console.log('wrote', written);
	console.log('data', buffer.toString());
});
