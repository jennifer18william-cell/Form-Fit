import { handleUploadImageApi } from './_lib/catalogBackend';

export default async function handler(req: any, res: any) {
  return handleUploadImageApi(req, res);
}
