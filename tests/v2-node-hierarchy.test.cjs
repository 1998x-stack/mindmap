// Run with: node --test tests/v2-node-hierarchy.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../v2/script.js'), 'utf8');
const MindMap = vm.runInNewContext(source + '\nMindMap;', {
    document: { addEventListener() {} },
});

function setup(selectedId, parentId) {
    const map = Object.create(MindMap.prototype);
    map.selectedNode = {
        dataset: { id: selectedId, ...(parentId ? { parentId } : {}) },
        getBoundingClientRect: () => ({ left: 100, top: 120 }),
    };
    map.nodes = [];
    map.createNode = (text, x, y) => ({
        dataset: { id: '99' },
        text,
        x,
        y,
    });
    map.selectNode = node => { map.selectedNode = node; };
    map.saveNodesToDB = () => {};
    map.drawConnections = () => {};
    return map;
}

test('a sibling of a child inherits the selected node parent', () => {
    const map = setup('2', '1');
    map.addNode('sibling');
    assert.equal(map.nodes.length, 1);
    assert.equal(map.nodes[0].dataset.parentId, '1');
    assert.equal(map.nodes[0].x, 100);
    assert.equal(map.nodes[0].y, 240);
});

test('a sibling of a root is also a root-level node', () => {
    const map = setup('1');
    map.addNode('sibling');
    assert.equal(map.nodes.length, 1);
    assert.equal(map.nodes[0].dataset.parentId, undefined);
});

test('a child still points to the selected node', () => {
    const map = setup('2', '1');
    map.addNode('child');
    assert.equal(map.nodes.length, 1);
    assert.equal(map.nodes[0].dataset.parentId, '2');
    assert.equal(map.nodes[0].x, 300);
    assert.equal(map.nodes[0].y, 120);
});

test('no selected node means no node is added', () => {
    const map = setup('2', '1');
    map.selectedNode = null;
    map.addNode('sibling');
    assert.equal(map.nodes.length, 0);
});
