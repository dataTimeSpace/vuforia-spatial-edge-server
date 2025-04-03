const remote = require('./CloudProxyWrapper.js');
const local = require('fs/promises');
const path = require('path');

const {objectsPath} = require('../config.js');
const makeChecksumList = require('./makeChecksumList.js');

const DEBUG = false;
const PULL_FROM_REMOTE = false;

// Experimental feature to allow the remote (cloud proxy) to determine a merge
// between our state and theirs and send back this merge for us to overwrite
// our local file with
const allowRemoteOverwriteLocal = false;

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
        this.newRemote = [];
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
        let newRemote = [];
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
            } else {
                if (PULL_FROM_REMOTE) {
                    newRemote.push(pathRemote);
                }
            }
        }

        for (const pathLocal of Object.keys(cslLocal)) {
            if (!cslRemote.hasOwnProperty(pathLocal)) {
                newLocal.push(pathLocal);
            }
        }

        this.diffs = diffs;
        this.newRemote = newRemote;
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
        let unmatching = [].concat(this.diffs, this.newRemote, this.newLocal);
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
        this.onSyncDoneHooks.push(onSyncDoneHook);
        if (this.enableSyncing) {
            return;
        }
        this.enableSyncing = true;

        await this.updateSyncLists();
        while (this.enableSyncing && (
                this.diffs.length > 0 ||
                this.newLocal.length > 0 ||
                this.newRemote.length > 0)) {
            await this.performSync();
            await this.updateSyncLists();
        }

        for (let onSyncDoneHook of this.onSyncDoneHooks) {
            fetch(onSyncDoneHook, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json',
                },
                body: JSON.stringify(this.getStatus()),
            });
        }
        this.onSyncDoneHooks = [];
        this.enableSyncing = false;
    }

    async performSync() {
        if (this.syncing) {
            return;
        }
        this.syncing = true;

        if (DEBUG) {
            console.log('sync diffs', this.diffs);
        }
        while (this.diffs.length > 0) {
            const relPath = this.diffs.pop();
            if (!this.enableSyncing) {
                this.syncing = false;
                return;
            }
            const localAbsPath = path.join(objectsPath, relPath);
            const contents = await local.readFile(localAbsPath);
            const newContents = await remote.writeFile(relPath, contents);
            if (newContents && allowRemoteOverwriteLocal) {
                await local.writeFile(localAbsPath, newContents);
            }
            this.matching.push(relPath);
        }

        if (DEBUG) {
            console.log('sync newRemote', this.newRemote);
        }
        while (this.newRemote.length > 0) {
            const relPath = this.newRemote.pop();

            if (!this.enableSyncing) {
                this.syncing = false;
                return;
            }
            const localAbsPath = path.join(objectsPath, relPath);
            const contents = await remote.readFile(relPath);
            const localAbsDir = path.dirname(localAbsPath);
            try {
                await local.mkdir(localAbsDir, {recursive: true});
            } catch (_e) {
                // dir already exists
            }
            await local.writeFile(localAbsPath, contents);

            this.matching.push(relPath);
        }

        if (DEBUG) {
            console.log('sync newLocal', this.newLocal);
        }
        while (this.newLocal.length > 0) {
            const relPath = this.newLocal.pop();

            if (!this.enableSyncing) {
                this.syncing = false;
                return;
            }
            const localAbsPath = path.join(objectsPath, relPath);
            const contents = await local.readFile(localAbsPath);
            await remote.writeFile(relPath, contents);

            this.matching.push(relPath);
        }

        this.syncing = false;
    }

    stopSync() {
        this.enableSyncing = false;
    }
}

exports.Synchronizer = Synchronizer;
