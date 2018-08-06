'use strict';

function NullDecoder() {
}

NullDecoder.prototype.decode = function (data, uncompressedSize) {
  if (data.length == uncompressedSize) {
    return data;
  }
  else {
    console.log('Warning data length does not math the original');
    return [];
  }
};

module.exports = NullDecoder;
