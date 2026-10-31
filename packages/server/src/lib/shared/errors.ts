// catch した値を、画面や API で返せるメッセージにする
export function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
