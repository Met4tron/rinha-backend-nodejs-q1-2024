import { Pool } from 'pg';
import { performance } from 'node:perf_hooks';

const pool = new Pool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '1234',
	database: 'rinha_db',
	idleTimeoutMillis: 0,
	max: parseInt(process.env.POOL_SIZE || '10'),
	min: 10,
});

type Transaction = {
	valor: number;
	descricao: string;
	tipo: 'c' | 'd';
};

export const getClients = async () => {
	const client = await pool.connect();

	const clients = await client.query(
		'SELECT limite FROM clientes ORDER BY id ASC',
	);

	client.release();

	return clients.rows;
};

export const addTransaction = async (
	clientId: number,
	transaction: Transaction,
	limite = 0,
) => {
	if (transaction.tipo === 'c') {
		return addCredit(clientId, transaction, limite);
	}

	return addDebit(clientId, transaction, limite);
};

export const addDebit = async (
	clientId: number,
	transaction: Transaction,
	limite: number,
) => {
	const start = performance.now();
	const client = await pool.connect();

	try {
		const result = await client.query('SELECT ADD_DEBIT($1, $2, $3, $4)', [
			clientId,
			transaction.valor,
			transaction.descricao,
			limite,
		]);

		if (result.rows[0].add_debit === null) {
			return null;
		}

		return {
			saldo: result.rows[0].add_debit,
			limite: limite,
		};
	} finally {
		client.release();

		console.log(
			`Debit Time - ${Math.floor((performance.now() - start) / 1000)}ms`,
		);
	}
};

export const addCredit = async (
	clientId: number,
	transaction: Transaction,
	limite: number,
) => {
	const start = performance.now();
	const client = await pool.connect();

	try {
		const result = await client.query('SELECT ADD_CREDIT($1, $2, $3)', [
			clientId,
			transaction.valor,
			transaction.descricao,
		]);

		if (result.rows[0].add_credit === null) {
			return null;
		}

		return {
			saldo: result.rows[0].add_credit,
			limite: limite,
		};
	} finally {
		client.release();
		console.log(
			`Credit Time - ${Math.floor((performance.now() - start) / 1000)}ms`,
		);
	}
};

export const getExtract = async (clientId: number, limite: number) => {
	const start = performance.now();

	const client = await pool.connect();

	try {
		const clientDb = await client.query({
			name: 'fetch-client',
			text: 'SELECT saldo from clientes WHERE id = $1',
			values: [clientId],
			rowMode: 'array',
		});

		const transactions = await client.query({
			name: 'fetch-extract',
			text: 'SELECT valor, tipo, descricao, realizada_em from transacoes WHERE id_cliente = $1 ORDER BY realizada_em DESC LIMIT 10',
			values: [clientId],
			rowMode: 'array',
		});

		return {
			saldo: {
				total: clientDb.rows[0][0],
				data_extrato: new Date(),
				limite: limite,
			},
			ultimas_transacoes: transactions.rows.map((tr) => ({
				valor: tr[0],
				tipo: tr[1],
				descricao: tr[2],
				realizada_em: tr[3],
			})),
		};
	} finally {
		console.log(
			`Extract Time - ${Math.floor((performance.now() - start) / 1000)}ms`,
		);

		client?.release();
	}
};
