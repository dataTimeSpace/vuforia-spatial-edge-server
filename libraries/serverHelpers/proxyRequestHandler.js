const https = require('https');

const proxyRequestHandler = async (req, res) => {
    const input = req.params[0];
    if (!input.includes('://')) {
        let serverUrl = 'stable.platform.datatime.space';
        try {
            const { loadHardwareInterfaceAsync } = require('../utilities.js');
            const read = await loadHardwareInterfaceAsync('edgeAgent');
            serverUrl = read('serverUrl'); // read the latest value from the edge agent
            console.log(`proxyRequestHandler got serverUrl: ${serverUrl}`);
        } catch (error) {
            console.warn("error reading serverUrl from edge agent", error);
        }

        const proxyURL = `https://${serverUrl}/${req.params[0]}`;
        const headers = req.headers;
        headers.Host = serverUrl;
        https.get(proxyURL, {headers}, proxyRes => {
            res.status(proxyRes.statusCode);
            for (let header in proxyRes.headers) {
                res.setHeader(header, proxyRes.headers[header]);
            }
            proxyRes.pipe(res);
        });
    } else {
        const proxyURL = req.params[0];
        const headers = req.headers;
        headers.Host = new URL(proxyURL).host;
        if (headers.host) {
            delete headers.host;
        }
        https.get(proxyURL, {headers}, proxyRes => {
            res.status(proxyRes.statusCode);
            for (let header in proxyRes.headers) {
                res.setHeader(header, proxyRes.headers[header]);
            }
            proxyRes.pipe(res);
        });
    }
};

module.exports = proxyRequestHandler;
