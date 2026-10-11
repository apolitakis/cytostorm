'use strict';
// Builds the Difficulty map page: node page/build.js <data.json> <out.html> ["partial-run note"]
const fs = require('fs'), path = require('path');
const [inp, out, note] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(inp, 'utf8'));
if (note) data.partial = note;
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
fs.writeFileSync(out, tpl.replace('/*DATA*/null', JSON.stringify(data).replace(/</g, '\\u003c')));
console.log(`wrote ${out}`);
