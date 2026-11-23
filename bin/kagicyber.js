#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`kagicyber: ${err?.message || err}`);
    if (process.env.KAGICYBER_DEBUG) console.error(err?.stack);
    process.exit(2);
  }
);
