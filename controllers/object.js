const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const utilities = require('../libraries/utilities');

const uploadVideo = function(objects, objectsPath, identityFolderName, isMobile, objectID, videoID, callback) {
    let object = utilities.getObject(objects, objectID);
    if (!object) {
        callback(404, 'Object ' + objectID + ' not found');
        return;
    }
    try {
        var videoDir = utilities.getVideoDir(objectsPath, identityFolderName, isMobile, object.name);

        var form = new formidable.IncomingForm({
            uploadDir: videoDir,
            keepExtensions: true,
            accept: 'video/mp4'
        });

        console.log('created form for video');

        form.on('error', function (err) {
            callback(500, err);
        });

        var rawFilepath = form.uploadDir + '/' + videoID + '.mp4';

        if (fs.existsSync(rawFilepath)) {
            console.log('deleted old raw file');
            fs.unlinkSync(rawFilepath);
        }

        form.on('fileBegin', function (name, file) {
            file.path = rawFilepath;
            console.log('fileBegin loading', name, file);
        });

        form.parse(req, function (err, fields) {

            if (err) {
                console.log('error parsing', err);
                callback(500, err);
                return;
            }

            console.log('successfully created video file', err, fields);

            callback(200, {success: true});
        });
    } catch (e) {
        console.warn('error parsing video upload', e);
    }
}

const saveCommit = function(objects, isMobile, git, objectID, callback) {
    if (isMobile) {
        callback(500, 'saveCommit unavailable on mobile');
        return;
    }
    var object = utilities.getObject(objects, objectID);
    if (object) {
        git.saveCommit(object, objects, function () {
            callback(200, {success: true});
        });
    }
}

const resetToLastCommit = function(objects, isMobile, hardwareAPI, git, objectID, callback) {
    if (isMobile) {
        callback(500, 'resetToLastCommit unavailable on mobile');
        return;
    }
    var object = utilities.getObject(objects, objectID);
    if (object) {
        git.resetToLastCommit(object, objects, function () {
            callback(200, {success: true});
            hardwareAPI.runResetCallbacks(objectID);
        });
    }
}

const setMatrix = function(objects, globalVariables, objectsPath, objectID, body, callback) {
    let object = utilities.getObject(objects, objectID);
    if (!object) {
        callback(404, {failure: true, error: 'Object ' + objectID + ' not found'});
        return;
    }

    object.matrix = body.matrix;
    console.log('set matrix for ' + objectID + ' to ' + object.matrix.toString());

    utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);

    callback(200, {success: true});
}

/**
 * Upload an image file to the object's metadata folder.
 * The image is stored in a form, which can be parsed and written to the filesystem.
 * @param {string} objectID
 * @param {express.Request} req
 * @param {express.Response} res
 */
const memoryUpload = function(objects, globalVariables, objectsPath, identityFolderName, objectID, req, callback) {
    if (!objects.hasOwnProperty(objectID)) {
        callback(404, {failure: true, error: 'Object ' + objectID + ' not found'});
        return;
    }

    var obj = utilities.getObject(objects, objectID);

    if (obj.isHumanPose) {
        callback(404, {failure: true, error: 'Object ' + objectID + ' has no directory'});
        return;
    }

    var memoryDir = objectsPath + '/' + obj.name + '/' + identityFolderName + '/memory/';
    if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir);
    }

    var form = new formidable.IncomingForm({
        uploadDir: memoryDir,
        keepExtensions: true,
        accept: 'image/jpeg'
    });

    form.on('error', function (err) {
        callback(500, err);
        return;
    });

    form.on('fileBegin', function (name, file) {
        if (name === 'memoryThumbnailImage') {
            file.path = form.uploadDir + '/memoryThumbnail.jpg';
        } else {
            file.path = form.uploadDir + '/memory.jpg';
        }
    });

    form.parse(req, function (err, fields) {
        if (obj) {
            obj.memory = JSON.parse(fields.memoryInfo);
            obj.memoryCameraMatrix = JSON.parse(fields.memoryCameraInfo);
            obj.memoryProjectionMatrix = JSON.parse(fields.memoryProjectionInfo);

            utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);
            utilities.actionSender({loadMemory: {object: objectID, ip: obj.ip}});
        }

        console.log('successfully created memory');

        callback(200, {success: true});
    });
}

const deactivate = function(objects, globalVariables, objectsPath, objectID, callback) {
    try {
        utilities.getObject(objects, objectID).deactivated = true;
        utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);
        callback(200, 'ok');
    } catch (e) {
        callback(404, {success: false, error: 'cannot find object with ID' + objectID});
    }
}

const activate = function(objects, globalVariables, objectsPath, objectID, callback) {
    try {
        utilities.getObject(objects, objectID).deactivated = false;
        utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);
        callback(200, 'ok');
    } catch (e) {
        callback(404, {success: false, error: 'cannot find object with ID' + objectID});
    }
}

const setVisualization = function(objects, globalVariables, objectsPath, objectID, vis, callback) {
    utilities.getObject(objects, objectID).visualization = vis;
    console.log(vis, objectID);
    utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);
    callback(200, 'ok');
}

// request a zip-file with the object stored inside
// ****************************************************************************************************************
const zipBackup = function(objectsPath, isMobile, objectId, req, res) {
    if (isMobile) {
        res.status(500).send('zipBackup unavailable on mobile');
        return;
    }
    var objectId = objectId;
    console.log('sending zipBackup', objectId);

    if (!fs.existsSync(path.join(objectsPath, objectId))) {
        res.status(404).send('object directory for ' + objectId + 'does not exist at ' + objectsPath + '/' + objectId);
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-disposition': 'attachment; filename=' + objectId + '.zip'
    });

    var zip = archiver('zip');
    zip.pipe(res);
    zip.directory(objectsPath + '/' + objectId, objectId + '/');
    zip.finalize();
}

const generateXml = function(objects, globalVariables, objectsPath, identityFolderName, objectID, body, callback) {
    var msgObject = body;
    var objectName = msgObject.name;

    console.log(objectID, msgObject);

    console.log('support inferred aspect ratio of image targets');
    console.log('support object targets');

    // var isImageTarget = true;
    // var targetTypeText = isImageTarget ? 'ImageTarget' : 'ObjectTarget'; // not sure if this is actually what object target XML looks like

    var documentcreate = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<ARConfig xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
        '   <Tracking>\n' +
        '   <ImageTarget name="' + objectID + '" size="' + parseFloat(msgObject.width).toFixed(8) + ' ' + parseFloat(msgObject.height).toFixed(8) + '" />\n' +
        '   </Tracking>\n' +
        '   </ARConfig>';

    let targetDir = path.join(objectsPath, objectName, identityFolderName, 'target');
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir);
        console.log('created directory: ' + targetDir);
    }

    console.log('am I here!');
    var xmlOutFile = path.join(targetDir, 'target.xml');

    fs.writeFile(xmlOutFile, documentcreate, function (err) {
        if (err) {
            callback(500, 'error writing new target size to .xml file for ' + objectID);
        } else {
            callback(200, 'ok');

            // TODO: update object.targetSize.width and object.targetSize.height and write to disk (if object exists yet)
            var object = utilities.getObject(objects, objectID);
            if (object) {
                object.targetSize.width = parseFloat(msgObject.width);
                object.targetSize.height = parseFloat(msgObject.height);
                utilities.writeObjectToFile(objects, objectID, objectsPath, globalVariables.saveToDisk);
            }
        }
    });
}

/**
 * Enable sharing of Spatial Tools from this server to objects on other servers
 * @todo: see github issue #23 - function is currently unimplemented
 * @param {string} objectKey
 * @param {boolean} shouldBeEnabled
 * @param {successCallback} callback - success, error message
 */
const setFrameSharingEnabled = function (objectKey, shouldBeEnabled, callback) { // eslint-disable-line no-inner-declarations
    callback(true);
    console.warn('TODO: implement frame sharing... need to set property and implement all side-effects / consequences');
}

const getObject = function (objects, objectID) {
    return utilities.getObject(objects, objectID);
}

module.exports = {
    uploadVideo: uploadVideo,
    saveCommit: saveCommit,
    resetToLastCommit: resetToLastCommit,
    setMatrix: setMatrix,
    memoryUpload: memoryUpload,
    deactivate: deactivate,
    activate: activate,
    setVisualization: setVisualization,
    zipBackup: zipBackup,
    generateXml: generateXml,
    getObject: getObject
};