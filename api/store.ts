import { handleStoreApi } from './_lib/catalogBackend';

export default async function handler(req: any, res: any) {
  return handleStoreApi(req, res);
}
