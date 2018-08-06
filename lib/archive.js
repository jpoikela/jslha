'use strict';

var bb = require('./bit-eater');
var Decoder = require('./decoder');


function Archive(data) {
  this.data = data;
  this.bitstream = new bb.BitStream(data);
  this.sequence = [];
  this.files = {};
}

Archive.prototype.getSequence = function () {
  return this.sequence;
};

Archive.prototype.getFiles = function () {
  return this.files;
};

Archive.prototype.extract = function (index) {
  var decoder = Decoder.forMethod(this.sequence[index].method);
  console.log("extracting");
  console.log(this.sequence[index]);
  var fileHeader = this.sequence[index];
  fileHeader.content = decoder.decode(fileHeader.data, fileHeader.uncompressedSize);
  return fileHeader.content;
};

Archive.prototype.extractByName = function (name) {
  for (var i = 0; i < this.sequence.length; i++) {
    if (name == this.sequence[i].name) {
      return this.extract(i);
    }
  }
  // not found
  return [];
};

Archive.prototype.parseFile = function () {
  do {
    var level = this.peekNextHeaderLevel();
    console.log("level" + level);
    switch (level) {
      case 0:
        this.sequence.push(this.parseHeadersLevel0());
        break;
      case 1:
        this.sequence.push(this.parseHeadersLevel1());
        break;
      default:
        console.log("level not implemented" + level);
        break;
    }
  } while (this.peekNextHeaderSize() != 0);

  this.files = {};
  for (var i = 0; i < this.sequence.length; i++) {
    this.files[this.sequence[i].name] = this.sequence[i];
  }
  return this.files;
};

Archive.prototype.peekNextHeaderSize = function () {
  console.log("peeking at " + this.bitstream.index);
  return this.bitstream.view.getUint8(this.bitstream.index);
};

Archive.prototype.peekNextHeaderLevel = function () {
  console.log("peeking next header level at " + (this.bitstream.index + 20 * 8));
  return this.bitstream.view.getUint8(this.bitstream.index + 20 * 8);
};


/*
Offset   Length   Contents
  0      1 byte   Size of archived file header (h)
  1      1 byte   Header checksum
  2      5 bytes  Method ID
  7      4 bytes  Compressed size (n)
 11      4 bytes  Uncompressed size
 15      4 bytes  Original file date/time (Generic time stamp)
 19      1 byte   File attribute
 20      1 byte   Level (0x00)
 21      1 byte   Filename / path length in bytes (f)
 22     (f)bytes  Filename / path
 22+(f)  2 bytes  CRC-16 of original file
 24+(f) (n)bytes  Compressed data
 */
Archive.prototype.parseHeadersLevel0 = function () {
  var level0 = {
    headerSize: this.bitstream.readUint8(),
    headerCRC: this.bitstream.readUint8(),
    method: this.bitstream.readASCIIString(5),
    compressedSize: this.bitstream.readUint32(),
    uncompressedSize: this.bitstream.readUint32(),
    originalTimestamp: this.bitstream.readUint32(),
    fileAttribute: this.bitstream.readUint8(),
    level: this.bitstream.readUint8(),
    filenameLength: this.bitstream.readUint8(),
    // webmsx compatibility
    content: null,
    isDir: false,
    asUint8Array: function () { return this.content; }
  };
  var filename = this.bitstream.readASCIIString(level0.filenameLength);
  var originalFileCRC16 = this.bitstream.readUint16();
  var data = this.bitstream.readArrayBuffer(level0.compressedSize);
  level0.name = filename;
  level0.originalFileCRC16 = originalFileCRC16;
  level0.data = data;
  // webmsx compatibility
  level0.lastModifiedDate = new Date(level0.originalTimestamp * 1000);
  return level0;
};

/*
level-1
Offset   Length   Contents
  0      1 byte   Size of archived file header (h)
  1      1 byte   Header checksum
  2      5 bytes  Method ID
  7      4 bytes  Compressed size (n)
 11      4 bytes  Uncompressed size
 15      4 bytes  Original file date/time (Generic time stamp)
 19      1 byte   0x20
 20      1 byte   Level (0x01)
 21      1 byte   Filename / path length in bytes (f)
 22     (f)bytes  Filename / path
 22+(f)  2 bytes  CRC-16 of original file
 24+(f)  1 byte   OS ID
 25+(f)  2 bytes  Next header size(x) (0 means no extension header)
[ // Extension headers
         1 byte   Extension type
     (x)-3 bytes  Extension fields
         2 bytes  Next header size(x) (0 means no next extension header)
]*
        (n)bytes  Compressed data

*/

Archive.prototype.parseHeadersLevel1 = function () {
  var level1 = {
    headerSize: this.bitstream.readUint8(),
    headerCRC: this.bitstream.readUint8(),
    method: this.bitstream.readASCIIString(5),
    compressedSize: this.bitstream.readUint32(),
    uncompressedSize: this.bitstream.readUint32(),
    originalTimestamp: this.bitstream.readUint32(),
    fileAttribute: this.bitstream.readUint8(),
    level: this.bitstream.readUint8(),
    filenameLength: this.bitstream.readUint8(),
    // webmsx compatibility
    content: null,
    isDir: false,
    asUint8Array: function () { return this.content; }
  };
  var filename = this.bitstream.readASCIIString(level1.filenameLength);
  var originalFileCRC16 = this.bitstream.readUint16();
  var osId = this.bitstream.readASCIIString(1);
  var extraHeaders = [];
  for (var headerSize = this.bitstream.readUint16(); headerSize > 0;) {
    var header = [];
    for (var i = 0; i < headerSize - 2; i++) {
      header.push(this.bitstream.readUint8());
    }
    extraHeaders.push(header);
  }
  var data = this.bitstream.readArrayBuffer(level1.compressedSize);
  level1.osId = osId;
  level1.extraHeaders = extraHeaders;
  level1.name = filename;
  level1.originalFileCRC16 = originalFileCRC16;
  level1.data = data;
  // webmsx compatibility
  level1.lastModifiedDate = new Date(level1.originalTimestamp * 1000);
  return level1;
};
// TODO: level2

module.exports = Archive;
