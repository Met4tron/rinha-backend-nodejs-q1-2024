import * as HyperExpress from 'hyper-express';
import { cpus } from 'node:os';
import process from 'node:process';
import cluster from 'node:cluster';
import Validator from 'fastest-validator';
import { checkClient, createTransactionSchema } from './schemas';
import { addTransaction, getExtract } from './db';
import { APIError } from './errors';

const numCPUs = cpus().length;

process.env.UV_THREADPOOL_SIZE = `${numCPUs}`;

const v = new Validator({ haltOnFirstError: true });

const compiledSchemas = {
	createTransactionSchema: v.compile(createTransactionSchema),
	checkClient: v.compile(checkClient),
};

const server = new HyperExpress.Server({ trust_proxy: true });

server.use(async (req, res, next) => {
	const validationResult = compiledSchemas.checkClient(req.path_parameters)

	if (!validationResult || validationResult?.length) {
		return res.status(422).json({});
	}

	next();
});

server.post('/clientes/:id/transacoes', async (req, res) => {
	try {

		const body = await req.json();

		const validationResult = compiledSchemas.createTransactionSchema(body)

		if (!validationResult || validationResult.length) {
			return res.status(422).json({})
		}
		console.log({
			valor: body.valor,
			descricao: body.descricao,
			tipo: body.tipo,
			id_cliente: +req.path_parameters.id,
		})
		const result = await addTransaction(+req.path_parameters.id, {
			valor: body.valor,
			descricao: body.descricao,
			tipo: body.tipo,
			id_cliente: +req.path_parameters.id,
		});

		return res.status(200).json({
			saldo: result.saldo,
			limite: result.limite,
		});
	} catch (e) {
		if (e instanceof APIError) {
			return res.status(e.status).json({});
		}
		console.log(`Error - AddTransaction - ${e?.message}`);
		return res.status(500).json({});
	}
});

server.get('/clientes/:id/extrato', async (req, res) => {
	try {
		const { saldo, ultimas_transacoes } = await getExtract(
			+req.path_parameters.id,
		);

		return res.status(200).json({
			saldo: {
				id: saldo.id,
				limite: saldo.limite,
				total: saldo.saldo,
				data_extrato: saldo.data_extrato,
			},
			ultimas_transacoes: ultimas_transacoes ?? [],
		});
	} catch (e) {
		if (e instanceof APIError) {
			return res.status(e.status).json({});
		}
		console.log(`Error - Extract - ${e?.message}`)
		return res.status(500).json({});
	}
});

server
	.listen(process.env.HTTP_PORT || 3000)
	.then((_) => {
		console.log(`Webserver started on port ${process.env.HTTP_PORT}`);
		console.log(`Worker ${process.pid} started`);
	})
	.catch((error) => {
		console.log(error);
		console.log(`Failed to start webserver on port ${process.env.HTTP_PORT}`);
	});

