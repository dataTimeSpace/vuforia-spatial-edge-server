const fetch = require('node-fetch');
const yargs = require('yargs');
const fs = require('fs');
const path = require('path');

const argv = yargs
    .option('spatialToolboxPath', {
        description: 'The path to the spatialToolbox directory',
        type: 'string',
    })
    .help()
    .argv;

const spatialToolboxPath = argv.spatialToolboxPath || './spatialToolbox';

const edgeAgentSettingsPath = path.join(spatialToolboxPath, '.identity/edgeAgent/settings.json');

let healthCheckBaseUrl = 'http://localhost:8080';

if (fs.existsSync(edgeAgentSettingsPath)) {
    try {
        const raw = fs.readFileSync(edgeAgentSettingsPath, 'utf8');
        const settings = JSON.parse(raw);
        if (!settings.enabled) {
            throw new Error('edge agent not enabled');
        }

        healthCheckBaseUrl = `https://${settings.serverUrl}/n/${settings.networkUUID}/i/unused/s/${settings.networkSecret}`;
    } catch (e) {
        console.warn('unable to parse edge agent settings for healthcheck', e);
    }
}

const healthCheckUrl = `${healthCheckBaseUrl}/status`;

(async () => {
    const res = await fetch(healthCheckUrl);
    if (!res.ok) {
        console.error('health check fetch failed');
        process.exit(1);
    }
    process.exit(0);
})();
