import { handleProductsApi } from './_lib/catalogBackend';

export default async function handler(req: any, res: any) {
  return handleProductsApi(req, res);
}
