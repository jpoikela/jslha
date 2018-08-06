'use strict';

var Archive = require('./archive');

function JSLha(content) {
  if (!(this instanceof JSLha)) {
    return new JSLha(content);
  }
  this.content = content;
  this.archive = new Archive(content);
  this.archive.parseFile();
  for (var i = 0; i < this.archive.sequence.length; i++) {
    var data = this.archive.extract(i);
    console.log("extracted " + data.length + " bytes");
    this.archive.sequence[i].content = data;
  }

  this.files = this.archive.sequence;
}

JSLha.prototype.file = function (regex_or_name) {
  if (Object.prototype.toString.call(regex_or_name) === "[object RegExp]") {
    console.log('JSLha::file regex');
    var regexp = regex_or_name;
    return this.filter(function (relativePath, file) {
      return !file.dir && regexp.test(relativePath);
    });
  }
  else { // text
    console.log('JSLha::file filename');
    var name = regex_or_name;
    return this.filter(function (relativePath, file) {
      return !file.dir && relativePath === name;
    })[0] || null;
  }

};

JSLha.prototype.folder = function (regex_or_name) {
  console.log('JSLha::folder (not implemented)');
  // TODO: implement
  return [];
};

JSLha.prototype.filter = function (search) {
  console.log('JSLha::filter');
  var result = [],
    filename, relativePath, file, fileClone;
  for (var i = 0; i < this.files.length; i++) {
    console.log(this.files[i]);
    /*
    if (!this.files[i].hasOwnProperty(filename)) {
      console.log('JSLha::filter bad entry');
      continue;
    }
    */
    result.push(this.files[i]);
  }
  return result;
};

module.exports = JSLha;