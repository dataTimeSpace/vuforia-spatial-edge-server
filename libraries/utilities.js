/**
 * @preserve
 *
 *                                     .,,,;;,'''..
 *                                 .'','...     ..',,,.
 *                               .,,,,,,',,',;;:;,.  .,l,
 *                              .,',.     ...     ,;,   :l.
 *                             ':;.    .'.:do;;.    .c   ol;'.
 *      ';;'                   ;.;    ', .dkl';,    .c   :; .'.',::,,'''.
 *     ',,;;;,.                ; .,'     .'''.    .'.   .d;''.''''.
 *    .oxddl;::,,.             ',  .'''.   .... .'.   ,:;..
 *     .'cOX0OOkdoc.            .,'.   .. .....     'lc.
 *    .:;,,::co0XOko'              ....''..'.'''''''.
 *    .dxk0KKdc:cdOXKl............. .. ..,c....
 *     .',lxOOxl:'':xkl,',......'....    ,'.
 *          .';:oo:...                        .
 *               .cd,    ╔═╗┌─┐┬─┐┬  ┬┌─┐┬─┐   .
 *                 .l;   ╚═╗├┤ ├┬┘└┐┌┘├┤ ├┬┘   '
 *                   'l. ╚═╝└─┘┴└─ └┘ └─┘┴└─  '.
 *                    .o.                   ...
 *                     .''''','.;:''.........
 *                          .'  .l
 *                         .:.   l'
 *                        .:.    .l.
 *                       .x:      :k;,.
 *                       cxlc;    cdc,,;;.
 *                      'l :..   .c  ,
 *                      o.
 *                     .,
 *
 *             ╦ ╦┬ ┬┌┐ ┬─┐┬┌┬┐  ╔═╗┌┐  ┬┌─┐┌─┐┌┬┐┌─┐
 *             ╠═╣└┬┘├┴┐├┬┘│ ││  ║ ║├┴┐ │├┤ │   │ └─┐
 *             ╩ ╩ ┴ └─┘┴└─┴─┴┘  ╚═╝└─┘└┘└─┘└─┘ ┴ └─┘
 *
 * Created by Valentin on 10/22/14.
 *
 * Copyright (c) 2015 Valentin Heun
 *
 * All ascii characters above must be included in any redistribution.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */


/**
 * @desc prototype for a source. This prototype is called when a value should be changed.
 * It defines how this value should be transformed before sending it to the destination.
 * @param {object} objectID Origin object in which the related link is saved.
 * @param {string} linkPositionID the id of the link that is related to the call
 * @param {value} inputData the data that needs to be processed
 * @param {function} callback the function that is called for when the process is rendered.
 * @note the callback has the same structure then the initial prototype, however inputData has changed to outputData
 **/
const DEBUG = false;

const xml2js = require('xml2js');
const fs = require('fs');
const fsProm = require('../persistence/fsProm.js');
const ip = require('ip');       // get the device IP address library
const dgram = require('dgram'); // UDP Broadcasting library
const path = require('path');
const fetch = require('node-fetch');
const DecompressZip = require('decompress-zip');
const ObjectModel = require('../models/ObjectModel.js');
const {objectsPath, beatPort} = require('../config.js');
const {isLightweightMobile} = require('../isMobile.js');

const hardwareInterfaces = {};

const {identityFolderName} = require('../constants.js');

var hardwareIdentity = path.join(objectsPath, identityFolderName);

let socketReferences = {
    realityEditorUpdateSocketSubscriptions: null
};

let callbacks = {
    triggerUDPCallbacks: null
};

exports.setup = function(_socketReferences, _callbacks) {
    socketReferences = _socketReferences;
    callbacks = _callbacks;
};

exports.writeObject = function writeObject(objectLookup, folder, id) {
    objectLookup[folder] = {id: id};
};

function readObject(objectLookup, folder) {
    if (objectLookup.hasOwnProperty(folder)) {
        return objectLookup[folder].id;
    } else {
        return null;
    }
}
exports.readObject = readObject;

exports.createFolder = async function createFolder(folderVar) {
    var identity = pathJoinRooted(objectsPath, folderVar, identityFolderName);
    await mkdirIfNotExists(identity, {recursive: true, mode: '0766'});
};


exports.createFrameFolder = async function (folderVar, frameVar, dirnameO, location) {
    if (location === 'global') return;
    var folder = pathJoinRooted(objectsPath, folderVar);
    // being outside of .identity matches frameFolder route for example
    var firstFrame = pathJoinRooted(folder, frameVar);

    if (!await fileExists(firstFrame)) {
        await mkdirIfNotExists(firstFrame, {recursive: true, mode: '0766'});

        try {
            const libraryObjectDefaultFilesIndex = pathJoinRooted(dirnameO, 'libraries/objectDefaultFiles/index.html');
            const libraryObjectDefaultFilesBird = pathJoinRooted(dirnameO, 'libraries/objectDefaultFiles/bird.png');
            fs.createReadStream(libraryObjectDefaultFilesIndex).pipe(fs.createWriteStream(pathJoinRooted(firstFrame, 'index.html')));
            fs.createReadStream(libraryObjectDefaultFilesBird).pipe(fs.createWriteStream(pathJoinRooted(firstFrame, 'bird.png')));
        } catch (e) {
            console.error('Could not copy source files', e);
        }
    }
};

/**
 * Recursively delete a folder and its contents
 * @param {string} folder - path to folder
 */
async function rmdirIfExists(folder) {
    if (!await fileExists(folder)) {
        console.warn(`folder ${folder} is already not present`);
        return;
    }
    try {
        await fsProm.rmdir(folder, {recursive: true});
    } catch (err) {
        console.error('rmdirIfExists fs race', err);
    }
}
exports.rmdirIfExists = rmdirIfExists;

/**
 * Deletes a directory from the hierarchy. Intentionally limited to frames so that you don't delete something more important.
 * @param objectKey
 * @param frameKey
 */
exports.deleteFrameFolder = async function (objectName, frameName) {
    var folderPath = pathJoinRooted(objectsPath, objectName, frameName);

    var acceptableFrameNames = ['gauge', 'decimal', 'graph', 'light']; // TODO: remove this restriction
    var isDeletableFrame = false;
    acceptableFrameNames.forEach(function (nameOption) {
        if (frameName.indexOf(nameOption) > -1) {
            isDeletableFrame = true;
        }
    });

    if (isDeletableFrame) {
        await rmdirIfExists(folderPath);
    }
};

/**
 * Generates a random number between the two inputs, inclusive.
 * @param {number} min - The minimum possible value.
 * @param {number} max - The maximum possible value.
 */
exports.randomIntInc = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Generates a 12-digit unique identifier string, much of which is based on the current time.
 */
exports.uuidTime = function () {
    var dateUuidTime = new Date();
    var abcUuidTime = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var stampUuidTime = parseInt(Math.floor((Math.random() * 199) + 1) + '' + dateUuidTime.getTime()).toString(36);
    while (stampUuidTime.length < 11) stampUuidTime = abcUuidTime.charAt(Math.floor(Math.random() * abcUuidTime.length)) + stampUuidTime;
    return '_' + stampUuidTime;
};

async function getObjectIdFromObjectFile(folderName) {

    if (folderName === 'allTargetsPlaceholder') {
        return 'allTargetsPlaceholder000000000000';
    }

    let jsonFile = pathJoinRooted(objectsPath, folderName, identityFolderName,  'object.json');

    if (await fileExists(jsonFile)) {
        try {
            let thisObject = JSON.parse(await fsProm.readFile(jsonFile, 'utf8'));
            if (thisObject.hasOwnProperty('objectId')) {
                return thisObject.objectId;
            } else {
                return null;
            }
        } catch (e) {
            console.error('error reading json file', e);
        }
    }
    return null;
}
exports.getObjectIdFromObjectFile = getObjectIdFromObjectFile;

async function getAnchorIdFromObjectFile(folderName) {

    if (folderName === 'allTargetsPlaceholder') {
        return 'allTargetsPlaceholder000000000000';
    }

    var jsonFile = pathJoinRooted(objectsPath, folderName, 'object.json');

    if (await fileExists(jsonFile)) {
        try {
            let thisObject = JSON.parse(await fsProm.readFile(jsonFile, 'utf8'));
            if (thisObject.hasOwnProperty('objectId')) {
                return thisObject.objectId;
            }
        } catch (err) {
            console.error('Unable to read anchor id', err);
        }
    }
    return null;
}
exports.getAnchorIdFromObjectFile = getAnchorIdFromObjectFile;

/**
 * Given a target folder, unzips the target.dat file within it and retrieves the targetId from config.info
 * @param {string} targetFolderPath
 * @returns {Promise<string|null>}
 */
exports.getTargetIdFromTargetDat = async function getTargetIdFromTargetDat(targetFolderPath) {
    return new Promise((resolve, reject) => {
        // unzip the .dat file and read the unique targetId from the config.info file
        let unzipperDat = new DecompressZip(path.join(targetFolderPath, 'target.dat'));

        unzipperDat.on('error', function (err) {
            console.error('.dat Unzipper Error', err);
            reject(err);
        });

        unzipperDat.on('extract', async function () {
            let configFilePath = path.join(targetFolderPath, 'config.info');
            if (await fileExists(configFilePath)) {
                // read the id stored within the config.info file (it's actually structured as XML)
                let targetUniqueId = await getTargetIdFromConfigFile(configFilePath);
                // TODO: cleanup config.info file instead of leaving it in the folder
                resolve(targetUniqueId);
            } else {
                reject('config.info not found at ' + configFilePath);
            }
        });

        unzipperDat.on('progress', function (_fileIndex, _fileCount) {
            // console.log('Extracted dat file ' + (fileIndex + 1) + ' of ' + fileCount);
        });

        unzipperDat.extract({
            path: targetFolderPath,
            filter: function (file) {
                return file.type !== 'SymbolicLink' && file.filename.endsWith('info');
            }
        });
    });
};

/**
 * Parses the file as XML and pulls out the targetId string
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
async function getTargetIdFromConfigFile(filePath) {
    if (!await fileExists(filePath)) {
        return null;
    }

    let contents;
    try {
        contents = await fsProm.readFile(filePath, 'utf8');
    } catch (err) {
        console.error('Unable to read xml file for target ID', err);
        return null;
    }

    try {
        return await queryXMLContents(contents, (xml) => {
            // the file is structured like <QCARInfo><TargetSet><AreaTarget targetId="58a594ef7e324cf590d09480a77a157e" />...
            // this gets the "AreaTarget"/"ImageTarget"/"ModelTarget" tag contents of the XML file
            // and extracts the tag's properties, e.g. { version: "5.1", bbox: "...", targetId: "xzy": name: "_WORLD_test_xyz" }
            return Object.entries(xml.QCARInfo.TargetSet[0]).find(entry => entry[0] !== '$')[1][0].$.targetId;
        });
    } catch (err) {
        console.error('Error parsing/querying XML contents', err);
        return null;
    }
}

/**
 * Parses the string as XML and searches the structured contents using the provided xmlQuery function
 * @param {string} xmlContentsString - file contents
 * @param {function} xmlQuery - the function that will be applied to the parsed contents to retrieve certain data
 * @returns {Promise<string>}
 */
async function queryXMLContents(xmlContentsString, xmlQuery) {
    return new Promise(function (resolve, reject) {
        xml2js.Parser().parseString(xmlContentsString, function (parseErr, result) {
            try {
                if (parseErr) {
                    throw parseErr;
                }
                resolve(xmlQuery(result));
            } catch (err) {
                console.error('error parsing xml', err);
                reject(err);
            }
        });
    });
}

/**
 *
 * @param {string} folderName
 * @return {Array.<float>}
 */
exports.getTargetSizeFromTarget = async function getTargetSizeFromTarget(folderName) {

    if (folderName === 'allTargetsPlaceholder') {
        return 'allTargetsPlaceholder000000000000';
    }

    var xmlFile = pathJoinRooted(objectsPath, folderName, identityFolderName, 'target/target.xml');

    var resultXML = {
        width: 0.3, // default width and height so it doesn't crash if there isn't a size in the xml
        height: 0.3
    };

    if (!await fileExists(xmlFile)) {
        return resultXML;
    }

    let contents;
    try {
        contents = await fsProm.readFile(xmlFile, 'utf8');
    } catch (err) {
        console.error('Unable to read xml file for target size', err);
        return resultXML;
    }

    xml2js.Parser().parseString(contents, function (parseErr, result) {
        try {
            if (parseErr) {
                throw parseErr;
            }

            let first = Object.keys(result)[0];
            let secondFirst = Object.keys(result[first].Tracking[0])[0];
            var sizeString = result[first].Tracking[0][secondFirst][0].$.size;
            if (!sizeString) {
                return;
            }
            var sizeFloatArray = sizeString.split(' ').map(function (elt) {
                // TODO: this assumption makes it backwards compatible but might cause problems in the future
                return (parseFloat(elt) < 10) ? parseFloat(elt) : 0.001 * parseFloat(elt); // detect meter or mm scale
            });
            resultXML = {
                width: sizeFloatArray[0],
                height: sizeFloatArray[1]
            };
        } catch (err) {
            console.error('error parsing xml', err);
        }
    });

    return resultXML;
};


let writeBufferList = {};
let isWriting = false;

/**
 * Saves the RealityObject as "object.json"
 * (Writes the object state to permanent storage)
 * @param {object}   objects - The array of objects
 * @param {string}   object    - The key used to look up the object in the objects array
 * @param {boolean}   writeToFile  - Give permission to write to file.
 */
exports.writeObjectToFile = async function writeObjectToFile(objects, object, writeToFile) {
    if (writeToFile) {
        writeBufferList[object] = objectsPath;
    }
    // trigger write process
    await executeWrite(objects);
};

function sleep(ms) {
    return new Promise(res => {
        setTimeout(res, ms);
    });
}

async function executeWrite(objects) {
    // if write Buffer is empty, stop.
    if (Object.keys(writeBufferList).length === 0) return;

    if (isWriting) {
        // come back later;
        await sleep(20);
        await executeWrite(objects);
        return;
    }
    // block function from re-execution
    isWriting = true;

    // copy the first item and delete it from the buffer list
    let firstKey = Object.keys(writeBufferList)[0];
    let objectsPathBuffered = writeBufferList[firstKey];
    let obj = firstKey;
    delete writeBufferList[firstKey];

    if (!objects[obj]) { // if object was deleted while write is pending
        isWriting = false;
        return;
    }

    // prepare to write
    var outputFilename = pathJoinRooted(objectsPathBuffered, objects[obj].name, identityFolderName, 'object.json');
    var objectData = objects[obj];
    // write file
    try {
        await fsProm.writeFile(outputFilename, JSON.stringify(objectData, null, '\t'));
    } catch (err) {
        console.error('Error writing file', err);
    }
    // once writeFile is done, unblock writing and loop again
    isWriting = false;
    executeWrite(objects);
}

var crcTable = [0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D];


var crc = 0xffffffff;

function crc32(data) {
    for (var i = 0, l = data.length; i < l; i++) {
        crc = crc >>> 8 ^ crcTable[crc & 255 ^ data[i]];
    }
    return (crc ^ -1) >>> 0;
}


function crc16reset() {
    crc = 0xffffffff;
}

function itob62(i) {
    var u = i;
    var b32 = '';
    do {
        var d = Math.floor(u % 62);
        if (d < 10) {

            b32 = String.fromCharCode('0'.charCodeAt(0) + d) + b32;
        } else if (d < 36) {
            b32 = String.fromCharCode('a'.charCodeAt(0) + d - 10) + b32;
        } else {
            b32 = String.fromCharCode('A'.charCodeAt(0) + d - 36) + b32;
        }

        u = Math.floor(u / 62);

    } while (u > 0);

    return b32;
}

/**
 * Generates a checksum of all files hand over with fileArray
 * @param objects hand over the overall object list
 * @param fileArray The array that represents all files that should be checksumed
 * @return {string} checksum text
 */
exports.generateChecksums = async function generateChecksums(objects, fileArray) {
    crc16reset();
    var checksumText;
    for (var i = 0; i < fileArray.length; i++) {
        if (!await fileExists(fileArray[i])) {
            continue;
        }
        try {
            checksumText = itob62(crc32(await fsProm.readFile(fileArray[i])));
        } catch (err) {
            console.warn('generateChecksums: Unable to read file', err);
        }
    }
    return checksumText;
};

/**
 * @return {Array<string>} all valid object folder names within objectsPath
 */
async function getObjectFolderList() {
    const objectFolderListRaw = await fsProm.readdir(objectsPath);
    const objectFolderList = [];

    for (const objectFolder of objectFolderListRaw) {
        if (objectFolder[0] === '.') {
            continue;
        }
        try {
            const folderStats = await fsProm.stat(pathJoinRooted(objectsPath, objectFolder));
            if (!folderStats.isDirectory()) {
                continue;
            }
        } catch (_e) {
            if (DEBUG) {
                console.warn('object folder already deleted', objectFolder);
            }
            continue;
        }
        objectFolderList.push(objectFolder);
    }

    return objectFolderList;
}
exports.getObjectFolderList = getObjectFolderList;

exports.updateObject = async function updateObject(objectName, objects) {
    var objectFolderList = await getObjectFolderList();

    for (const objectFolder of objectFolderList) {
        const tempFolderName = await getObjectIdFromObjectFile(objectFolder);

        if (!tempFolderName) {
            console.warn(' object ' + objectFolder + ' has no marker yet');
            return tempFolderName;
        }
        if (!objects[tempFolderName]) {
            console.warn('object deleted during updateObject');
        } else {
            // fill objects with objects named by the folders in objects
            objects[tempFolderName].name = objectFolder;
        }

        // try to read a saved previous state of the object
        try {
            objects[tempFolderName] = JSON.parse(await fsProm.readFile(pathJoinRooted(objectsPath, objectFolder, identityFolderName, 'object.json'), 'utf8'));
            objects[tempFolderName].ip = ip.address();

            // this is for transforming old lists to new lists
            if (typeof objects[tempFolderName].objectValues !== 'undefined') {
                objects[tempFolderName].frames[tempFolderName].nodes = objects[tempFolderName].objectValues;
                delete objects[tempFolderName].objectValues;
            }
            if (typeof objects[tempFolderName].objectLinks !== 'undefined') {
                objects[tempFolderName].frames[tempFolderName].links = objects[tempFolderName].objectLinks;
                delete objects[tempFolderName].objectLinks;
            }


            if (typeof objects[tempFolderName].nodes !== 'undefined') {
                objects[tempFolderName].frames[tempFolderName].nodes = objects[tempFolderName].nodes;
                delete objects[tempFolderName].nodes;
            }
            if (typeof objects[tempFolderName].links !== 'undefined') {
                objects[tempFolderName].frames[tempFolderName].links = objects[tempFolderName].links;
                delete objects[tempFolderName].links;
            }

            for (var frameKey in objects[tempFolderName].frames) {
                for (var nodeKey in objects[tempFolderName].frames[frameKey].nodes) {
                    if (typeof objects[tempFolderName].frames[frameKey].nodes[nodeKey].item !== 'undefined') {
                        var tempItem = objects[tempFolderName].frames[frameKey].nodes[nodeKey].item;
                        objects[tempFolderName].frames[tempFolderName].nodes[nodeKey].data = tempItem[0];
                    }
                }
            }

            // cast everything from JSON to Object, Frame, and Node classes
            let newObj = new ObjectModel(objects[tempFolderName].ip,
                objects[tempFolderName].version,
                objects[tempFolderName].protocol,
                objects[tempFolderName].objectId);
            newObj.setFromJson(objects[tempFolderName]);
            objects[tempFolderName] = newObj;
            // TODO: does this need to be added to sceneGraph?
        } catch (e) {
            objects[tempFolderName].ip = ip.address();
            objects[tempFolderName].objectId = tempFolderName;
            console.warn('No saved data for: ' + tempFolderName, e);
        }
        return tempFolderName;
    }
    return null;
};

exports.deleteObject = async function deleteObject(objectName, objects, objectLookup, _activeHeartbeats, knownObjects, sceneGraph, setAnchors) {
    let objectFolderPath = pathJoinRooted(objectsPath, objectName);
    await rmdirIfExists(objectFolderPath);

    let objectKey = readObject(objectLookup, objectName);

    if (objectKey && objects[objectKey]) {
        // remove object from tree
        try {
            // deconstructs frames and nodes of this object, too
            objects[objectKey].deconstruct();
        } catch (e) {
            console.warn('Object exists without proper prototype: ' + objectKey, e);
        }
        delete objects[objectKey];
        delete knownObjects[objectKey];
        delete objectLookup[objectName];

        sceneGraph.removeElementAndChildren(objectKey);
    }

    await setAnchors();

    this.actionSender({reloadObject: {object: objectKey} });
};

exports.loadHardwareInterface = function loadHardwareInterface(hardwareInterfaceName) {
    const hardwareFolder = pathJoinRooted(hardwareIdentity, hardwareInterfaceName);

    if (!fs.existsSync(hardwareIdentity)) {
        fs.mkdirSync(hardwareIdentity, '0766', function (err) {
            if (err) {
                console.error('Error making directory', err);
            }
        });
    }

    if (!fs.existsSync(hardwareFolder)) {
        fs.mkdirSync(hardwareFolder, '0766', function (err) {
            if (err) {
                console.error('Error making directory', err);
            }
        });
    }

    const settingsPath = pathJoinRooted(hardwareFolder, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        fs.writeFile(settingsPath, '', function (err) {
            if (err) {
                console.error('Error writing file', err);
            }
        });
    }

    try {
        var fileContents = fs.readFileSync(settingsPath, 'utf8');
        hardwareInterfaces[hardwareInterfaceName] = JSON.parse(fileContents);
    } catch (e) {
        console.error('Could not load settings.json for: ' + hardwareInterfaceName, e);
        if (!hardwareInterfaces[hardwareInterfaceName]) {
            hardwareInterfaces[hardwareInterfaceName] = {};
        }
    }

    this.read = function (settingsName, defaultvalue) {
        if (typeof hardwareInterfaces[hardwareInterfaceName][settingsName] === 'undefined') {
            if (typeof defaultvalue !== 'undefined')
                hardwareInterfaces[hardwareInterfaceName][settingsName] = defaultvalue;
            else {
                hardwareInterfaces[hardwareInterfaceName][settingsName] = 0;
            }
        }
        return hardwareInterfaces[hardwareInterfaceName][settingsName];
    };
    return this.read;
};

exports.loadHardwareInterfaceAsync = async function loadHardwareInterfaceAsync(hardwareInterfaceName) {
    const hardwareFolder = pathJoinRooted(hardwareIdentity, hardwareInterfaceName);

    mkdirIfNotExists(hardwareFolder, {recursive: true, mode: '0766'});

    const settingsPath = pathJoinRooted(hardwareFolder, 'settings.json');
    if (!await fileExists(settingsPath)) {
        try {
            await fsProm.writeFile(settingsPath, '{}');
        } catch (err) {
            console.error('Error writing file', err);
        }
    }

    try {
        const fileContents = await fsProm.readFile(settingsPath, 'utf8');
        hardwareInterfaces[hardwareInterfaceName] = JSON.parse(fileContents);
    } catch (e) {
        console.error('Could not load settings.json for: ' + hardwareInterfaceName, e);
        if (!hardwareInterfaces[hardwareInterfaceName]) {
            hardwareInterfaces[hardwareInterfaceName] = {};
        }
    }

    this.read = function (settingsName, defaultvalue) {
        if (typeof hardwareInterfaces[hardwareInterfaceName][settingsName] === 'undefined') {
            if (typeof defaultvalue !== 'undefined')
                hardwareInterfaces[hardwareInterfaceName][settingsName] = defaultvalue;
            else {
                hardwareInterfaces[hardwareInterfaceName][settingsName] = 0;
            }
        }
        return hardwareInterfaces[hardwareInterfaceName][settingsName];
    };
    return this.read;
};

/**
 * @param {string} hardwareInterfaceName
 * @return {any} raw loaded settings of hardware interface
 */
exports.getLoadedHardwareInterface = function getLoadedHardwareInterface(hardwareInterfaceName) {
    return hardwareInterfaces[hardwareInterfaceName];
};

function restActionSender(action) {
    const { knownObjects } = require('../server');
    const hostSet = new Set();
    for (const knownObject of Object.values(knownObjects)) {
        hostSet.add(knownObject.ip + ':' + knownObject.port);
    }
    const body = new URLSearchParams({
        'action': JSON.stringify(action)
    });
    [...hostSet].map(host => {
        fetch(`http://${host}/action`, {
            method: 'POST',
            body: body
        }).catch(err => {
            if (DEBUG) {
                console.error(`restActionSender: Error sending action to ${host} over REST API.`, err);
            }
        });
    });
}

/**
 * Broadcasts a JSON message over UDP
 * @param {*} action - JSON object with no specified structure, contains the message to broadcast
 * @param {number} timeToLive
 */
exports.actionSender = function actionSender(action, timeToLive = 2) {
    var HOST = '255.255.255.255';
    var message;

    message = Buffer.from(JSON.stringify({action: action}));

    if (message.length > 1472) {
        restActionSender(action);
        return;
    }

    // creating the datagram
    var client = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
    });
    client.bind(function () {
        client.setBroadcast(true);
        client.setTTL(timeToLive);
        client.setMulticastTTL(timeToLive);
    });

    sendWithFallback(client, beatPort, HOST, {action: action}, {closeAfterSending: true});
};

/**
 * Use this to send a UDP message over the provided client socket, with a fallback to send the message
 * over websockets to all known clients if the network doesn't support UDP broadcasts.
 * To use:
 *   After setting up a `client = dgram.createSocket({type: 'udp4'})`, instead of writing client.send(...),
 *   use utilities.sendWithFallback(client, ...)
 * @param {dgram.Socket} client
 * @param {number} PORT
 * @param {string} HOST
 * @param {Object} messageObject - e.g. {action: {reloadObject: {object, lastEditor}}} or (heartbeat) {id, ip, vn, ...}
 * @param {{closeAfterSending: boolean, onErr: function?}} options
 */
function sendWithFallback(client, PORT, HOST, messageObject, options = {closeAfterSending: true, onErr: null}) {
    let message = Buffer.from(JSON.stringify(messageObject));

    // send the datagram, or a websocket message if the datagram fails
    client.send(message, 0, message.length, PORT, HOST, function (err) {
        let isActionMessage = messageObject.action;
        let isBeatMessage = messageObject.id && messageObject.ip && messageObject.vn;
        if (isActionMessage || isBeatMessage) {

            // send the message to clients on the local Wi-Fi network
            for (let subscriptions of socketReferences.realityEditorUpdateSocketSubscriptions) {
                let messageName = isActionMessage ? '/udp/action' : '/udp/beat';
                subscriptions.socket.emit(messageName, JSON.stringify(messageObject));
            }

            // send to cloud-proxied clients and other subscribing modules
            if (callbacks.triggerUDPCallbacks) {
                callbacks.triggerUDPCallbacks(messageObject);
            }
        }

        if (err) {
            if (err.code === 'EMSGSIZE') {
                console.error('actionSender: UDP Message Too Large.');
            }

            if (options.onErr) {
                options.onErr(err);
            }
        }

        if (options.closeAfterSending) {
            client.close();
        }
    });
}
exports.sendWithFallback = sendWithFallback;

function doesObjectExist(objects, objectKey) {
    return objects.hasOwnProperty(objectKey);
}

exports.doesObjectExist = doesObjectExist;

function getObject(objects, objectKey) {
    if (doesObjectExist(objects, objectKey)) {
        return objects[objectKey];
    }
    return null;
}

exports.getObject = getObject;

function doesFrameExist(objects, objectKey, frameKey) {
    if (doesObjectExist(objects, objectKey)) {
        var foundObject = getObject(objects, objectKey);
        if (foundObject) {
            return foundObject.frames.hasOwnProperty(frameKey);
        }
    }
    return false;
}

exports.doesFrameExist = doesFrameExist;

function getFrame(objects, objectKey, frameKey) {
    if (doesFrameExist(objects, objectKey, frameKey)) {
        var foundObject = getObject(objects, objectKey);
        if (foundObject) {
            return foundObject.frames[frameKey];
        }
    }
    return null;
}

exports.getFrame = getFrame;

function doesNodeExist(objects, objectKey, frameKey, nodeKey) {
    if (doesFrameExist(objects, objectKey, frameKey)) {
        var foundFrame = getFrame(objects, objectKey, frameKey);
        if (foundFrame) {
            return foundFrame.nodes.hasOwnProperty(nodeKey);
        }
    }
    return false;
}

exports.doesNodeExist = doesNodeExist;

function getNode(objects, objectKey, frameKey, nodeKey) {
    if (doesNodeExist(objects, objectKey, frameKey, nodeKey)) {
        var foundFrame = getFrame(objects, objectKey, frameKey);
        if (foundFrame) {
            return foundFrame.nodes[nodeKey];
        }
    }
    return null;
}

exports.getNode = getNode;

/**
 * @param objectKey
 * @param {Function} callback - (error: {failure: bool, error: string}, object)
 */
function getObjectAsync(objects, objectKey, callback) {
    if (!objects.hasOwnProperty(objectKey)) {
        callback({failure: true, error: 'Object ' + objectKey + ' not found'});
        return;
    }
    var object = objects[objectKey];
    callback(null, object);
}

exports.getObjectAsync = getObjectAsync;

/**
 * @param objectKey
 * @param frameKey
 * @param {Function} callback - (error: {failure: bool, error: string}, object, frame)
 */
function getFrameAsync(objects, objectKey, frameKey, callback) {
    getObjectAsync(objects, objectKey, function (error, object) {
        if (error) {
            callback(error);
            return;
        }
        if (!object.frames.hasOwnProperty(frameKey)) {
            callback({failure: true, error: 'Frame ' + frameKey + ' not found'});
            return;
        }
        var frame = object.frames[frameKey];
        callback(null, object, frame);
    });
}

exports.getFrameAsync = getFrameAsync;

/**
 * @param objectKey
 * @param frameKey
 * @param nodeKey
 * @param {Function} callback - (error: {failure: bool, error: string}, object, frame)
 */
function getNodeAsync(objects, objectKey, frameKey, nodeKey, callback) {
    getFrameAsync(objects, objectKey, frameKey, function (error, object, frame) {
        if (error) {
            callback(error);
            return;
        }
        if (!frame.nodes.hasOwnProperty(nodeKey)) {
            callback({failure: true, error: 'Node ' + nodeKey + ' not found'});
            return;
        }
        var node = frame.nodes[nodeKey];
        callback(null, object, frame, node);
    });
}

exports.getNodeAsync = getNodeAsync;

/**
 * Returns node if a nodeKey is provided, otherwise the frame
 * @param {Object} objects
 * @param {string} objectKey
 * @param {string} frameKey
 * @param {string} nodeKey
 * @param {function} callback
 */
function getFrameOrNode(objects, objectKey, frameKey, nodeKey, callback) {
    getFrameAsync(objects, objectKey, frameKey, function (error, object, frame) {
        if (error) {
            callback(error);
            return;
        }

        var node = null;

        if (nodeKey && nodeKey !== 'null') {
            if (!frame.nodes.hasOwnProperty(nodeKey)) {
                callback({failure: true, error: 'Node ' + nodeKey + ' not found'});
                return;
            }
            node = frame.nodes[nodeKey];
        }

        callback(null, object, frame, node);
    });
}

exports.getFrameOrNode = getFrameOrNode;

function forEachObject(objects, callback) {
    for (var objectKey in objects) {
        if (!objects.hasOwnProperty(objectKey)) continue;
        callback(objects[objectKey], objectKey);
    }
}

exports.forEachObject = forEachObject;

function forEachFrameInObject(object, callback) {
    if (!object) return;
    for (var frameKey in object.frames) {
        if (!object.frames.hasOwnProperty(frameKey)) continue;
        callback(object.frames[frameKey], frameKey);
    }
}

exports.forEachFrameInObject = forEachFrameInObject;

function forEachNodeInFrame(frame, callback) {
    if (!frame) return;
    for (var nodeKey in frame.nodes) {
        if (!frame.nodes.hasOwnProperty(nodeKey)) continue;
        callback(frame.nodes[nodeKey], nodeKey);
    }
}

exports.forEachNodeInFrame = forEachNodeInFrame;


function forEachLinkInFrame(frame, callback) {
    if (!frame) return;
    for (var nodeKey in frame.links) {
        if (!frame.links.hasOwnProperty(nodeKey)) continue;
        callback(frame.links[nodeKey], nodeKey);
    }
}

exports.forEachLinkInFrame = forEachLinkInFrame;


/**
 * Helper function to return the absolute path to the directory that should contain all
 * video files for the provided object name. (makes dir if necessary)
 * @param {string} objectName
 * @return {string}
 */
function getVideoDir(objectName) {
    let videoDir = objectsPath; // on mobile, put videos directly in object home dir

    // directory differs on mobile due to inability to call mkdir
    if (!isLightweightMobile) {
        videoDir = pathJoinRooted(objectsPath, objectName, identityFolderName, 'videos');

        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir);
        }
    }

    return videoDir;
}

exports.getVideoDir = getVideoDir;

/**
 * Ensures id is alphanumeric or -_ and doesn't attempt prototype pollution
 * @param {string} id
 * @return {boolean} whether valid
 */
function isValidId(id) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') {
        return false;
    }
    return id.match(/^[A-Za-z0-9_ -]+$/);
}

exports.isValidId = isValidId;

function goesUpDirectory(pathStr) {
    return pathStr.match(/\.\./);
}

exports.goesUpDirectory = goesUpDirectory;

function deepCopy(item) {
    if (null == item || typeof item != 'object') return item;
    if (item instanceof Array) {
        let copy = [];
        for (let i = 0, length = item.length; i < length; i++) {
            copy[i] = deepCopy(item[i]);
        }
        return copy;
    }
    if (item instanceof Object) {
        let copy = {};
        for (let key in item) {
            if (item.hasOwnProperty(key)) copy[key] = deepCopy(item[key]);
        }
        return copy;
    }
    throw new Error('Unable to deep copy this object.');
}
exports.deepCopy = deepCopy;

/**
 * Wrapper for  access that resolves to false when file at filePath does not
 * exist
 * @param {string} filePath - path to file
 * @return {Promise<boolean>}
 */
function fileExists(filePath) {
    return fsProm.access(filePath).then(() => {
        return true;
    }).catch(() => {
        return false;
    });
}
exports.fileExists = fileExists;

/**
 * All-in-one mkdir solution. Wraps error because TOCTOU
 * @param {string} dirPath - path to folder
 * @param {object?} options - options for mkdir
 * @return {Promise<boolean>}
 */
async function mkdirIfNotExists(dirPath, options) {
    if (!await fileExists(dirPath)) {
        try {
            await fsProm.mkdir(dirPath, options);
        } catch (e) {
            console.warn('mkdirIfNotExists fs race', e);
        }
    }
}
exports.mkdirIfNotExists = mkdirIfNotExists;

/**
 * All-in-one unlink solution. Wraps error because TOCTOU
 * @param {string} filePath - path to folder
 * @return {Promise<boolean>}
 */
async function unlinkIfExists(filePath) {
    if (await fileExists(filePath)) {
        try {
            await fsProm.unlink(filePath);
        } catch (e) {
            console.warn('unlinkIfExists fs race', e);
        }
    }
}
exports.unlinkIfExists = unlinkIfExists;

/**
 * Join root with paths, requiring that the result is located within root
 * @param {string} root
 * @param {Array<string>} paths
 * @return {string} root joined with path, throws if invalid
 */
function pathJoinRooted(root, ...paths) {
    const joined = path.join(root, ...paths);
    let relative = path.relative(root, joined);
    if (path.isAbsolute(relative) || relative.startsWith('..')) {
        throw new Error('path join attempts to escape root');
    }
    return joined;
}
exports.pathJoinRooted = pathJoinRooted;
