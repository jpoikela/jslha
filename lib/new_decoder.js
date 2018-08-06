'use strict';

var bb = require('./bit-eater');
var tree = require('./tree');

function NewDecoder(options) {
  if (!(this instanceof NewDecoder))
    return new NewDecoder(options);

  this.options = options;
  this.ringBuffer = newArray(options.ringBufferSize, 0);
  this.ringBufferPosition = 0;
  this.blockRemaining = 0;
  this.codeTree = new tree.Tree(options.numCodes * 2);
  this.offsetTree = new tree.Tree(options.maxTempCodes * 2);
  this.outputStream = [];
}

function newArray(len, value) {
  var result = new Array(len);
  while (--len >= 0) {
    result[len] = value;
  }
  return result;
}

function getNewDecoderConfig(historyBits, offsetBits) {
  var rBufSize = 1 << historyBits;
  return {
    copyThreshold: 3,
    historyBits: historyBits,
    offsetBits: offsetBits,
    ringBufferSize: rBufSize,
    outputBufferSize: rBufSize,
    // maxReadSize: this.outputBufferSize,
    numCodes: 510,
    maxTempCodes: 20
  };
}

NewDecoder.prototype.decode = function (data, originalSize) {
  this.bitstream = new bb.BitStream(data.buffer, null, null, bb.Endianness.LITTLE_ENDIAN);

  // lhasa input_stream, short-cut
  // FIXME: check the size of output
  var bytesRemaining = data.length;
  var totalBytes = 0;
  do {
    // from lha_reader::do_decode

    // from lha_decoder::read
    var bytesOutput = this.readAndOutput();
    if (!bytesOutput) {
      console.log("reading a code failed");
      throw new Error('Decoding failed: got nothing');
    } else {
      totalBytes += bytesOutput;
    }

  } while (bytesRemaining > 0 && totalBytes < originalSize);

  if (totalBytes == this.options.outputBufferSize) {
    console.log('full decode');
  }

  this.bitstream = null;
  return this.outputStream;
};

NewDecoder.prototype.readLength = function () {
  var len = this.bitstream.readBits(3);
  if (len < 0)
    return -1;
  if (len == 7) {
    for (; ;) {
      var i = this.bitstream.readBits(1);
      if (i < 0) return -1;
      else if (i == 0) break;
      len++;
    }
  }
  return len;
};

NewDecoder.prototype.readTempTable = function () {

  var n = this.bitstream.readBits(5);
  if (n < 0) return 0;

  if (n == 0) {
    var code = this.bitstream.readBits(5);
    if (code < 0) return 0;
    this.offsetTree.setSingle(code);
    return 1;
  }
  n = Math.min(n, this.options.maxTempCodes);
  var codeLengths = [];
  for (var i = 0; i < n; i++) {
    var len = this.readLength();
    if (len < 0) return 0;
    codeLengths.push(len);
    if (i == 2) {
      len = this.bitstream.readBits(2);
      if (len < 0) return 0;
      for (var j = 0; j < len; j++) {
        i++;
        codeLengths.push(0);
      }
    }
  }
  tree.buildTree(this.offsetTree, this.options.maxTempCodes * 2, codeLengths, n);
};

NewDecoder.prototype.readAndOutput = function () {
  while (this.blockRemaining == 0) {
    if (!this.startNewBlock()) return 0;
  }
  --this.blockRemaining;
  var result = 0;
  var code = this.codeTree.read(this.bitstream);
  if (code < 0) return 0;
  if (code < 256) {
    result = this.outputByte(code);
  } else {
    result = this.copyFromHistory(code - 256 + this.options.copyThreshold);
  }
  return result;
};

var printByte = function (byte) {
  var hex = byte.toString(16);
  hex = hex.length == 1 ? '0x0' + hex : '0x' + hex;
  console.log("%s", hex);
};

NewDecoder.prototype.outputByte = function (byte) {
  // printByte(byte);
  this.outputStream.push(byte);
  this.ringBuffer[this.ringBufferPosition] = byte;
  this.ringBufferPosition = (this.ringBufferPosition + 1) % this.options.ringBufferSize;
  return 1;
};

NewDecoder.prototype.copyFromHistory = function (count) {
  var offset = this.readOffsetCode();
  if (offset < 0) return;
  // FIXME: need to check this is correct >>>
  var start = this.ringBufferPosition + this.options.ringBufferSize - offset - 1;
  for (var i = 0; i < count; i++) {
    this.outputByte(this.ringBuffer[(start + i) % this.options.ringBufferSize]);
  }
  return count;
};

NewDecoder.prototype.readOffsetCode = function () {
  var bits = this.offsetTree.read(this.bitstream);
  if (bits < 0) return -1;
  if (bits == 0) return 0;
  else if (bits == 1) {
    return 1;
  } else {
    var result = this.bitstream.readBits(bits - 1);
    if (result < 0) return -1;
    return result + (1 << (bits - 1));
  }
};

NewDecoder.prototype.startNewBlock = function () {
  var len = this.bitstream.readInt16();
  if (len < 0) return 0;
  this.blockRemaining = len;
  if (!this.readTempTable()) return 0;
  if (!this.readCodeTable()) return 0;
  if (!this.readOffsetTable()) return 0;
  return 1;
};

NewDecoder.prototype.readSkipCount = function (skipRange) {
  var result = 0;
  if (skipRange == 0) result = 1;
  // skiprange=1 => 3-18 codes
  else if (skipRange == 1) {
    result = this.bitstream.readBits(4);
    if (result < 0) return -1;
    result += 3;
  }
  // skiprange=2 => 20+ codes.
  else {
    result = this.bitstream.readBits(9);
    if (result < 0) return -1;
    result += 20;
  }
  return result;
};

NewDecoder.prototype.readTempTable = function () {
  var codeLengths = newArray(this.options.maxTempCodes, 0);
  var n = this.bitstream.readBits(5, false);
  if (n < 0) return 0;
  if (n == 0) {
    var code = this.bitstream.readBits(5);
    if (code < 0) return 0;
    this.offsetTree.setSingle(code);
    return 1;
  }
  n = Math.min(n, this.options.maxTempCodes);
  for (var i = 0; i < n; i++) {
    var len = this.readLength();
    if (len < 0) return 0;
    codeLengths[i] = len;
    if (i == 2) {
      len = this.bitstream.readBits(2);
      if (len < 0) return 0;
      for (var j = 0; j < len; j++) {
        i++;
        codeLengths[i] = 0;
      }
    }
  }
  tree.buildTree(this.offsetTree, this.options.maxTempCodes * 2, codeLengths, n);
  return 1;
};

NewDecoder.prototype.readCodeTable = function () {
  var codeLengths = newArray(this.options.numCodes, 0);
  var n = this.bitstream.readBits(9);
  var code;
  if (n < 0) return 0;
  if (n == 0) {
    code = this.bitstream.readBits(9);
    if (code < 0) return 0;
    this.codeTree.setSingle(code);
    return 1;
  }
  n = Math.min(n, this.options.numCodes);
  var i = 0;
  while (i < n) {
    code = this.offsetTree.read(this.bitstream);
    if (code < 0) return 0;
    if (code <= 2) {
      var skipCount = this.readSkipCount(code);
      if (skipCount < 0) return 0;
      for (var j = 0; j < skipCount && i < n; j++) {
        codeLengths[i] = 0;
        i++;
      }
    } else {
      codeLengths[i] = code - 2;
      i++;
    }
  }
  tree.buildTree(this.codeTree, this.options.numCodes * 2, codeLengths, n);
  return 1;
};

NewDecoder.prototype.readOffsetTable = function () {
  var codeLengths = newArray(this.options.historyBits, 0);
  var n = this.bitstream.readBits(this.options.offsetBits);
  if (n < 0) return 0;
  if (n == 0) {
    var code = this.bitstream.readBits(this.options.offsetBits);
    if (code < 0) return 0;
    this.offsetTree.setSingle(code);
    return 1;
  }
  n = Math.min(n, this.options.historyBits);
  for (var i = 0; i < n; i++) {
    var len = this.readLength();
    if (len < 0) return 0;
    codeLengths[i] = len;
  }
  tree.buildTree(this.offsetTree, this.options.maxTempCodes * 2, codeLengths, n);
  return 1;
};

module.exports = {
  NewDecoder: NewDecoder,
  getNewDecoderConfig: getNewDecoderConfig
};
