const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fs = require('fs').promises;
const fetch = require('node-fetch');

exports = module.exports = async (session) => {
    const blocker = await ElectronBlocker.fromPrebuiltAdsOnly(fetch, {
        path: 'engine.bin',
        read: fs.readFile,
        write: fs.writeFile,
    });

    blocker.enableBlockingInSession(session);

    blocker.on('request-blocked', (request) => {
        console.log('[AdBlocker] Blocked', request.url);
    });
}
