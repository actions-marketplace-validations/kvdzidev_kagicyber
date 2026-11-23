// Runs one audit inside a worker thread for `kagicyber serve`, so a hostile page that makes parsing slow
// can be stopped with worker.terminate() without blocking other API clients.
import { parentPort, workerData } from 'node:worker_threads';
import { audit } from './audit.js';

audit(workerData.target, workerData.opts).then(
  (result) => parentPort.postMessage({ ok: true, result }),
  (err) => parentPort.postMessage({ ok: false, message: err?.message || String(err) })
);
