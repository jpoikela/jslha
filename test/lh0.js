const Decoder = require('../lib/decoder.js');
const fs = require('fs');


fs.readFile('test/files/lh0.bin', (err, data) => {
  if (err) throw err;
  console.log('file reading done');

  var decoder = Decoder.forMethod('-lh0-');
  console.log("extracting..");
  console.log(arrayBufferToString(decoder.decode(data, data.size)));
  return
});

function arrayBufferToString(buffer) {

  var bufView = new Uint16Array(buffer);
  var length = bufView.length;
  var result = '';
  var addition = Math.pow(2, 16) - 1;

  for (var i = 0; i < length; i += addition) {

    if (i + addition > length) {
      addition = length - i;
    }
    result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
  }

  return result;

}


