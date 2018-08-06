'use strict';

var NewDecoder = require('./new_decoder');
var NullDecoder = require('./null_decoder');

function Decoder() {
}

Decoder.forMethod = function (name) {
  switch (name) {
    case '-lh0-':
      console.log('decoder lh0');
      return new NullDecoder();
    case '-lh5-':
      console.log('decoder lh5');
      var config = NewDecoder.getNewDecoderConfig(14, 4);
      return new NewDecoder.NewDecoder(config);
    default:
      return null;
  }
};


module.exports = Decoder;
