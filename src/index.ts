import { cpus } from 'node:os';
import process from 'node:process';
import cluster from 'node:cluster';
import { Mutex } from 'async-mutex';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { addTransaction, getClients, getExtract } from './db';
import { checkId, checkTransaction, ITransaction } from './schemas';
import { HTTPException } from 'hono/http-exception';

const numCPUs = cpus().length;
const limites = new Map();

process.env.UV_THREADPOOL_SIZE = `${numCPUs}`;

const mutex = new Mutex();

const server = new Hono();

server.use('/clientes/:id/*', async (c, next) => {
	// @ts-ignore
	const id = c.req.param('id');

	if (Number.isNaN(id)) {
		return c.json({}, 422);
	}

	if (!checkId(id)) {
		return c.json({}, 404);
	}

	await next();
});

server.post('/clientes/:id/transacoes', async (c) => {
	const release = await mutex.acquire();

	try {
		const body = (await c.req.json()) as ITransaction;
		const id = +c.req.param('id');

		if (!checkTransaction(body)) {
			throw new HTTPException(422);
		}

		const result = await addTransaction(
			id,
			{
				...body,
			},
			limites.get(id),
		);

		if (!result) {
			throw new HTTPException(422);
		}

		return c.json(
			{
				saldo: result.saldo,
				limite: result.limite,
			},
			200,
		);
	} finally {
		release();
	}
});

server.get('/clientes/:id/extrato', async (c, res) => {
	const release = await mutex.acquire();

	try {
		const id = +c.req.param('id');

		const { saldo, ultimas_transacoes } = await getExtract(id, limites.get(id));

		return c.json(
			{
				saldo,
				ultimas_transacoes,
			},
			200,
		);
	} finally {
		release();
	}
});

server.onError((err, c) => {
	if (err instanceof HTTPException) {
		return err.getResponse();
	}
	console.log(err);
	throw new HTTPException(500);
});

if (cluster.isPrimary) {
	console.log(`Primary ${process.pid} is running`);

	getClients().then((rows) => {
		rows.map((c, i) => limites.set(i + 1, c.limite));

		for (let i = 1; i <= 2; i++) {
			cluster.fork();
		}
	});

	cluster.on('exit', (worker, code, signal) => {
		console.log(`worker ${worker.process.pid} died`);
	});
} else {
	getClients()
		.then((rows) => {
			rows.map((c, i) => limites.set(i + 1, c.limite));

			return serve({
				fetch: server.fetch,
				port: Number(process.env?.HTTP_PORT) ?? 3000,
			});
		})
		.then((socket) =>
			console.log(
				`Webserver started on port ${Number(process.env?.HTTP_PORT) ?? 3000}`,
			),
		)
		.catch((error) => {
			console.log(error);
			console.log(
				`Failed to start webserver on port  ${
					Number(process.env?.HTTP_PORT) ?? 3000
				}`,
			);
		});
}
