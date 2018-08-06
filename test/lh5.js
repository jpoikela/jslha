const Decoder = require('../lib/decoder.js');
const fs = require('fs');


fs.readFile('test/files/lh5.bin', (err, data) => {
  if (err) throw err;
  console.log('file reading done');

  var decoder = Decoder.forMethod('-lh5-');
  console.log("extracting..");
  console.log(arrayBufferToString(decoder.decode(data, 18091)));
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


