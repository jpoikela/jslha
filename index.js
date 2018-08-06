
var bb = require('./lib/bit-eater');
var fs = require('fs');
var Archive = require('./lib/archive');

console.log('start');
var myArgs = process.argv.slice(2);

if (myArgs) {
  fs.readFile(myArgs[0], (err, data) => {
    if (err) throw err;
    console.log('file reading done');
    archive = new Archive(data);
    archive.parseFile();
    for (var i = 0; i < archive.sequence.length; i++) {
      console.log(archive.sequence[i].name);
      console.log(archive.sequence[i].method);
      data = archive.extract(i);
      console.log("extracted " + data.length + " bytes");
    }
    var data = archive.extractByName('FILE_ID.DIZ');
    console.log("extracted " + data.length + " bytes");
  });
} else {
  console.log("Usage: node index.js <lzh archive>")
}

