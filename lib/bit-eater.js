'use strict';

var Endianness = {
	BIG_ENDIAN: 1,
	LITTLE_ENDIAN: 2
};
/**********************************************************
 *
 * BitView
 *
 * BitView provides a similar interface to the standard
 * DataView, but with support for bit-level reads / writes.
 *
 **********************************************************/
var BitView = function (source, byteOffset, byteLength, endianness) {
	if (source instanceof Uint8Array) {
		source = source.buffer;
	}
	var isBuffer = source instanceof ArrayBuffer ||
		(typeof Buffer !== 'undefined' && source instanceof Buffer);

	if (!isBuffer) {
		throw new Error('Must specify a valid ArrayBuffer or Buffer.');
	}

	byteOffset = byteOffset || 0;
	byteLength = byteLength || source.byteLength /* ArrayBuffer */ || source.length /* Buffer */;

	this.endianness = endianness || Endianness.BIG_ENDIAN;
	this._view = new Uint8Array(source, byteOffset, byteLength);
};

Object.defineProperty(BitView.prototype, 'buffer', {
	get: function () { return typeof Buffer !== 'undefined' ? Buffer.from(this._view.buffer) : this._view.buffer; },
	enumerable: true,
	configurable: false
});

Object.defineProperty(BitView.prototype, 'byteLength', {
	get: function () { return this._view.length; },
	enumerable: true,
	configurable: false
});

BitView.prototype._setBit = function (offset, on) {
	if (on) {
		this._view[offset >> 3] |= 1 << (7 - (offset & 7));
	} else {
		this._view[offset >> 3] &= ~(1 << (7 - (offset & 7)));
	}
};

BitView.prototype.getBits = function (offset, bits, signed) {
	if (bits > 32) {
		// FIXME: could be solved by not using bitwise operators (bitwise uses 32 bit integers)
		// multiplication, addition, etc, until 53 bits (max safe integer)
		throw new Error('Too many bits read');
	}
	var available = (this._view.length * 8 - offset);

	if (bits > available) {
		throw new Error('Cannot get ' + bits + ' bit(s) from offset ' + offset + ', ' + available + ' available');
	}

	var value = 0;
	for (var i = 0; i < bits;) {
		var remaining = bits - i;
		var bitOffset = offset & 7;
		var currentByte = this._view[offset >> 3];

		// the max number of bits we can read from the current byte
		var read = Math.min(remaining, 8 - bitOffset);

		// create a mask with the correct bit width
		var mask = (1 << read) - 1;
		var readBits;
		if (bitOffset + remaining > 8) {
			readBits = currentByte & mask;
			value |= readBits << (bits - i - read);
		} else {
			// shift the bits we want to the start of the byte and mask of the rest
			readBits = (currentByte >> (8 - bitOffset - remaining)) & mask;
			value |= readBits;
		}

		offset += read;
		i += read;
	}

	if (signed) {
		// If we're not working with a full 32 bits, check the
		// imaginary MSB for this bit count and convert to a
		// valid 32-bit signed value if set.
		if (bits !== 32 && value & (1 << (bits - 1))) {
			value |= -1 ^ ((1 << bits) - 1);
		}

		return value;
	}

	return value >>> 0;
};

BitView.prototype.setBits = function (offset, value, bits) {
	var available = (this._view.length * 8 - offset);

	if (bits > available) {
		throw new Error('Cannot set ' + bits + ' bit(s) from offset ' + offset + ', ' + available + ' available');
	}
	for (var i = 0; i < bits;) {
		var wrote;
		var remaining = bits - i;

		// Write an entire byte if we can.
		if ((bits - i) >= 8 && ((offset & 7) === 0)) {
			this._view[offset >> 3] = (value & (0xFF << (remaining - 8)) >> (remaining - 8));
			wrote = 8;
		} else {
			var bitMask = (1 << (remaining - 1));
			this._setBit(offset, value & bitMask);
			wrote = 1;
		}

		offset += wrote;
		i += wrote;
	}
};

BitView.prototype.fixEndianness = function (bytes) {
	var result = 0;
	if (this.endianness == Endianness.LITTLE_ENDIAN) {
		bytes.reverse();
	}
	for (var i = 0; i < bytes.length; i++) {
		result |= (bytes[i] << (8 * i));
	}
	return result;
};
BitView.prototype.getBoolean = function (offset) {
	return this.getBits(offset, 1, false) !== 0;
};
BitView.prototype.getInt8 = function (offset) {
	return this.getBits(offset, 8, true);
};
BitView.prototype.getUint8 = function (offset) {
	return this.getBits(offset, 8, false);
};
BitView.prototype.getInt16 = function (offset) {
	return this.fixEndianness([
		this.getBits(offset, 8, false),
		this.getBits(offset + 8, 8, true)]);
};
BitView.prototype.getUint16 = function (offset) {
	return this.fixEndianness([
		this.getBits(offset, 8, false),
		this.getBits(offset + 8, 8, false)]) >>> 0;
};
BitView.prototype.getInt32 = function (offset) {
	return this.fixEndianness([
		this.getUint8(offset),
		this.getUint8(offset + 8),
		this.getUint8(offset + 16),
		this.getInt8(offset + 24)]);
};
BitView.prototype.getUint32 = function (offset) {
	return this.fixEndianness([
		this.getUint8(offset),
		this.getUint8(offset + 8),
		this.getUint8(offset + 16),
		this.getUint8(offset + 24)]) >>> 0;
};

BitView.prototype.setBoolean = function (offset, value) {
	this.setBits(offset, value ? 1 : 0, 1);
};
BitView.prototype.setInt8 =
	BitView.prototype.setUint8 = function (offset, value) {
		this.setBits(offset, value, 8);
	};
BitView.prototype.setBytes = function (offset, bytes) {
	if (this.endianness == Endianness.LITTLE_ENDIAN) {
		bytes.reverse();
	}
	for (var i = 0; i < bytes.length; i++) {
		this.setBits(offset + (i * 8), bytes[i], 8);
	}
};
BitView.prototype.setInt16 =
	BitView.prototype.setUint16 = function (offset, value) {
		var low = value & 0xFF;
		var high = value >> 8;
		this.setBytes(offset, [low, high]);
	};
BitView.prototype.setInt32 =
	BitView.prototype.setUint32 = function (offset, value) {
		var bytes = [];
		for (var i = 0; i < 4; i++) {
			bytes.push(value & 0xFF);
			value = value >> 8;
		}
		this.setBytes(offset, bytes);
	};
BitView.prototype.getArrayBuffer = function (offset, byteLength) {
	var buffer = new Uint8Array(byteLength);
	for (var i = 0; i < byteLength; i++) {
		buffer[i] = this.getUint8(offset + (i * 8));
	}
	return buffer;
};

/**********************************************************
 *
 * BitStream
 *
 * Small wrapper for a BitView to maintain your position,
 * as well as to handle reading / writing of string data
 * to the underlying buffer.
 *
 **********************************************************/
var reader = function (name, size) {
	return function () {
		if (this._index + size > this._length) {
			throw new Error('Trying to read past the end of the stream');
		}
		var val = this._view[name](this._index);
		this._index += size;
		return val;
	};
};

var writer = function (name, size) {
	return function (value) {
		this._view[name](this._index, value);
		this._index += size;
	};
};

function readASCIIString(stream, bytes) {
	return readString(stream, bytes);
}

function readString(stream, bytes) {
	if (bytes === 0) {
		return '';
	}
	var i = 0;
	var chars = [];
	var append = true;
	var fixedLength = !!bytes;
	if (!bytes) {
		bytes = Math.floor((stream._length - stream._index) / 8);
	}

	// Read while we still have space available, or until we've
	// hit the fixed byte length passed in.
	while (i < bytes) {
		var c = stream.readUint8();

		// Stop appending chars once we hit 0x00
		if (c === 0x00) {
			append = false;

			// If we don't have a fixed length to read, break out now.
			if (!fixedLength) {
				break;
			}
		}
		if (append) {
			chars.push(c);
		}
		i++;
	}

	return String.fromCharCode.apply(null, chars);
}

function writeASCIIString(stream, string, bytes) {
	var length = bytes || string.length + 1;  // + 1 for NULL

	for (var i = 0; i < length; i++) {
		stream.writeUint8(i < string.length ? string.charCodeAt(i) : 0x00);
	}
}

function writeUTF8String(stream, string, bytes) {
	var byteArray = stringToByteArray(string);

	var length = bytes || byteArray.length + 1;  // + 1 for NULL
	for (var i = 0; i < length; i++) {
		stream.writeUint8(i < byteArray.length ? byteArray[i] : 0x00);
	}
}

function stringToByteArray(str) { // https://gist.github.com/volodymyr-mykhailyk/2923227
	var b = [], i, unicode;
	for (i = 0; i < str.length; i++) {
		unicode = str.charCodeAt(i);
		// 0x00000000 - 0x0000007f -> 0xxxxxxx
		if (unicode <= 0x7f) {
			b.push(unicode);
			// 0x00000080 - 0x000007ff -> 110xxxxx 10xxxxxx
		} else if (unicode <= 0x7ff) {
			b.push((unicode >> 6) | 0xc0);
			b.push((unicode & 0x3F) | 0x80);
			// 0x00000800 - 0x0000ffff -> 1110xxxx 10xxxxxx 10xxxxxx
		} else if (unicode <= 0xffff) {
			b.push((unicode >> 12) | 0xe0);
			b.push(((unicode >> 6) & 0x3f) | 0x80);
			b.push((unicode & 0x3f) | 0x80);
			// 0x00010000 - 0x001fffff -> 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
		} else {
			b.push((unicode >> 18) | 0xf0);
			b.push(((unicode >> 12) & 0x3f) | 0x80);
			b.push(((unicode >> 6) & 0x3f) | 0x80);
			b.push((unicode & 0x3f) | 0x80);
		}
	}

	return b;
}

var BitStream = function (source, byteOffset, byteLength, endianness) {
	if (source instanceof Uint8Array) {
		source = source.buffer;
	}
	var isBuffer = source instanceof ArrayBuffer ||
		(typeof Buffer !== 'undefined' && source instanceof Buffer);

	if (!(source instanceof BitView) && !isBuffer) {
		throw new Error('Must specify a valid BitView, ArrayBuffer or Buffer');
	}

	if (isBuffer) {
		this._view = new BitView(source, byteOffset, byteLength, endianness);
	} else {
		this._view = source;
	}

	this._index = 0;
	this._startIndex = 0;
	this._length = this._view.byteLength * 8;
};

Object.defineProperty(BitStream.prototype, 'index', {
	get: function () { return this._index - this._startIndex; },
	set: function (val) { this._index = val + this._startIndex; },
	enumerable: true,
	configurable: true
});

Object.defineProperty(BitStream.prototype, 'length', {
	get: function () { return this._length - this._startIndex; },
	set: function (val) { this._length = val + this._startIndex; },
	enumerable: true,
	configurable: true
});

Object.defineProperty(BitStream.prototype, 'bitsLeft', {
	get: function () { return this._length - this._index; },
	enumerable: true,
	configurable: true
});

Object.defineProperty(BitStream.prototype, 'byteIndex', {
	// Ceil the returned value, over compensating for the amount of
	// bits written to the stream.
	get: function () { return Math.ceil(this._index / 8); },
	set: function (val) { this._index = val * 8; },
	enumerable: true,
	configurable: true
});

Object.defineProperty(BitStream.prototype, 'buffer', {
	get: function () { return this._view.buffer; },
	enumerable: true,
	configurable: false
});

Object.defineProperty(BitStream.prototype, 'view', {
	get: function () { return this._view; },
	enumerable: true,
	configurable: false
});

BitStream.prototype.readBits = function (bits, signed) {
	var val = this._view.getBits(this._index, bits, signed);
	this._index += bits;
	return val;
};

BitStream.prototype.writeBits = function (value, bits) {
	this._view.setBits(this._index, value, bits);
	this._index += bits;
};

BitStream.prototype.readBoolean = reader('getBoolean', 1);
BitStream.prototype.readInt8 = reader('getInt8', 8);
BitStream.prototype.readUint8 = reader('getUint8', 8);
BitStream.prototype.readInt16 = reader('getInt16', 16);
BitStream.prototype.readUint16 = reader('getUint16', 16);
BitStream.prototype.readInt32 = reader('getInt32', 32);
BitStream.prototype.readUint32 = reader('getUint32', 32);

BitStream.prototype.writeBoolean = writer('setBoolean', 1);
BitStream.prototype.writeInt8 = writer('setInt8', 8);
BitStream.prototype.writeUint8 = writer('setUint8', 8);
BitStream.prototype.writeInt16 = writer('setInt16', 16);
BitStream.prototype.writeUint16 = writer('setUint16', 16);
BitStream.prototype.writeInt32 = writer('setInt32', 32);
BitStream.prototype.writeUint32 = writer('setUint32', 32);

BitStream.prototype.readASCIIString = function (bytes) {
	return readASCIIString(this, bytes);
};

BitStream.prototype.writeASCIIString = function (string, bytes) {
	writeASCIIString(this, string, bytes);
};

BitStream.prototype.readBitStream = function (bitLength) {
	var slice = new BitStream(this._view);
	slice._startIndex = this._index;
	slice._index = this._index;
	slice.length = bitLength;
	this._index += bitLength;
	return slice;
};

BitStream.prototype.writeBitStream = function (stream, length) {
	if (!length) {
		length = stream.bitsLeft;
	}

	var bitsToWrite;
	while (length > 0) {
		bitsToWrite = Math.min(length, 8);
		this.writeBits(stream.readBits(bitsToWrite), bitsToWrite);
		length -= bitsToWrite;
	}
};

BitStream.prototype.readArrayBuffer = function (byteLength) {
	var buffer = this._view.getArrayBuffer(this._index, byteLength);
	this._index += (byteLength * 8);
	return buffer;
};

BitStream.prototype.writeArrayBuffer = function (buffer, byteLength) {
	this.writeBitStream(new BitStream(buffer), byteLength * 8);
};

module.exports = {
	BitView: BitView,
	BitStream: BitStream,
	Endianness: Endianness
};
