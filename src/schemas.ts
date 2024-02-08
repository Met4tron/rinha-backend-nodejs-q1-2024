import Validator from 'fastest-validator';

const v = new Validator({
	haltOnFirstError: true,
	useNewCustomCheckerFunction: true,
	messages: {
		validId: 'not valid id',
	},
});

export const createTransactionSchema = {
	valor: {
		type: 'number',
		positive: true,
		integer: true,
		min: 1,
	},
	descricao: {
		type: 'string',
		max: 10,
		min: 1,
	},
	tipo: {
		type: 'string',
		enum: ['c', 'd'],
	},
	$$strict: true,
};

export const checkClient = {
	id: {
		type: "number",
		min: 1,
		max: 6,
		integer: true,
		positive: true,
		convert: true
	},
	$$strict: true,
};
