'use strict';

var TREE_NODE_LEAF_VALUE = 1 << 63;

function Tree(size) {
  this.tree = [];
  var i = size;
  while (i > 0) {
    this.tree.push(TREE_NODE_LEAF_VALUE);
    i--;
  }
}

Tree.prototype.read = function (bitStream) {
  var code = this.tree[0];
  while ((code & TREE_NODE_LEAF_VALUE) == 0) {
    var bit = bitStream.readBits(1);
    if (bit < 0) return -1;
    code = this.tree[code + bit];
  }
  return (code & ~TREE_NODE_LEAF_VALUE);
};

// FIXME: maybe this should be 'static' factory method
Tree.prototype.setSingle = function (code) {
  this.tree[0] = code | TREE_NODE_LEAF_VALUE;
};


function buildTree(tree, treeLen, codeLengths, numCodeLengths) {
  var buildData = {
    tree: tree,
    treeLen: treeLen,
    nextEntry: 0,
    treeAllocated: 1,
  };

  var codeLen = 0;
  do {
    expandQueue(buildData);
    codeLen++;
  } while (addCodesWithLength(buildData, codeLengths, numCodeLengths, codeLen));
}

function expandQueue(buildData) {
  var newNodes = (buildData.treeAllocated - buildData.nextEntry) * 2;
  if (buildData.treeAllocated + newNodes > buildData.treeLen) return;
  var endOffset = buildData.treeAllocated;
  while (buildData.nextEntry < endOffset) {
    buildData.tree.tree[buildData.nextEntry] = buildData.treeAllocated;
    buildData.treeAllocated += 2;
    buildData.nextEntry++;
  }
}

function addCodesWithLength(buildData, codeLengths, numCodeLengths, codeLen) {
  var codesRemaining = 0;
  for (var i = 0; i < numCodeLengths; i++) {
    if (codeLengths[i] == codeLen) {
      var node = readNextEntry(buildData);
      buildData.tree.tree[node] = i | TREE_NODE_LEAF_VALUE;
    } else if (codeLengths[i] > codeLen) codesRemaining = 1;
  }
  return codesRemaining;
}

function readNextEntry(buildData) {
  if (buildData.nextEntry >= buildData.treeAllocated) return 0;
  var result = buildData.nextEntry;
  buildData.nextEntry++;
  return result;
}

module.exports = { Tree: Tree, buildTree: buildTree };
