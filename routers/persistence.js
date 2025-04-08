const express = require('express');
const Synchronizer = require('../persistence/synchronize.js').Synchronizer;

const router = express.Router();
const synchronizer = new Synchronizer();

router.post('/start', (req, res) => {
    console.log('start', req.body.callback);
    synchronizer.startSync(req.body.callback);
    res.json(synchronizer.getStatus());
});

router.post('/stop', (_req, res) => {
    synchronizer.stopSync();
    res.json(synchronizer.getStatus());
});

router.get('/status', (_req, res) => {
    res.json(synchronizer.getStatus());
});


function stop() {
    synchronizer.stopSync();
}

module.exports = {
    router,
    stop,
};
