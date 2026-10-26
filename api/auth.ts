import { handleAuthApi } from './_lib/catalogBackend';

export default async function handler(req: any, res: any) {
  return handleAuthApi(req, res);
}
