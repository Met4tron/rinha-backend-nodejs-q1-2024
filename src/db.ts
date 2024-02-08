import { Pool } from 'pg';
import { APIError } from './errors';

const pool = new Pool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '1234',
	database: 'rinha_db',
	idleTimeoutMillis: 0,
	connectionTimeoutMillis: 60_000,
	query_timeout: 60_0000,
	max: parseInt(process.env.POOL_SIZE || '10'),
});

type Transaction = {
	id: number;
	valor: number;
	tipo: string;
	descricao: string;
	id_cliente: number;
	criada_em: Date;
};

export const getClient = async (clientId: number) => {};

export const addTransaction = async (
	clientId: number,
	transaction: Omit<Transaction, 'criada_em' | 'id'>,
) => {
	if (transaction.tipo === 'c') {
		return addCredit(clientId, transaction);
	}

	return addDebit(clientId, transaction);
};

export const addDebit = async (
	clientId: number,
	transaction: Omit<Transaction, 'criada_em' | 'id'>,
) => {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');
		await client.query("SELECT pg_advisory_xact_lock($1)", [clientId])

		const clientDb = await client.query('SELECT limite, saldo FROM clients WHERE id = $1 FOR UPDATE', [clientId])

		if (!clientDb.rows.length) {
			throw new APIError(422);
		}

		const newBalance = clientDb.rows[0].saldo - transaction.valor

		if (newBalance < (clientDb.rows[0].limite * -1)) {
			throw new APIError(422)
		}

		await client.query(
			'UPDATE public.clients SET saldo = $1 WHERE id = $2',
			[newBalance, clientId],
		);

		await client.query(
			'INSERT INTO public.transactions (valor, tipo_transacao, descricao, id_cliente) VALUES ($1, $2, $3, $4)',
			[transaction.valor, transaction.tipo, transaction.descricao, clientId],
		);

		await client.query('COMMIT');

		return {
			saldo: newBalance,
			limite: clientDb.rows[0].limite
		};
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
};

export const addCredit = async (
	clientId: number,
	transaction: Omit<Transaction, 'criada_em' | 'id'>,
) => {
	const client = await pool.connect();

	try {
		await client.query('BEGIN TRANSACTION');
		await client.query("SELECT pg_advisory_xact_lock($1)", [clientId])

		const clientDb = await client.query('SELECT limite, saldo FROM clients WHERE id = $1 FOR UPDATE', [clientId])

		if (!clientDb.rows.length) {
			throw new APIError(422);
		}

		const newBalance = clientDb.rows[0].saldo + transaction.valor

		await client.query(
			'UPDATE public.clients SET saldo = $1 WHERE id = $2',
			[newBalance, clientId],
		);

		await client.query(
			'INSERT INTO transactions (valor, tipo_transacao, descricao, id_cliente) VALUES ($1, $2, $3, $4)',
			[transaction.valor, transaction.tipo, transaction.descricao, clientId],
		);

		await client.query('COMMIT');

		return {
			saldo: newBalance,
			limite: clientDb.rows[0].limite,
		};
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
};

export const getExtract = async (clientId: number) => {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		await client.query("SELECT pg_advisory_xact_lock($1)", [clientId])

		const clientDb = await client.query(
			'SELECT *, now() as data_extrato from clients WHERE id = $1 LIMIT 1',
			[clientId],
		);

		if (!clientDb.rows.length) {
			throw new APIError(404);
		}

		const transactions = await client.query(
			'SELECT valor as total, tipo_transacao as tipo, descricao, criada_em as realizada_em from transactions WHERE id_cliente = $1 ORDER BY id DESC LIMIT 10',
			[clientId],
		);

		await client.query('COMMIT');

		return {
			saldo: clientDb.rows[0],
			ultimas_transacoes: transactions.rows?.[0] ?? [],
		};
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
};
