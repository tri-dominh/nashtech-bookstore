import 'multer';
import { getStorage } from 'firebase-admin/storage';
import { EUploadFolder } from 'src/constants/image';

export const uploadFiles = async (
  filesContent: Express.Multer.File[],
  uploadFolder: EUploadFolder,
) => {
  try {
    const result = await Promise.all(
      filesContent.map(async (item) => {
        try {
          const bf = Buffer.from(item.buffer);
          const bucket = getStorage().bucket();
          const filename = `${Date.now()}-${item.originalname}`;
          const file = bucket.file(`${uploadFolder}/${filename}`);

          await file.save(bf, { contentType: item.mimetype });
          await file.makePublic();

          return `https://firebasestorage.googleapis.com/v0/b/${process.env.FIREBASE_PROJECT_ID}.appspot.com/o/${uploadFolder}%2F${filename}?alt=media`;
        } catch (error) {
          console.error('Firebase upload error:', error?.message || error);
          throw error;
        }
      }),
    );

    return { success: true, urls: result };
  } catch (error) {
    return { success: false, urls: [] };
  }
};
