var utils = require("./utils"), 
    errTo = require("errto"),
    async = require("async"),
    fs = require("fs")
    path = require('path');

// Generate encoding families by parsing ICU-data UCM files.
var destFileName = "sbcs-ucm-data-generated.js";

var encodings = {}

async.parallel({
    cp1047: utils.getFile.bind(null, "https://raw.githubusercontent.com/unicode-org/icu-data/main/charset/data/ucm/ibm-1047_P100-1995.ucm")
}, errTo(console.log, function(data) {
    for (var enc in data) {
        var header = {};
        var mapping = [];
        // Parse header
        var parse_line = parts => {
            header[(parts[0]).slice(1,-1)] = parts[1];
        };
        for (var line of utils.parseText(data[enc])) {
            // Switch parsers once CHARMAP is seen
            if (line[0] == 'CHARMAP') {
                parse_line = parts => {
                    // Ignore fallback mappings
                    if (parts[2] != '|0') {
                        return;
                    }
                    var byte = parts[1].slice(2);
                    byte = Number.parseInt(byte, 16);
                    var codepoint = Number.parseInt(parts[0].slice(2,-1), 16);
                    // Map byte to its code point
                    mapping[byte] = String.fromCodePoint(codepoint);
                };
                continue;
            // End of file
            } else if (line[0] == 'END') {
                break;
            }
            parse_line(line);
        }
        console.assert(header.uconv_class == '"SBCS"')
        // Require the substitution character only when it is needed
        var subst = undefined;
        var subchar = () => {
            console.assert(header.subchar !== undefined);
            if (subst === undefined) {
                subst = header.subchar.slice(2);
                subst = Number.parseInt(subst, 16);
            }
            subst
        };
        // Fill unset bytes with the substitution
        for (let i = 0; i < 256; i++) {
            if (mapping[i] === undefined) {
                mapping[i] = subchar()
            }
        }
        encodings[enc] = {
            type: '_sbcs',
            chars: mapping.join('')
        }
        // alias cpXXXX as ibmXXXX for EBCDIC
        if (header['icu:charsetFamily'] === '"EBCDIC"' && enc.startsWith('cp')) {
            encodings['ibm' + enc.slice(2)] = enc
        }
    }

    data = "\"use strict\";\n\n// Generated data for sbcs codec. Don't edit manually. Regenerate using generation/gen-sbcs-ucm.js script.\n" +
    "module.exports = " + JSON.stringify(encodings, undefined, '  ');
    fs.writeFileSync(path.join(__dirname, "../encodings/", destFileName), data);
}));