import { handleStylistApi } from './_lib/stylistBackend';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  return handleStylistApi(req, res);
}
