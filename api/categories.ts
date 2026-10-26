import { handleCategoriesApi } from './_lib/catalogBackend';

export default async function handler(req: any, res: any) {
  return handleCategoriesApi(req, res);
}
