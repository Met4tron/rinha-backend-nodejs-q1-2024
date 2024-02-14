import typia, { tags } from 'typia';

export interface ITransaction {
	valor: number & tags.Type<'uint32'> & tags.Minimum<0>;
	descricao: string & tags.MinLength<1> & tags.MaxLength<10>;
	tipo: 'c' | 'd';
}

export interface ID {
	id: number & tags.Type<'uint32'> & tags.Minimum<1> & tags.Maximum<6>;
}

export const checkTransaction = (input: unknown) =>
	typia.is<ITransaction>(input);

export const checkId = (input: string) => {
	try {
		return typia.http.parameter<
			number & tags.Type<'uint32'> & tags.Minimum<1> & tags.Maximum<5>
		>(input);
	} catch (err) {
		return false;
	}
};
