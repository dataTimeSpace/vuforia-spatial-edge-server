const remote = require('./CloudProxyWrapper.js');
const local = require('fs/promises');
const path = require('path');

const {objectsPath} = require('../config.js');
const makeChecksumList = require('./makeChecksumList.js');

const DEBUG = false;

const worldRe = /(_WORLD_[^/]+)/
function getWorld(diffPath) {
    let matches = worldRe.exec(diffPath);
    if (!matches) {
        return null;
    }
    return matches[1];
}

class Synchronizer {
    constructor() {
        this.diffs = [];
        this.newLocal = [];
        this.matching = [];
        this.enableSyncing = false;
        this.syncing = false;
        this.onSyncDoneHooks = [];
    }

    async updateSyncLists() {
        const cslRemote = await remote.getChecksumList();
        const cslLocal = await makeChecksumList(objectsPath, '');

        let diffs = [];
        let newLocal = [];
        let matching = [];

        for (const [pathRemote, checkRemote] of Object.entries(cslRemote)) {
            if (cslLocal.hasOwnProperty(pathRemote)) {
                const checkLocal = cslLocal[pathRemote];
                if (checkLocal !== checkRemote) {
                    diffs.push(pathRemote);
                } else {
                    matching.push(pathRemote);
                }
            }
        }

        for (const pathLocal of Object.keys(cslLocal)) {
            if (!cslRemote.hasOwnProperty(pathLocal)) {
                newLocal.push(pathLocal);
            }
        }

        this.diffs = diffs;
        this.newLocal = newLocal;
        this.matching = matching;
    }

    getStatus() {
        let worlds = {};
        function getDefaultStatus() {
            return {
                matching: 0,
                total: 0,
            };
        }
        let unmatching = [].concat(this.diffs, this.newLocal);
        for (let diff of unmatching) {
            let worldId = getWorld(diff) || 'other';
            if (!worlds[worldId]) {
                worlds[worldId] = getDefaultStatus();
            }
            const world = worlds[worldId];
            world.total += 1;
        }

        for (let same of this.matching) {
            let worldId = getWorld(same) || 'other';
            if (!worlds[worldId]) {
                worlds[worldId] = getDefaultStatus();
            }
            const world = worlds[worldId];
            world.matching += 1;
            world.total += 1;
        }

        return {
            syncing: this.syncing,
            enableSyncing: this.enableSyncing,
            worlds,
        };
    }


    /**
     * Start syncing process
     * @param {string?} onSyncDoneHook webhook url to be hit when syncing is done
     */
    async startSync(onSyncDoneHook) {
        try {
            this.onSyncDoneHooks.push(onSyncDoneHook);
            if (this.enableSyncing) {
                return;
            }
            this.enableSyncing = true;

            await this.updateSyncLists();
            let failuresAllowed = 5;
            while (this.enableSyncing && (
                this.diffs.length > 0 ||
                this.newLocal.length > 0)) {
                try {
                    await this.performSync();
                } catch (e) {
                    console.warn('Unable to perform sync', e);
                    this.syncing = false;
                    if (failuresAllowed-- < 0) {
                        console.error('Too many sync failures');
                        this.onSyncDoneHooks = [];
                        this.enableSyncing = false;
                        return;
                    }
                }
                await this.updateSyncLists();
            }

            for (let onSyncDoneHook of this.onSyncDoneHooks) {
                const apiHeaders = await remote.fetchOptionsWrite();
                await fetch(onSyncDoneHook, {
                    ...apiHeaders, // includes method: POST, and headers (with Authorization)
                    body: JSON.stringify(this.getStatus()),
                });
            }
            this.onSyncDoneHooks = [];
            this.enableSyncing = false;
        } catch (error) {
            console.error('Unable to perform sync', error);
        }
    }

    async performSyncOnList(pathsList) {
        if (!this.syncing) {
            return;
        }

        while (pathsList.length > 0) {
            const relPath = pathsList.pop();
            if (!this.enableSyncing) {
                this.syncing = false;
                return;
            }
            const localAbsPath = path.join(objectsPath, relPath);
            const contents = await local.readFile(localAbsPath);
            await remote.writeFile(relPath, contents);
            this.matching.push(relPath);
        }
    }

    async performSync() {
        if (this.syncing) {
            return;
        }
        this.syncing = true;

        if (DEBUG) {
            console.log('sync diffs', this.diffs);
        }
        await this.performSyncOnList(this.diffs);

        if (DEBUG) {
            console.log('sync newLocal', this.newLocal);
        }
        await this.performSyncOnList(this.newLocal);

        this.syncing = false;
    }

    stopSync() {
        this.enableSyncing = false;
    }
}

exports.Synchronizer = Synchronizer;
