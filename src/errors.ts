export class BaseError extends Error {
	status: number;

	constructor() {
		super();
		this.message = 'Internal Server Error';
		this.status = 500;
	}
}

export class DatabaseError extends BaseError {
	status = 500;

	constructor() {
		super();
		this.message = 'Internal Server Error';
		this.status = 500;
	}
}

export class APIError extends BaseError {
	status: number;

	constructor(status: number) {
		super();
		this.status = status;
	}
}
