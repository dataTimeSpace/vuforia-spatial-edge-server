/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global test, beforeAll, afterAll, expect */
const {
    sleep,
    snapshotDirectory,
    filterSnapshot,
    filterToObjects,
    waitForObjects,
    localServer,
    fetchAgent,
} = require('./helpers.js');

const fetch = require('node-fetch');

const worldName = '_WORLD_instantScanPJ1cgyrm';

let server;
beforeAll(async () => {
    server = require('../server.js');
});

afterAll(async () => {
    await server.exit();
    await sleep(1000);
});

async function addFrame() {
    await waitForObjects();
    const res = await fetch(`${localServer}/object/_WORLD_instantScanPJ1cgyrm_T6ijgnpsk1c/addFrame/`, {
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            objectId: '_WORLD_instantScanPJ1cgyrm_T6ijgnpsk1c',
            name: 'spatialDraw1mJx458y5jn9a',
            visualization: 'ar',
            ar: {
                x: 0,
                y: 0,
                scale: 1,
                matrix: [
                    0.966, 0.015, 0.257, 0,
                    -0.256, -0.0676, 0.964, 0,
                    -0.0319, 0.997, 0.0614, 0,
                    -50.227, -193.471, -239.032, 1,
                ],
            },
            screen: { x: 0, y: 0, scale: 0.5 },
            visible: false,
            visibleText: false,
            visibleEditing: false,
            developer: true,
            memory: {},
            links: {},
            nodes: {},
            location: 'global',
            src: 'spatialDraw',
            staticCopy: false,
            distanceScale: 1,
            groupID: null,
            pinned: true,
            uuid: '_WORLD_instantScanPJ1cgyrm_T6ijgnpsk1cspatialDraw1mJx458y5jn9a',
            begin: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ],
            loaded: false,
            screenZ: 1000,
            temp: [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1,
            ],
            fullScreen: false,
            sendMatrix: false,
            sendMatrices: {},
            sendAcceleration: false,
            integerVersion: 300,
            lastEditor: 'cKzswlhy',
        }),
        method: 'POST',
        agent: fetchAgent
    });
    return await res.text();
}

async function getObject(objectId) {
    const res = await fetch(`${localServer}/object/${objectId}`, {agent: fetchAgent});
    return await res.json();
}

async function getFrame(objectId) {
    const res = await fetch(`${localServer}/object/${objectId}/frame/${objectId}spatialDraw1mJx458y5jn9a`, {agent: fetchAgent});
    return await res.json();
}

async function moveFrame(objectId) {
    const res = await fetch(`${localServer}/object/${objectId}/frame/${objectId}spatialDraw1mJx458y5jn9a/node/null/size/`, {
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            x: 0,
            y: 0,
            scale: 1,
            matrix: [
                0.966, 0.015, 0.257, 0,
                -0.256, -0.0675, 0.964, 0,
                -0.031, 0.997, 0.061, 0,
                -150, -293, -555, 1
            ],
            lastEditor: 'cKzswlhy'
        }),
        method: 'POST',
        agent: fetchAgent
    });
    return await res.text();
}

const getFrameAddedRef = (objectId) => {
    return {
        objectId,
        uuid: `${objectId}spatialDraw1mJx458y5jn9a`,
        name: 'spatialDraw1mJx458y5jn9a',
        visualization: 'ar',
        ar: {
            x: 0,
            y: 0,
            scale: 1,
            matrix: [
                0.966, 0.015, 0.257, 0,
                -0.256, -0.0676, 0.964, 0,
                -0.0319, 0.997, 0.0614, 0,
                -50.227, -193.471, -239.032, 1
            ]
        },
        screen: { x: 0, y: 0, scale: 0.5 },
        visible: false,
        visibleText: false,
        visibleEditing: false,
        developer: true,
        links: {},
        nodes: {},
        location: 'global',
        src: 'spatialDraw',
        privateData: {},
        publicData: {},
        staticCopy: false,
        distanceScale: 1,
        groupID: null,
        pinned: true,
        createdAt: Date.now(),
    };
};

const getFrameMovedRef = (objectId) => {
    const frameMovedRef = JSON.parse(JSON.stringify(getFrameAddedRef(objectId)));
    frameMovedRef.ar.matrix = [
        0.966, 0.015, 0.257, 0,
        -0.256, -0.0675, 0.964, 0,
        -0.031, 0.997, 0.061, 0,
        -150, -293, -555, 1
    ];
    return frameMovedRef;
};

/**
 * `createdAt` might be off by a few ms, e.g. 1753800310860 vs 1753800311076
 *  so before checking isEqual between two sets of frames, first sync their createdAt times
 */
const syncCreatedAt = (expectedFrames, actualFrames) => {
    for (const uuid of Object.keys(expectedFrames)) {
        if (actualFrames[uuid] && typeof actualFrames[uuid].createdAt === 'number') {
            expectedFrames[uuid].createdAt = actualFrames[uuid].createdAt;
        }
    }
};

test('new object creation', async () => {
    let objectsPath = require('../config.js').objectsPath;

    const snapshotPre = filterSnapshot(snapshotDirectory(objectsPath), (filePath) => {
        return filterToObjects(filePath) && filePath.includes(worldName);
    });
    let objFsPre = null;
    for (let key of Object.keys(snapshotPre)) {
        if (key.endsWith('.identity/object.json')) {
            objFsPre = snapshotPre[key];
            break;
        }
    }
    const objectId = objFsPre.objectId;
    expect(typeof objectId).toBe('string');
    expect(objectId).toMatch(new RegExp(`^${worldName}`));

    const frameAddedRef = getFrameAddedRef(objectId);
    await addFrame(objectId);

    const worldAdded = await getObject(objectId);
    let expectedFrames = {};
    expectedFrames[`${objectId}spatialDraw1mJx458y5jn9a`] = frameAddedRef;

    const addedFrame = worldAdded.frames[frameAddedRef.uuid];
    expect(addedFrame).toBeDefined();
    expect(typeof addedFrame.createdAt).toBe('number'); // first check that it's a number
    syncCreatedAt(expectedFrames, worldAdded.frames); // Date.now() changes, so set it exactly before checking toEqual
    expect(worldAdded.frames).toEqual(expectedFrames);

    const frameAdded = await getFrame(objectId);
    expect(typeof frameAdded.createdAt).toBe('number'); // do similar checks on the server copy
    frameAdded.createdAt = frameAddedRef.createdAt; // otherwise off by a few ms, e.g. 1753800310860 vs 1753800311076
    expect(frameAdded).toEqual(frameAddedRef);

    const snapshot = filterSnapshot(snapshotDirectory(objectsPath), (filePath) => {
        return filterToObjects(filePath) && filePath.includes(worldName);
    });
    let objFs = null;
    for (let key of Object.keys(snapshot)) {
        if (key.endsWith('.identity/object.json')) {
            objFs = snapshot[key];
            break;
        }
    }
    syncCreatedAt(expectedFrames, objFs.frames);
    expect(objFs.frames).toEqual(expectedFrames);

    const frameMovedRef = getFrameMovedRef(objectId);
    await moveFrame(objectId);

    const worldMoved = await getObject(objectId);
    let expectedFramesMoved = {};
    expectedFramesMoved[`${objectId}spatialDraw1mJx458y5jn9a`] = frameMovedRef;
    syncCreatedAt(expectedFramesMoved, worldMoved.frames);
    expect(worldMoved.frames).toEqual(expectedFramesMoved);
    const frameMoved = await getFrame(objectId);
    expect(frameMoved).toEqual(frameMovedRef);

    const snapshotMoved = filterSnapshot(snapshotDirectory(objectsPath), (filePath) => {
        return filterToObjects(filePath) && filePath.includes(worldName);
    });
    objFs = null;
    for (let key of Object.keys(snapshotMoved)) {
        if (key.endsWith('.identity/object.json')) {
            objFs = snapshotMoved[key];
            break;
        }
    }
    syncCreatedAt(expectedFramesMoved, objFs.frames);
    expect(objFs.frames).toEqual(expectedFramesMoved);
});
