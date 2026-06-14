import { Logger } from '@nestjs/common';
import { getStorage } from 'firebase-admin/storage';

const parseFileName = (publicUrl: string) => {
  const urlParts = publicUrl.split('/');
  const filenameAndQuery = urlParts[urlParts.length - 1];
  const [filenameWithFolder] = filenameAndQuery.split('?');
  const [folder, fileName] = decodeURIComponent(filenameWithFolder).split('/');
  return { fileName, folder };
};

export const deleteFiles = async (urls: string[]) => {
  const bucket = getStorage().bucket();

  try {
    await Promise.all(
      urls.map(async (item) => {
        try {
          const { fileName, folder } = parseFileName(item);
          const file = bucket.file(`${folder}/${fileName}`);
          return await file.delete();
        } catch (e) {
          // silent — file may not exist
        }
      }),
    );

    return { success: true };
  } catch (error) {
    Logger.error('Error deleting file from Firebase Storage:', error);
    return { success: false };
  }
};
