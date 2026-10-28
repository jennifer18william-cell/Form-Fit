import { handleNotificationsApi } from './_lib/notificationBackend';

export default async function handler(req: any, res: any) {
  return handleNotificationsApi(req, res);
}
