#!/usr/bin/env node
const fs = require('fs')
const semver = require('semver')

var bpkg = JSON.parse(fs.readFileSync('package.json', {encoding: 'utf-8'}))
var apkg = JSON.parse(fs.readFileSync('app/package.json', {encoding: 'utf-8'}))
var ver = bpkg['version']

var args = process.argv.slice(process.argv.indexOf(__filename)+1);
if (args.length > 0) {
    var newver = args[0]
    if (newver == semver.valid(newver)) {
        ver = newver;
        bpkg['version'] = ver;
        fs.writeFileSync('package.json', JSON.stringify(bpkg, null, 4));        
    }
}
console.log(ver);

apkg['version'] = ver;
fs.writeFileSync('app/package.json', JSON.stringify(apkg, null, 4));