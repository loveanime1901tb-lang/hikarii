'use strict';
const port=require('worker_threads').parentPort;
port.on('message',async m=>{try{const value=m.type==='parse'?await require('./history.cjs').parse(Buffer.from(m.a),m.b):await require('./history-paper.cjs')[m.type](m.a,m.b);port.postMessage({value});}catch(e){port.postMessage({error:e.message});}});
